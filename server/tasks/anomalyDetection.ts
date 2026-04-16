/**
 * Anomaly detection task.
 *
 * Rules:
 *   1. wash_stagnation      — pending washes past threshold
 *   2. repeated_damage      — vehicles with 3+ evidence items in lookback
 *   3. notification_spike   — notification volume above threshold
 *   4. import_stall         — data imports stuck in processing/mapping state
 *   5. sla_breach_spike     — wash items breaching SLA today vs. 7-day baseline
 *   6. damage_hotspot       — severe evidence concentrated at a single station
 */

import { storage } from "../storage.js";
import { logger } from "../observability/logger.js";
import { configResolver } from "../config/resolver.js";
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

    // Load configurable thresholds
    const [lookbackDays, spikeWindowMs, washStagnationHours, notifSpikeThreshold] = await Promise.all([
      configResolver.getNumber("operational.anomaly_lookback_days"),
      configResolver.getNumber("operational.anomaly_recent_window_minutes").then(m => m * 60_000),
      configResolver.getNumber("operational.wash_stagnation_hours"),
      configResolver.getNumber("operational.notification_spike_threshold"),
    ]);

    // 1. Wash stagnation — pending items > configured hours, 3+
    const washItems = await storage.getWashQueue();
    const stagnant = washItems.filter(
      (w) => w.status === "pending" && Date.now() - new Date(w.createdAt).getTime() > washStagnationHours * 3_600_000,
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

    // 2. Repeated damage — 3+ evidence items in lookback window
    const allVehicles = await storage.getVehicles();
    const lookbackCutoff = Date.now() - lookbackDays * 86_400_000;
    for (const v of allVehicles.slice(0, 200)) {
      const alreadyExists = existingOpen.some((a) => a.type === "repeated_damage" && a.entityId === String(v.id));
      if (alreadyExists) continue;
      const evidence = await storage.getVehicleEvidence(v.id);
      const recent = evidence.filter((e) => new Date(e.createdAt).getTime() > lookbackCutoff);
      if (recent.length >= 3) {
        await storage.createAnomaly({
          type: "repeated_damage",
          severity: recent.length >= 5 ? "critical" : "warning",
          title: `Vehicle ${v.plate} has ${recent.length} evidence items in ${lookbackDays} days`,
          description: `${recent.length} damage/evidence items logged recently for vehicle ${v.plate} (${v.model})`,
          entityType: "vehicle",
          entityId: String(v.id),
          stationId: v.stationId,
          status: "open",
        });
        detectedCount++;
      }
    }

    // 3. Notification spike — >threshold in configured window
    const allNotifs = await storage.getNotifications(0, "admin");
    const windowCutoff = Date.now() - spikeWindowMs;
    const recentNotifs = allNotifs.filter((n) => new Date(n.createdAt).getTime() > windowCutoff);
    if (recentNotifs.length > notifSpikeThreshold) {
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

    // 4. Import stall — any import stuck in processing/mapping > 30 minutes
    const imports = await storage.getImports();
    const stallCutoff = Date.now() - 30 * 60_000;
    const stalled = imports.filter(
      (i) => (i.status === "processing" || i.status === "mapping") && new Date(i.createdAt).getTime() < stallCutoff,
    );
    if (stalled.length > 0) {
      for (const imp of stalled) {
        const alreadyExists = existingOpen.some((a) => a.type === "import_stall" && a.entityId === String(imp.id));
        if (alreadyExists) continue;
        await storage.createAnomaly({
          type: "import_stall",
          severity: "warning",
          title: `Import "${imp.filename}" stalled in ${imp.status}`,
          description: `Started ${new Date(imp.createdAt).toISOString()} — no progress for 30+ minutes.`,
          entityType: "import",
          entityId: String(imp.id),
          status: "open",
        });
        detectedCount++;
      }
    }

    // 5. SLA-breach spike — today's breached wash items vs. 7-day daily average
    const now = Date.now();
    const breaches = washItems.filter((w) => w.slaDeadline && new Date(w.slaDeadline).getTime() < now && w.status !== "completed");
    const breachesToday = breaches.filter((w) => now - new Date(w.createdAt).getTime() < 86_400_000);
    const breachesPrior7d = breaches.filter((w) => {
      const age = now - new Date(w.createdAt).getTime();
      return age >= 86_400_000 && age < 8 * 86_400_000;
    });
    const baselinePerDay = breachesPrior7d.length / 7;
    if (breachesToday.length >= 5 && breachesToday.length > baselinePerDay * 2) {
      const alreadyExists = existingOpen.some((a) => a.type === "sla_breach_spike");
      if (!alreadyExists) {
        await storage.createAnomaly({
          type: "sla_breach_spike",
          severity: breachesToday.length >= 15 ? "critical" : "warning",
          title: `SLA breach spike: ${breachesToday.length} today (baseline ${baselinePerDay.toFixed(1)}/day)`,
          description: `Today's wash-SLA breaches (${breachesToday.length}) are >2× the 7-day baseline. Investigate staffing and assignment.`,
          entityType: "wash_queue",
          status: "open",
        });
        await storage.createNotification({
          type: "anomaly",
          severity: "warning",
          title: `SLA breach spike: ${breachesToday.length} today`,
          body: `Today's wash-SLA breaches are >2× the 7-day baseline of ${baselinePerDay.toFixed(1)}/day.`,
          audience: "role",
          recipientRole: "supervisor",
          sourceEntityType: "anomaly",
        });
        detectedCount++;
      }
    }

    // 6. Damage hotspot — severe evidence concentrated at a single station in last 7d
    const hotspotCutoff = Date.now() - 7 * 86_400_000;
    const severePerStation = new Map<number, number>();
    for (const v of allVehicles.slice(0, 200)) {
      if (v.stationId == null) continue;
      const evidence = await storage.getVehicleEvidence(v.id);
      const severe = evidence.filter(
        (e) => (e.severity === "high" || e.severity === "critical") && new Date(e.createdAt).getTime() > hotspotCutoff,
      );
      if (severe.length > 0) {
        severePerStation.set(v.stationId, (severePerStation.get(v.stationId) ?? 0) + severe.length);
      }
    }
    for (const [stationId, count] of severePerStation) {
      if (count < 10) continue;
      const alreadyExists = existingOpen.some(
        (a) => a.type === "damage_hotspot" && a.stationId === stationId,
      );
      if (alreadyExists) continue;
      await storage.createAnomaly({
        type: "damage_hotspot",
        severity: count >= 20 ? "critical" : "warning",
        title: `Damage hotspot: station ${stationId} — ${count} severe evidence items in 7d`,
        description: `Station ${stationId} has ${count} severe/critical evidence items logged in the last 7 days. Consider inspection-process audit.`,
        entityType: "station",
        entityId: String(stationId),
        stationId,
        status: "open",
      });
      detectedCount++;
    }

    if (detectedCount > 0) {
      logger.info("Anomalies detected", { count: detectedCount });
    }
  },
};
