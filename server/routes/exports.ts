/**
 * Export routes — CRUD + approval + download for export requests (Phase 4.1A).
 */
import type { Express } from "express";
import path from "path";
import { storage } from "../storage.js";
import { requireRole, requireAuth } from "../auth.js";
import { auditLog } from "../middleware/audit.js";
import { requireEntitlement } from "../entitlements/engine.js";
import { requireCapability } from "../capabilities/engine.js";
import { recordUsage, checkUsageCeiling } from "../metering/service.js";
import {
  validateExportParams,
  initialStatus,
  canRequestExport,
  requiresApproval,
  EXPORT_EXPIRY_HOURS,
  type ExportType,
  type ExportFormat,
} from "../exports/policy.js";
import { generateExport, getExportFilepath } from "../exports/generators.js";

export function registerExportRoutes(app: Express) {
  // ─── LIST EXPORT REQUESTS ───
  app.get(
    "/api/exports",
    requireRole("admin", "supervisor"),
    requireEntitlement("exports"),
    async (req, res, next) => {
      try {
        const user = req.user as Express.User;
        const filters: { status?: string; requestedBy?: number; exportType?: string } = {};
        if (typeof req.query.status === "string") filters.status = req.query.status;
        if (typeof req.query.exportType === "string") filters.exportType = req.query.exportType;
        // Non-admins only see their own requests
        if (user.role !== "admin") filters.requestedBy = user.id;
        const rows = await storage.getExportRequests(filters);
        res.json(rows);
      } catch (err) { next(err); }
    },
  );

  // ─── GET SINGLE EXPORT REQUEST ───
  app.get(
    "/api/exports/:id",
    requireRole("admin", "supervisor"),
    requireEntitlement("exports"),
    async (req, res, next) => {
      try {
        const user = req.user as Express.User;
        const row = await storage.getExportRequest(Number(req.params.id));
        if (!row) return res.status(404).json({ message: "Export request not found" });
        if (user.role !== "admin" && row.requestedBy !== user.id) {
          return res.status(403).json({ message: "Access denied" });
        }
        res.json(row);
      } catch (err) { next(err); }
    },
  );

  // ─── CREATE EXPORT REQUEST ───
  app.post(
    "/api/exports",
    requireRole("admin", "supervisor"),
    requireEntitlement("exports"),
    auditLog({ action: "export", entityType: "export_request" }),
    async (req, res, next) => {
      try {
        const user = req.user as Express.User;
        const { exportType, format = "csv", scope, filters } = req.body;

        const validationError = validateExportParams(exportType, format);
        if (validationError) return res.status(400).json({ message: validationError });

        // Ceiling check — fail fast if export quota exhausted
        const ceiling = await checkUsageCeiling("export_created");
        if (!ceiling.allowed) {
          return res.status(429).json({
            message: "Usage ceiling reached for exports",
            code: "CEILING_REACHED",
            current: ceiling.current,
            ceiling: ceiling.ceiling,
          });
        }

        if (!canRequestExport(exportType as ExportType, user.role)) {
          return res.status(403).json({ message: "Your role cannot request this export type" });
        }

        const status = initialStatus(exportType as ExportType);

        const row = await storage.createExportRequest({
          exportType,
          format,
          scope: scope || null,
          filters: filters || null,
          status,
          requestedBy: user.id,
        });

        // Auto-approved exports: trigger immediate generation
        if (status === "approved") {
          processExportInBackground(row.id);
        }

        recordUsage({ action: "export_created", userId: user.id, entityType: "export_request", entityId: String(row.id) });
        res.status(201).json(row);
      } catch (err) { next(err); }
    },
  );

  // ─── APPROVE EXPORT ───
  app.post(
    "/api/exports/:id/approve",
    requireAuth,
    requireCapability("export_approve"),
    requireEntitlement("advanced_exports"),
    auditLog({ action: "update", entityType: "export_request" }),
    async (req, res, next) => {
      try {
        const user = req.user as Express.User;
        const row = await storage.getExportRequest(Number(req.params.id));
        if (!row) return res.status(404).json({ message: "Export request not found" });
        if (row.status !== "pending_approval") {
          return res.status(409).json({ message: `Cannot approve export in status: ${row.status}` });
        }
        const updated = await storage.updateExportRequest(row.id, {
          status: "approved",
          approvedBy: user.id,
          approvalNote: req.body.note || null,
        });
        // Trigger generation
        processExportInBackground(row.id);
        recordUsage({ action: "advanced_export_approved", userId: user.id, entityType: "export_request", entityId: String(row.id) });
        res.json(updated);
      } catch (err) { next(err); }
    },
  );

  // ─── REJECT EXPORT ───
  app.post(
    "/api/exports/:id/reject",
    requireAuth,
    requireCapability("export_approve"),
    requireEntitlement("advanced_exports"),
    auditLog({ action: "update", entityType: "export_request" }),
    async (req, res, next) => {
      try {
        const user = req.user as Express.User;
        const row = await storage.getExportRequest(Number(req.params.id));
        if (!row) return res.status(404).json({ message: "Export request not found" });
        if (row.status !== "pending_approval") {
          return res.status(409).json({ message: `Cannot reject export in status: ${row.status}` });
        }
        const updated = await storage.updateExportRequest(row.id, {
          status: "rejected",
          approvedBy: user.id,
          approvalNote: req.body.note || null,
        });
        res.json(updated);
      } catch (err) { next(err); }
    },
  );

  // ─── DOWNLOAD EXPORT FILE ───
  app.get(
    "/api/exports/:id/download",
    requireRole("admin", "supervisor"),
    requireEntitlement("exports"),
    auditLog({ action: "export", entityType: "export_request" }),
    async (req, res, next) => {
      try {
        const user = req.user as Express.User;
        const row = await storage.getExportRequest(Number(req.params.id));
        if (!row) return res.status(404).json({ message: "Export request not found" });
        if (user.role !== "admin" && row.requestedBy !== user.id) {
          return res.status(403).json({ message: "Access denied" });
        }
        if (row.status !== "completed") {
          return res.status(409).json({ message: `Export is not ready: ${row.status}` });
        }
        if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
          return res.status(410).json({ message: "Export has expired" });
        }
        if (!row.storageKey) {
          return res.status(500).json({ message: "Export file missing" });
        }
        const filepath = await getExportFilepath(row.storageKey);
        if (!filepath) {
          return res.status(404).json({ message: "Export file not found on disk" });
        }
        res.setHeader("Content-Disposition", `attachment; filename="${row.filename || "export"}"`);
        res.setHeader("Content-Type", row.mimeType || "application/octet-stream");
        res.sendFile(filepath);
      } catch (err) { next(err); }
    },
  );
}

/**
 * Fire-and-forget background processing of a single export request.
 * The task-runner bulk processor handles queued jobs; this is for immediate processing.
 */
async function processExportInBackground(exportId: number) {
  try {
    const row = await storage.getExportRequest(exportId);
    if (!row || row.status !== "approved") return;

    await storage.updateExportRequest(exportId, { status: "processing" });

    const result = await generateExport(
      row.exportType as ExportType,
      (row.format || "csv") as ExportFormat,
      (row.filters as Record<string, unknown>) || undefined,
    );

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + EXPORT_EXPIRY_HOURS);

    await storage.updateExportRequest(exportId, {
      status: "completed",
      storageKey: result.storageKey,
      filename: result.filename,
      mimeType: result.mimeType,
      rowCount: result.rowCount,
      expiresAt,
      completedAt: new Date(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await storage.updateExportRequest(exportId, {
      status: "failed",
      error: message.slice(0, 2000),
    }).catch(() => {});
  }
}

// Exported for task-runner integration
export { processExportInBackground };
