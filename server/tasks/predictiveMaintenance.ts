/**
 * Predictive maintenance scoring task.
 *
 * Scores each active vehicle on a 0–100 risk scale from mileage, recent
 * evidence frequency (damage/wear reports), and prolonged "maintenance" status.
 * Vehicles above the warn/critical thresholds surface as anomalies of type
 * `predictive_maintenance` — these feed the Ops Inbox so supervisors can
 * triage proactively rather than reactively.
 *
 * One anomaly per vehicle is kept open at a time: re-runs update the existing
 * open anomaly rather than stacking duplicates.
 */

import { storage } from "../storage.js";
import { logger } from "../observability/logger.js";
import type { TaskDefinition } from "./types.js";
import type { Vehicle, VehicleEvidence } from "@shared/schema";

const EVIDENCE_LOOKBACK_DAYS = 90;
const WARN_THRESHOLD = 50;
const CRITICAL_THRESHOLD = 75;
const MAX_VEHICLES_PER_RUN = 500;

interface VehicleScore {
  vehicleId: number;
  plate: string;
  total: number;
  breakdown: {
    mileage: number;
    evidence: number;
    severeEvidence: number;
    prolongedMaintenance: number;
  };
  reasons: string[];
}

function scoreVehicle(vehicle: Vehicle, evidence: VehicleEvidence[]): VehicleScore {
  const cutoff = Date.now() - EVIDENCE_LOOKBACK_DAYS * 86_400_000;
  const recent = evidence.filter((e) => new Date(e.createdAt).getTime() > cutoff);
  const severe = recent.filter((e) => e.severity === "high" || e.severity === "critical");

  const mileageScore = Math.min(Math.floor((vehicle.mileage ?? 0) / 1500), 40);
  const evidenceScore = Math.min(recent.length * 8, 30);
  const severeEvidenceScore = Math.min(severe.length * 15, 30);

  // Prolonged-maintenance: vehicle sitting in "maintenance" state is itself a signal.
  // No authoritative stateChangedAt column, so we take the presence of the state as a
  // +10 nudge (not a dominant factor).
  const prolongedMaintenance = vehicle.status === "maintenance" ? 10 : 0;

  const total = Math.min(mileageScore + evidenceScore + severeEvidenceScore + prolongedMaintenance, 100);

  const reasons: string[] = [];
  if (mileageScore >= 20) reasons.push(`high mileage (${vehicle.mileage} km)`);
  if (severe.length > 0) reasons.push(`${severe.length} severe damage report${severe.length === 1 ? "" : "s"}`);
  if (recent.length >= 3) reasons.push(`${recent.length} evidence items in ${EVIDENCE_LOOKBACK_DAYS}d`);
  if (prolongedMaintenance > 0) reasons.push("currently in maintenance");

  return {
    vehicleId: vehicle.id,
    plate: vehicle.plate,
    total,
    breakdown: { mileage: mileageScore, evidence: evidenceScore, severeEvidence: severeEvidenceScore, prolongedMaintenance },
    reasons,
  };
}

export const predictiveMaintenanceTask: TaskDefinition = {
  id: "predictive-maintenance",
  description: "Score fleet by mileage, damage history, and state; flag high-risk vehicles as anomalies",
  intervalMs: 6 * 3600_000, // every 6 hours
  timeoutMs: 2 * 60_000,
  jitterMs: 5 * 60_000,
  enabled: true,
  runOnStart: false,
  allowManualTrigger: true,

  async run() {
    const vehicles = await storage.getVehicles();
    const scannable = vehicles.filter((v) => v.status !== "retired").slice(0, MAX_VEHICLES_PER_RUN);

    const existingOpen = await storage.getAnomalies({ type: "predictive_maintenance", status: "open" });
    const openByVehicle = new Map(existingOpen.map((a) => [a.entityId, a] as const));

    let created = 0;
    let updated = 0;
    let cleared = 0;

    for (const vehicle of scannable) {
      const evidence = await storage.getVehicleEvidence(vehicle.id);
      const score = scoreVehicle(vehicle, evidence);
      const existing = openByVehicle.get(String(vehicle.id));

      const severity: "warning" | "critical" | null =
        score.total >= CRITICAL_THRESHOLD ? "critical" :
        score.total >= WARN_THRESHOLD ? "warning" : null;

      if (!severity) {
        if (existing) {
          await storage.updateAnomaly(existing.id, { status: "resolved" });
          cleared++;
        }
        continue;
      }

      const title = `${vehicle.plate} — predictive maintenance risk ${score.total}/100`;
      const description = `Risk ${score.total}/100 (${severity}). Factors: ${score.reasons.join("; ") || "baseline"}.`;

      if (existing) {
        await storage.updateAnomaly(existing.id, {
          severity,
          title,
          description,
          metadata: { score: score.total, breakdown: score.breakdown, reasons: score.reasons },
        });
        updated++;
      } else {
        await storage.createAnomaly({
          type: "predictive_maintenance",
          severity,
          title,
          description,
          entityType: "vehicle",
          entityId: String(vehicle.id),
          stationId: vehicle.stationId,
          status: "open",
          metadata: { score: score.total, breakdown: score.breakdown, reasons: score.reasons },
        });
        if (severity === "critical") {
          await storage.createNotification({
            type: "anomaly",
            severity: "critical",
            title,
            body: description,
            audience: "role",
            recipientRole: "supervisor",
            sourceEntityType: "anomaly",
          });
        }
        created++;
      }
    }

    if (created + updated + cleared > 0) {
      logger.info("Predictive maintenance scan complete", {
        scanned: scannable.length,
        created,
        updated,
        cleared,
      });
    }
  },
};
