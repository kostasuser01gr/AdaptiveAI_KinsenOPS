/**
 * Actual webhook HTTP delivery with signed-and-timestamped headers.
 *
 * Signature scheme (receiver verifies):
 *   sig = HMAC_SHA256(secret, `${timestamp}.${deliveryId}.${body}`)
 *   send X-Webhook-Signature: sha256=<sig>
 *        X-Webhook-Timestamp: <unix seconds>
 *        X-Webhook-Delivery-Id: <uuid>
 *        X-Webhook-Event: <eventType>
 *
 * Receivers should reject if timestamp drift > 5 minutes and track
 * delivery ids to prevent replay.
 */
import { createHmac, randomUUID } from "crypto";
import { db } from "../db.js";
import { webhooks, webhookDeliveries } from "../../shared/schema.js";
import { eq } from "drizzle-orm";
import { logger } from "../observability/logger.js";

export const DELIVERY_TIMEOUT_MS = 10_000;
export const DELIVERY_MAX_ATTEMPTS = 5;

export interface DeliveryJobData {
  webhookId: number;
  eventType: string;
  payload: Record<string, unknown>;
  deliveryId: string;
  attempt: number;
}

export function buildSignature(secret: string, timestamp: number, deliveryId: string, body: string): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${deliveryId}.${body}`)
    .digest("hex");
}

export function newDeliveryId(): string {
  return randomUUID();
}

export interface DeliveryResult {
  status: "success" | "failed" | "dead";
  responseCode?: number;
  responseBody?: string;
  error?: string;
}

export async function performDelivery(job: DeliveryJobData): Promise<DeliveryResult> {
  const [wh] = await db.select().from(webhooks).where(eq(webhooks.id, job.webhookId));
  if (!wh) {
    return { status: "dead", error: "webhook not found" };
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({
    event: job.eventType,
    deliveryId: job.deliveryId,
    timestamp: new Date(timestamp * 1000).toISOString(),
    data: job.payload,
  });
  const signature = buildSignature(wh.secret, timestamp, job.deliveryId, body);

  let responseCode: number | undefined;
  let responseBody: string | undefined;
  let status: DeliveryResult["status"];
  let error: string | undefined;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

  try {
    const resp = await fetch(wh.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": `sha256=${signature}`,
        "X-Webhook-Timestamp": String(timestamp),
        "X-Webhook-Delivery-Id": job.deliveryId,
        "X-Webhook-Event": job.eventType,
        "User-Agent": "DriveAI-Webhooks/1.0",
      },
      body,
      signal: controller.signal,
    });
    responseCode = resp.status;
    responseBody = await resp.text().catch(() => "");
    status = resp.ok ? "success" : "failed";
  } catch (err) {
    status = "failed";
    error = err instanceof Error ? err.message : String(err);
    responseBody = `Delivery error: ${error}`;
  } finally {
    clearTimeout(timeout);
  }

  const maxAttempts = wh.maxRetries ?? DELIVERY_MAX_ATTEMPTS;
  if (status === "failed" && job.attempt >= maxAttempts) {
    status = "dead";
  }

  await db.insert(webhookDeliveries).values({
    webhookId: job.webhookId,
    eventType: job.eventType,
    payload: job.payload,
    status,
    responseCode,
    responseBody: responseBody?.slice(0, 2000),
    attempt: job.attempt,
  }).catch((err: unknown) =>
    logger.error("Failed to record webhook delivery", err as Error, { webhookId: job.webhookId, deliveryId: job.deliveryId }),
  );

  if (status === "success") {
    await db.update(webhooks)
      .set({ lastDeliveredAt: new Date() })
      .where(eq(webhooks.id, job.webhookId))
      .catch((err: unknown) => logger.error("Failed to update webhook timestamp", err as Error));
  }

  return { status, responseCode, responseBody, error };
}
