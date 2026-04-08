/**
 * KPI Snapshot batch task.
 *
 * The snapshot computation logic is re-used from the existing POST /api/kpi/snapshot handler.
 * Enabled=false by default — admins can enable via the task system when they want periodic snapshots.
 */

import { storage } from "../storage.js";
import { logger } from "../observability/logger.js";
import type { TaskDefinition } from "./types.js";

export const kpiSnapshotsTask: TaskDefinition = {
  id: "kpi-snapshots",
  description: "Compute and store daily KPI snapshots (fleet utilization, availability, SLA attainment)",
  intervalMs: 4 * 3_600_000, // 4 hours
  timeoutMs: 60_000,
  jitterMs: 30_000,
  enabled: false, // opt-in — currently request-triggered only
  runOnStart: false,
  allowManualTrigger: true,

  async run() {
    const today = new Date().toISOString().slice(0, 10);
    const allVehicles = await storage.getVehicles();
    const allWash = await storage.getWashQueue();
    const totalVehicles = allVehicles.length;
    const maintenanceVehicles = allVehicles.filter((v) => v.status === "maintenance").length;
    const completedWashes = allWash.filter((w) => w.status === "completed");
    const withinSla = completedWashes.filter((w) => {
      if (!w.slaDeadline || !w.completedAt) return true;
      return new Date(w.completedAt) <= new Date(w.slaDeadline);
    });
    const activeVehicles = allVehicles.filter((v) => v.status === "rented" || v.status === "washing").length;

    const snaps = [
      { kpiSlug: "fleet_utilization", value: totalVehicles > 0 ? (activeVehicles / totalVehicles) * 100 : 0, date: today },
      { kpiSlug: "fleet_availability", value: totalVehicles > 0 ? ((totalVehicles - maintenanceVehicles) / totalVehicles) * 100 : 0, date: today },
      { kpiSlug: "wash_sla_attainment", value: completedWashes.length > 0 ? (withinSla.length / completedWashes.length) * 100 : 100, date: today },
    ];

    for (const s of snaps) {
      await storage.createKpiSnapshot(s);
    }

    logger.info("KPI snapshots created", { date: today, count: snaps.length });
  },
};
