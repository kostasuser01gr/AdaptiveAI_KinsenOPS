/**
 * Workshop integration routes — external workshop job linkage (Phase 4.2B).
 *
 * Hardened (Phase 4.2B-H):
 * - Non-regressive workshop status transitions
 * - Repair order sync respects REPAIR_ORDER_TRANSITIONS state machine
 * - Station-scoped reads for non-admin users
 * - Idempotent linkage
 * - Clear behavior when repair order doesn't exist
 */
import type { Express } from "express";
import { z } from "zod/v4";
import { timingSafeEqual } from "crypto";
import { storage } from "../storage.js";
import { requireAuth, requireRole } from "../auth.js";
import { auditLog, AUDIT_ACTIONS } from "../middleware/audit.js";
import { webhookLimiter } from "../middleware/rate-limiter.js";
import { wsManager } from "../websocket.js";
import {
  normalizeWorkshopStatus,
  WORKSHOP_TO_REPAIR_ORDER_STATUS,
  isValidWorkshopTransition,
} from "../telematics/normalizer.js";
import { REPAIR_ORDER_TRANSITIONS } from "./_helpers.js";
import { resolveStationScope } from "../middleware/stationScope.js";
import { insertWorkshopJobSchema } from "../../shared/schema.js";
import { logger } from "../observability/logger.js";
import { runWithWorkspace } from "../middleware/workspaceContext.js";

// ─── Validation schemas ───

const workshopJobPatchSchema = z.object({
  externalStatus: z.string().optional(),
  normalizedStatus: z.string().optional(),
  estimateAmount: z.number().optional(),
  invoiceRef: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  workshopName: z.string().optional(),
}).strict();

const workshopWebhookSchema = z.object({
  connectorToken: z.string().min(1),
  jobs: z.array(z.object({
    externalJobId: z.string().min(1),
    workshopName: z.string().min(1),
    externalStatus: z.string().optional(),
    repairOrderId: z.number().int().positive().optional(),
    estimateAmount: z.number().optional(),
    invoiceRef: z.string().optional(),
    notes: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })).min(1).max(100),
});

