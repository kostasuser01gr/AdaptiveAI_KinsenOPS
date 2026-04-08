/**
 * Anomaly detection task.
 *
 * Logic extracted from POST /api/anomalies/detect.
 * Enabled=false by default — admins can enable when they want periodic detection.
 */

import { storage } from "../storage.js";
import { logger } from "../observability/logger.js";
import type { TaskDefinition } from "./types.js";

export const anomalyDetectionTask: TaskDefinition = {
  id: "anomaly-detection",
  description: "Detect wash stagnation, repeated damage, and notification spikes",
  intervalMs: 15 * 60_000, // 15 minutes
  timeoutMs: 60_000,
  jitterMs: 30_000,
  enabled: false, // opt-in — currently request-triggered only
  runOnStart: false,
  allowManualTrigger: true,

  async run() {
    let detectedCount = 0;
    const existingOpen = await storage.getAnomalies({ status: "open" });

    // 1. Wash stagnation — pending items > 4 hours, 3+
    const washItems = await storage.getWashQueue();
    const stagnant = washItems.filter(
      (w) => w.status === "pending" && Date.now() - new Date(w.createdAt).getTime() > 4 * 3_600_000,
    );
    if (stagnant.length >= 3) {
      const alreadyExists = existingOpen.some((a) => a.type === "wash_stagnation");
      if (!alreadyExists) {
        await storage.createAnomaly({
          type: "wash_stagnation",
          severity: stagnant.length >= 5 ? "critical" : "warning",
          title: `${stagnant.length} wash items stagnant for 4+ hours`,
          description: `Vehicles: ${stagnant.slice(0, 5).map((w) => w.vehiclePlate).join(", ")}`,
          entityType: "wash_queue",
          status: "open",
        });
        await storage.createNotification({
          type: "anomaly",
          severity: stagnant.length >= 5 ? "critical" : "warning",
          title: `${stagnant.length} wash items stagnant for 4+ hours`,
          body: `Vehicles: ${stagnant.slice(0, 5).map((w) => w.vehiclePlate).join(", ")}`,
          audience: "role",
          recipientRole: "supervisor",
          sourceEntityType: "anomaly",
        });
        detectedCount++;
      }
    }

    // 2. Repeated damage — 3+ evidence items in 7 days
    const allVehicles = await storage.getVehicles();
    const sevenDaysAgo = Date.now() - 7 * 86_400_000;
    for (const v of allVehicles.slice(0, 200)) {
      const alreadyExists = existingOpen.some((a) => a.type === "repeated_damage" && a.entityId === String(v.id));
      if (alreadyExists) continue;
      const evidence = await storage.getVehicleEvidence(v.id);
      const recent = evidence.filter((e) => new Date(e.createdAt).getTime() > sevenDaysAgo);
      if (recent.length >= 3) {
        await storage.createAnomaly({
          type: "repeated_damage",
          severity: recent.length >= 5 ? "critical" : "warning",
          title: `Vehicle ${v.plate} has ${recent.length} evidence items in 7 days`,
          description: `${recent.length} damage/evidence items logged recently for vehicle ${v.plate} (${v.model})`,
          entityType: "vehicle",
          entityId: String(v.id),
          stationId: v.stationId,
          status: "open",
        });
        detectedCount++;
      }
    }

    // 3. Notification spike — >20 in 1 hour
    const allNotifs = await storage.getNotifications(0, "admin");
    const oneHourAgo = Date.now() - 3_600_000;
    const recentNotifs = allNotifs.filter((n) => new Date(n.createdAt).getTime() > oneHourAgo);
    if (recentNotifs.length > 20) {
      const alreadyExists = existingOpen.some((a) => a.type === "notification_spike");
      if (!alreadyExists) {
        await storage.createAnomaly({
          type: "notification_spike",
          severity: recentNotifs.length > 50 ? "critical" : "warning",
          title: `Notification spike: ${recentNotifs.length} in last hour`,
          description: `Unusually high notification volume detected. Top types: ${[...new Set(recentNotifs.map((n) => n.type))].slice(0, 3).join(", ")}`,
          entityType: "notification",
          status: "open",
        });
        detectedCount++;
      }
    }

    if (detectedCount > 0) {
      logger.info("Anomalies detected", { count: detectedCount });
    }
  },
};
