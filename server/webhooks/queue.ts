/**
 * Durable webhook delivery queue.
 *
 * Uses BullMQ when REDIS_URL is set (persistent, retry-aware, multi-instance safe).
 * Falls back to in-process delivery with a best-effort retry schedule when no Redis.
 *
 * Jobs are retried with exponential backoff; once all attempts are exhausted the
 * final attempt is recorded as `status='dead'` (DLQ-equivalent — the row in
 * webhook_deliveries is the dead-letter record).
 */
import { Queue, Worker, type Job } from "bullmq";
import { config } from "../config.js";
import { logger } from "../observability/logger.js";
import {
  performDelivery,
  newDeliveryId,
  DELIVERY_MAX_ATTEMPTS,
  type DeliveryJobData,
} from "./delivery.js";

export const WEBHOOK_QUEUE_NAME = "webhook-deliveries";

type BullConnection = { host: string; port: number; password?: string; tls?: object };

function parseRedis(redisUrl: string): BullConnection {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: parseInt(url.port, 10) || 6379,
    ...(url.password && { password: url.password }),
    ...(url.protocol === "rediss:" && { tls: {} }),
  };
}

interface WebhookQueueApi {
  enqueue(input: Omit<DeliveryJobData, "deliveryId" | "attempt"> & { deliveryId?: string }): Promise<string>;
  start(): Promise<void>;
  stop(): Promise<void>;
  getQueue(): Queue | null;
}

class BullQueueImpl implements WebhookQueueApi {
  private queue: Queue<DeliveryJobData>;
  private worker: Worker<DeliveryJobData> | null = null;
  private started = false;

  constructor(private readonly connection: BullConnection) {
    this.queue = new Queue<DeliveryJobData>(WEBHOOK_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        removeOnComplete: { count: 500, age: 7 * 24 * 3600 },
        removeOnFail: { count: 2000, age: 30 * 24 * 3600 },
        attempts: DELIVERY_MAX_ATTEMPTS,
        backoff: { type: "exponential", delay: 30_000 },
      },
    });
  }

  async enqueue(input: Omit<DeliveryJobData, "deliveryId" | "attempt"> & { deliveryId?: string }): Promise<string> {
    const deliveryId = input.deliveryId ?? newDeliveryId();
    await this.queue.add(
      "deliver",
      { ...input, deliveryId, attempt: 1 },
      { jobId: deliveryId },
    );
    return deliveryId;
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    this.worker = new Worker<DeliveryJobData>(
      WEBHOOK_QUEUE_NAME,
      async (job: Job<DeliveryJobData>) => {
        const attempt = job.attemptsMade + 1;
        const data: DeliveryJobData = { ...job.data, attempt };
        const result = await performDelivery(data);
        if (result.status === "failed") {
          throw new Error(result.error ?? `HTTP ${result.responseCode ?? "?"}`);
        }
        return result;
      },
      { connection: this.connection, concurrency: 5 },
    );

    this.worker.on("failed", (job, err) => {
      logger.warn("Webhook delivery attempt failed", {
        deliveryId: job?.id,
        attempt: job?.attemptsMade,
        webhookId: job?.data?.webhookId,
        eventType: job?.data?.eventType,
        error: err.message,
      });
    });

    logger.info("Webhook delivery worker started");
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    this.started = false;
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    await this.queue.close();
    logger.info("Webhook delivery worker stopped");
  }

  getQueue(): Queue { return this.queue; }
}

class InlineQueueImpl implements WebhookQueueApi {
  async enqueue(input: Omit<DeliveryJobData, "deliveryId" | "attempt"> & { deliveryId?: string }): Promise<string> {
    const deliveryId = input.deliveryId ?? newDeliveryId();
    // Fire-and-forget — best-effort retry with exponential backoff.
    void (async () => {
      for (let attempt = 1; attempt <= DELIVERY_MAX_ATTEMPTS; attempt++) {
        const result = await performDelivery({ ...input, deliveryId, attempt });
        if (result.status === "success" || result.status === "dead") return;
        const delayMs = 30_000 * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    })();
    return deliveryId;
  }

  async start(): Promise<void> { /* no-op */ }
  async stop(): Promise<void> { /* no-op */ }
  getQueue(): null { return null; }
}

let impl: WebhookQueueApi | null = null;

export function getWebhookQueue(): WebhookQueueApi {
  if (impl) return impl;
  if (config.redisUrl) {
    impl = new BullQueueImpl(parseRedis(config.redisUrl));
    logger.info("Using BullMQ webhook delivery queue (Redis-backed)");
  } else {
    impl = new InlineQueueImpl();
    logger.info("Using in-process webhook delivery (no REDIS_URL)");
  }
  return impl;
}
