/**
 * BullMQ dashboard via @bull-board/express.
 * Mounted at /admin/queues (admin-only, behind auth).
 */
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { Queue } from "bullmq";
import type { Express } from "express";

const QUEUE_NAME = "adaptive-tasks";

export function mountBullBoard(app: Express, redisUrl: string): void {
  const url = new URL(redisUrl);
  const connection = {
    host: url.hostname,
    port: parseInt(url.port, 10) || 6379,
    ...(url.password && { password: url.password }),
    ...(url.protocol === "rediss:" && { tls: {} }),
  };

  const queue = new Queue(QUEUE_NAME, { connection });

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/admin/queues");

  createBullBoard({
    queues: [new BullMQAdapter(queue)],
    serverAdapter,
  });

  app.use("/admin/queues", serverAdapter.getRouter());
}
