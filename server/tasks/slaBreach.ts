/**
 * SLA Breach detection task.
 *
 * Migrated from ad-hoc setInterval in server/index.ts.
 * Checks for overdue wash-queue items every 60 s, escalates and notifies.
 */

import { storage } from "../storage.js";
import { wsManager } from "../websocket.js";
import { logger } from "../observability/logger.js";
import type { TaskDefinition } from "./types.js";

export const slaBreachTask: TaskDefinition = {
  id: "sla-breach-check",
  description: "Detect overdue wash-queue items and broadcast SLA breach notifications",
  intervalMs: 60_000,
  timeoutMs: 30_000,
  jitterMs: 5_000,
  runOnStart: false,
  allowManualTrigger: true,

  async run() {
    const overdue = await storage.getOverdueWashItems();
    for (const item of overdue) {
      if (item.slaInfo === "escalated") continue;

      await storage.updateWashQueueItem(item.id, { slaInfo: "escalated" } as any);

      const notif = await storage.createNotification({
        type: "sla_breach",
        severity: item.priority === "High" ? "critical" : "warning",
        title: `SLA Breach: ${item.vehiclePlate}`,
        body: `Wash queue item for ${item.vehiclePlate} (${item.washType}) has exceeded its SLA deadline.`,
        audience: "broadcast",
        sourceEntityType: "wash_queue",
        sourceEntityId: String(item.id),
        metadata: {
          vehiclePlate: item.vehiclePlate,
          washType: item.washType,
          priority: item.priority,
        },
      });

      wsManager.broadcast({
        type: "sla:breach",
        data: { washItem: item, notification: notif },
        channel: "notifications",
      });

      logger.warn("SLA breach detected", {
        washQueueId: item.id,
        vehiclePlate: item.vehiclePlate,
      });
    }
  },
};