export function registerWorkshopRoutes(app: Express) {
  // ─── List workshop jobs (station-scoped via repair order → vehicle chain) ───
  app.get("/api/workshop-jobs", requireAuth, async (req, res, next) => {
    try {
      const filters: Parameters<typeof storage.getWorkshopJobs>[0] = {};
      if (req.query.repairOrderId) filters.repairOrderId = Number(req.query.repairOrderId);
      if (req.query.connectorId) filters.connectorId = Number(req.query.connectorId);
      if (req.query.normalizedStatus) filters.normalizedStatus = String(req.query.normalizedStatus);
      if (req.query.limit) filters.limit = Math.min(Number(req.query.limit), 200);

      let jobs = await storage.getWorkshopJobs(filters);

      // Station scope: non-admin users only see jobs linked to their station's vehicles
      const scope = await resolveStationScope(req.user!);
      if (scope === "none") return res.json([]);
      if (scope !== null) {
        const vehicles = await storage.getVehicles();
        const stationVehicleIds = new Set(
          vehicles.filter((v: any) => v.stationId !== null && scope.includes(v.stationId)).map((v: any) => v.id),
        );
        // Need to check repair orders to find vehicle linkage
        const filteredJobs = [];
        for (const job of jobs) {
          if (!job.repairOrderId) continue; // unlinked jobs not visible to station users
          const ro = await storage.getRepairOrder(job.repairOrderId);
          if (ro && stationVehicleIds.has((ro as any).vehicleId)) {
            filteredJobs.push(job);
          }
        }
        jobs = filteredJobs;
      }

      return res.json(jobs);
    } catch (err) {
      next(err);
    }
  });

  // ─── Get single workshop job (station-scoped) ───
  app.get("/api/workshop-jobs/:id", requireAuth, async (req, res, next) => {
    try {
      const job = await storage.getWorkshopJob(Number(req.params.id));
      if (!job) return res.status(404).json({ message: "Workshop job not found" });

      // Station scope
      const scope = await resolveStationScope(req.user!);
      if (scope === "none") return res.status(404).json({ message: "Workshop job not found" });
      if (scope !== null && job.repairOrderId) {
        const ro = await storage.getRepairOrder(job.repairOrderId);
        if (!ro) return res.status(404).json({ message: "Workshop job not found" });
        const vehicle = await storage.getVehicle((ro as any).vehicleId);
        if (!vehicle || (vehicle as any).stationId === null || !scope.includes((vehicle as any).stationId)) {
          return res.status(404).json({ message: "Workshop job not found" });
        }
      } else if (scope !== null && !job.repairOrderId) {
        // Unlinked jobs not visible to station-scoped users
        return res.status(404).json({ message: "Workshop job not found" });
      }

      return res.json(job);
    } catch (err) {
      next(err);
    }
  });

  // ─── Create workshop job (authenticated) ───
  app.post(
    "/api/workshop-jobs",
    requireAuth,
    requireRole("admin", "supervisor"),
    auditLog({ action: AUDIT_ACTIONS.CREATE, entityType: "workshop_job" }),
    async (req, res, next) => {
      try {
        const data = insertWorkshopJobSchema.parse(req.body);
        const normalizedStatus = data.externalStatus
          ? normalizeWorkshopStatus(data.externalStatus)
          : (data.normalizedStatus ?? "pending");

        const job = await storage.upsertWorkshopJob({
          ...data,
          normalizedStatus,
        });

        wsManager.broadcast({
          type: "workshop_job:created",
          data: job,
          channel: "workshop",
        });

        return res.status(201).json(job);
      } catch (err) {
        next(err);
      }
    },
  );

  // ─── Update workshop job ───
  app.patch(
    "/api/workshop-jobs/:id",
    requireAuth,
    requireRole("admin", "supervisor"),
    auditLog({ action: AUDIT_ACTIONS.UPDATE, entityType: "workshop_job" }),
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        const existing = await storage.getWorkshopJob(id);
        if (!existing) return res.status(404).json({ message: "Workshop job not found" });

        const patch = workshopJobPatchSchema.parse(req.body);

        // Auto-normalize external status
        const updateData: Record<string, unknown> = { ...patch };
        if (patch.externalStatus) {
          updateData.normalizedStatus = normalizeWorkshopStatus(patch.externalStatus);
        }

        // Enforce non-regressive workshop status transitions
        const newNormStatus = updateData.normalizedStatus as string | undefined;
        if (newNormStatus && existing.normalizedStatus) {
          if (!isValidWorkshopTransition(existing.normalizedStatus, newNormStatus)) {
            return res.status(409).json({
              message: `Cannot transition workshop job from "${existing.normalizedStatus}" to "${newNormStatus}"`,
            });
          }
        }

        const updated = await storage.updateWorkshopJob(id, updateData as any);

        // If linked to a repair order, sync status
        if (updated && updated.repairOrderId && updateData.normalizedStatus) {
          const roStatus = WORKSHOP_TO_REPAIR_ORDER_STATUS[String(updateData.normalizedStatus)];
          if (roStatus) {
            await syncRepairOrderStatus(updated.repairOrderId, roStatus);
          }
        }

        wsManager.broadcast({
          type: "workshop_job:updated",
          data: updated,
          channel: "workshop",
        });

        return res.json(updated);
      } catch (err) {
        next(err);
      }
    },
  );

  // ─── Link workshop job to repair order ───
  app.post(
    "/api/workshop-jobs/:id/link-repair-order",
    requireAuth,
    requireRole("admin", "supervisor"),
    auditLog({ action: AUDIT_ACTIONS.UPDATE, entityType: "workshop_job" }),
    async (req, res, next) => {
      try {
        const id = Number(req.params.id);
        const { repairOrderId } = z.object({ repairOrderId: z.number().int().positive() }).parse(req.body);

        const existing = await storage.getWorkshopJob(id);
        if (!existing) return res.status(404).json({ message: "Workshop job not found" });

        // Validate repair order exists
        const ro = await storage.getRepairOrder(repairOrderId);
        if (!ro) return res.status(404).json({ message: "Repair order not found" });

        // Idempotent: if already linked to same repair order, return as-is
        if (existing.repairOrderId === repairOrderId) return res.json(existing);

        const updated = await storage.linkWorkshopJobToRepairOrder(id, repairOrderId);
        return res.json(updated);
      } catch (err) {
        next(err);
      }
    },
  );

  // ─── Workshop webhook ingestion (token-based, no session) ───
  app.post("/api/webhooks/workshop", webhookLimiter, async (req, res, next) => {
    try {
      const { connectorToken, jobs } = workshopWebhookSchema.parse(req.body);

      // Validate connector token (unscoped — token IS the identity)
      const allConnectors = await storage.getIntegrationConnectorsUnscoped("webhook");
      const connector = allConnectors.find((c) => {
        const cfg = c.config as Record<string, unknown>;
        const stored = String(cfg.webhookToken ?? "");
        if (stored.length !== connectorToken.length) return false;
        return timingSafeEqual(Buffer.from(stored), Buffer.from(connectorToken));
      });
      if (!connector) return res.status(401).json({ message: "Invalid connector token" });
      if (connector.status !== "active") return res.status(409).json({ message: "Connector is not active" });

      await runWithWorkspace(connector.workspaceId, async () => {

      const synced: number[] = [];
      const skipped: { externalJobId: string; reason: string }[] = [];

      // Pre-fetch all existing jobs for this connector (avoids N+1 inside loop)
      const existingJobsList = await storage.getWorkshopJobs({ connectorId: connector.id });
      const existingJobsByExternalId = new Map(
        existingJobsList
          .filter((j) => j.externalJobId)
          .map((j) => [j.externalJobId, j]),
      );

      for (const jobData of jobs) {
        const normalizedStatus = normalizeWorkshopStatus(jobData.externalStatus);

        // Check if existing job has a non-regressive status
        const existingJob = existingJobsByExternalId.get(jobData.externalJobId);

        if (existingJob && existingJob.normalizedStatus) {
          if (!isValidWorkshopTransition(existingJob.normalizedStatus, normalizedStatus) && existingJob.normalizedStatus !== normalizedStatus) {
            skipped.push({ externalJobId: jobData.externalJobId, reason: `Cannot regress from "${existingJob.normalizedStatus}" to "${normalizedStatus}"` });
            continue;
          }
        }

        const job = await storage.upsertWorkshopJob({
          connectorId: connector.id,
          externalJobId: jobData.externalJobId,
          workshopName: jobData.workshopName,
          externalStatus: jobData.externalStatus ?? null,
          normalizedStatus,
          repairOrderId: jobData.repairOrderId ?? null,
          estimateAmount: jobData.estimateAmount ?? null,
          invoiceRef: jobData.invoiceRef ?? null,
          notes: jobData.notes ?? null,
          metadata: jobData.metadata ?? null,
        });

        // Sync repair order status if linked
        if (job.repairOrderId) {
          const roStatus = WORKSHOP_TO_REPAIR_ORDER_STATUS[normalizedStatus];
          if (roStatus) {
            await syncRepairOrderStatus(job.repairOrderId, roStatus);
          }
        }

        synced.push(job.id);
      }

      if (synced.length > 0) {
        wsManager.broadcast({
          type: "workshop_jobs:synced",
          data: { count: synced.length, connectorId: connector.id },
          channel: "workshop",
        });
      }

      logger.info("Workshop webhook processed", {
        connectorId: connector.id,
        synced: synced.length,
        skipped: skipped.length,
      });

      return res.json({
        synced: synced.length,
        skipped: skipped.length,
        skippedDetails: skipped.length > 0 ? skipped : undefined,
      });

      }); // end runWithWorkspace
    } catch (err) {
      next(err);
    }
  });

  // ─── Get workshop jobs for a repair order ───
  app.get("/api/repair-orders/:id/workshop-jobs", requireAuth, async (req, res, next) => {
    try {
      const repairOrderId = Number(req.params.id);
      const jobs = await storage.getWorkshopJobs({ repairOrderId });
      return res.json(jobs);
    } catch (err) {
      next(err);
    }
  });
}

// ─── Helper: sync workshop status → repair order (with state machine guard) ───
async function syncRepairOrderStatus(repairOrderId: number, targetStatus: string) {
  try {
    const ro = await storage.getRepairOrder(repairOrderId);
    if (!ro) {
      logger.error("Workshop sync: repair order not found", undefined, { repairOrderId });
      return;
    }
    // Don't set same status (idempotent)
    if (ro.status === targetStatus) return;
    // Validate transition against repair order state machine
    const allowed = REPAIR_ORDER_TRANSITIONS[ro.status];
    if (!allowed || !allowed.includes(targetStatus)) {
      logger.error("Workshop sync: invalid repair order transition", undefined, {
        repairOrderId,
        from: ro.status,
        to: targetStatus,
      });
      return;
    }

    await storage.updateRepairOrder(repairOrderId, { status: targetStatus } as any);

    // Create notification for status sync
    await storage.createNotification({
      type: "workshop_sync",
      severity: "info",
      title: "Workshop status synced",
      body: `Repair order #${repairOrderId} status updated to "${targetStatus}" from workshop`,
      audience: "role",
      recipientRole: "admin",
      sourceEntityType: "repair_order",
      sourceEntityId: String(repairOrderId),
    });
  } catch {
    // Non-critical — don't fail the webhook
  }
}
