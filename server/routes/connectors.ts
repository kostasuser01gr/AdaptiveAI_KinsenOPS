import type { Express } from "express";
import { z } from "zod/v4";
import { timingSafeEqual } from "crypto";
import { storage } from "../storage.js";
import { requireAuth } from "../auth.js";
import { auditLog, AUDIT_ACTIONS } from "../middleware/audit.js";
import { requireEntitlement } from "../entitlements/engine.js";
import { requireCapability } from "../capabilities/engine.js";
import { redactConnectorConfig } from "./_helpers.js";
import { recordUsage, checkUsageCeiling } from "../metering/service.js";
import { insertIntegrationConnectorSchema } from "../../shared/schema.js";
import { runWithWorkspace } from "../middleware/workspaceContext.js";
import { webhookLimiter } from "../middleware/rate-limiter.js";

export function registerConnectorRoutes(app: Express) {
  const connectorPatchSchema = z.object({
    name: z.string().optional(),
    type: z.string().optional(),
    direction: z.string().optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    status: z.enum(["active", "paused", "error", "disabled"]).optional(),
  }).strict();

  app.get("/api/connectors", requireAuth, requireCapability("connector_manage"), requireEntitlement("connector_sync"), async (req, res, next) => {
    try {
      const type = req.query.type ? String(req.query.type) : undefined;
      const connectors = await storage.getIntegrationConnectors(type);
      res.json(connectors.map(c => ({ ...c, config: redactConnectorConfig(c.config) })));
    } catch (e) { next(e); }
  });

  app.get("/api/connectors/:id", requireAuth, requireCapability("connector_manage"), requireEntitlement("connector_sync"), async (req, res, next) => {
    try {
      const c = await storage.getIntegrationConnector(Number(req.params.id));
      if (!c) return res.status(404).json({ message: "Not found" });
      res.json({ ...c, config: redactConnectorConfig(c.config) });
    } catch (e) { next(e); }
  });

  app.post("/api/connectors", requireAuth, requireCapability("connector_manage"), requireEntitlement("connector_sync"), auditLog({ action: AUDIT_ACTIONS.CREATE, entityType: 'connector' }), async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const data = insertIntegrationConnectorSchema.parse({ ...req.body, createdBy: userId });
      res.status(201).json(await storage.createIntegrationConnector(data));
    } catch (e) { next(e); }
  });

  app.patch("/api/connectors/:id", requireAuth, requireCapability("connector_manage"), requireEntitlement("connector_sync"), auditLog({ action: AUDIT_ACTIONS.UPDATE, entityType: 'connector' }), async (req, res, next) => {
    try {
      const existing = await storage.getIntegrationConnector(Number(req.params.id));
      if (!existing) return res.status(404).json({ message: "Not found" });
      const data = connectorPatchSchema.parse(req.body);
      const c = await storage.updateIntegrationConnector(Number(req.params.id), data);
      if (!c) return res.status(404).json({ message: "Not found" });
      res.json({ ...c, config: redactConnectorConfig(c.config) });
    } catch (e) { next(e); }
  });

  app.delete("/api/connectors/:id", requireAuth, requireCapability("connector_manage"), requireEntitlement("connector_sync"), auditLog({ action: AUDIT_ACTIONS.DELETE, entityType: 'connector' }), async (req, res, next) => {
    try {
      const existing = await storage.getIntegrationConnector(Number(req.params.id));
      if (!existing) return res.status(404).json({ message: "Not found" });
      await storage.deleteIntegrationConnector(Number(req.params.id));
      res.status(204).end();
    } catch (e) { next(e); }
  });

  app.get("/api/connectors/:id/health", requireAuth, requireEntitlement("connector_sync"), async (req, res, next) => {
    try {
      const c = await storage.getIntegrationConnector(Number(req.params.id));
      if (!c) return res.status(404).json({ message: "Not found" });
      const jobs = await storage.getSyncJobs(c.id, 5);
      const lastJob = jobs[0];
      res.json({
        connectorId: c.id, name: c.name, status: c.status,
        lastSyncAt: c.lastSyncAt, lastSyncStatus: c.lastSyncStatus, lastSyncMessage: c.lastSyncMessage,
        recentJobs: jobs.map(j => ({ id: j.id, status: j.status, recordsProcessed: j.recordsProcessed, recordsFailed: j.recordsFailed, createdAt: j.createdAt })),
        healthy: c.status === 'active' && (!lastJob || lastJob.status !== 'failed'),
      });
    } catch (e) { next(e); }
  });

  // SYNC JOBS
  app.get("/api/sync-jobs", requireAuth, requireCapability("connector_manage"), async (req, res, next) => {
    try {
      const connectorId = req.query.connectorId ? Number(req.query.connectorId) : undefined;
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      res.json(await storage.getSyncJobs(connectorId, limit));
    } catch (e) { next(e); }
  });

  app.get("/api/sync-jobs/:id", requireAuth, requireCapability("connector_manage"), async (req, res, next) => {
    try {
      const j = await storage.getSyncJob(Number(req.params.id));
      if (!j) return res.status(404).json({ message: "Not found" });
      res.json(j);
    } catch (e) { next(e); }
  });

  // CONNECTOR SYNC — reservation sync
  const reservationSyncSchema = z.object({
    reservations: z.array(z.object({
      externalId: z.string().min(1).max(200),
      customerName: z.string().min(1).max(200),
      customerEmail: z.string().email().nullable().optional(),
      customerPhone: z.string().nullable().optional(),
      vehiclePlate: z.string().nullable().optional(),
      stationCode: z.string().nullable().optional(),
      pickupDate: z.string(),
      returnDate: z.string(),
      status: z.enum(["confirmed", "checked_out", "returned", "cancelled", "no_show"]).optional(),
      notes: z.string().nullable().optional(),
    })),
  }).strict();

  app.post("/api/connectors/:id/sync", requireAuth, requireCapability("connector_manage"), requireEntitlement("connector_sync"), auditLog({ action: AUDIT_ACTIONS.UPDATE, entityType: 'connector' }), async (req, res, next) => {
    try {
      const connector = await storage.getIntegrationConnector(Number(req.params.id));
      if (!connector) return res.status(404).json({ message: "Connector not found" });
      if (connector.status !== 'active') return res.status(409).json({ message: `Connector is ${connector.status}` });

      // Ceiling check — fail fast if sync quota exhausted
      const ceiling = await checkUsageCeiling("connector_sync_triggered");
      if (!ceiling.allowed) {
        return res.status(429).json({
          message: "Usage ceiling reached for connector syncs",
          code: "CEILING_REACHED",
          current: ceiling.current,
          ceiling: ceiling.ceiling,
        });
      }

      reservationSyncSchema.parse(req.body);

      const recentJobs = await storage.getSyncJobs(connector.id, 10);
      const runningJob = recentJobs.find(j => j.status === 'running');
      if (runningJob) return res.status(409).json({ message: "A sync job is already running for this connector", jobId: runningJob.id });

      const userId = (req.user as Express.User).id;
      const job = await storage.createSyncJob({
        connectorId: connector.id, status: 'running', direction: connector.direction,
        entityType: 'reservation', triggeredBy: userId,
        recordsProcessed: 0, recordsFailed: 0, recordsSkipped: 0,
      });
      await storage.updateSyncJob(job.id, { startedAt: new Date() });

      const { reservations: incomingReservations } = reservationSyncSchema.parse(req.body);
      if (incomingReservations.length === 0) {
        await storage.updateSyncJob(job.id, { status: 'success', completedAt: new Date() });
        await storage.updateIntegrationConnector(connector.id, { lastSyncAt: new Date(), lastSyncStatus: 'success', lastSyncMessage: 'No records to sync' } as any);
        return res.json({ jobId: job.id, status: 'success', processed: 0, failed: 0, skipped: 0 });
      }

      const allStations = await storage.getStations();
      const stationByCode = new Map(allStations.map(s => [s.code, s]));
      const allVehicles = await storage.getVehicles();
      const vehicleByPlate = new Map(allVehicles.map(v => [v.plate, v]));

      const allExistingReservations = await storage.getReservations();
      const reservationByExternalId = new Map<string, (typeof allExistingReservations)[0]>();
      for (const r of allExistingReservations) {
        const extId = r.metadata && (r.metadata as Record<string, unknown>).externalId;
        if (typeof extId === 'string') reservationByExternalId.set(extId, r);
      }

      let processed = 0, failed = 0, skipped = 0;
      const errors: string[] = [];

      for (const incoming of incomingReservations) {
        try {
          if (new Date(incoming.pickupDate) >= new Date(incoming.returnDate)) {
            errors.push(`${incoming.externalId}: pickupDate >= returnDate`);
            failed++; continue;
          }

          let vehicleId: number | null = null;
          if (incoming.vehiclePlate) {
            const v = vehicleByPlate.get(incoming.vehiclePlate);
            if (v) vehicleId = v.id;
          }

          let stationId: number | null = null;
          if (incoming.stationCode) {
            const s = stationByCode.get(incoming.stationCode);
            if (s) stationId = s.id;
          }

          const existing = reservationByExternalId.get(incoming.externalId);

          if (existing) {
            await storage.updateReservation(existing.id, {
              customerName: incoming.customerName,
              customerEmail: incoming.customerEmail || null,
              customerPhone: incoming.customerPhone || null,
              vehicleId, stationId,
              pickupDate: new Date(incoming.pickupDate),
              returnDate: new Date(incoming.returnDate),
              status: incoming.status || existing.status,
              notes: incoming.notes || existing.notes,
              source: 'api',
              metadata: { ...((existing.metadata as Record<string, unknown>) || {}), externalId: incoming.externalId, connectorId: connector.id, lastSynced: new Date().toISOString() },
            } as any);
            processed++;
          } else {
            if (vehicleId) {
              const vehicleReservations = await storage.getReservations({ vehicleId });
              const overlapping = vehicleReservations.find(r =>
                (r.status === 'confirmed' || r.status === 'checked_out') &&
                new Date(r.pickupDate) < new Date(incoming.returnDate) &&
                new Date(r.returnDate) > new Date(incoming.pickupDate)
              );
              if (overlapping) {
                errors.push(`${incoming.externalId}: conflicts with reservation #${overlapping.id}`);
                skipped++; continue;
              }
            }
            await storage.createReservation({
              customerName: incoming.customerName,
              customerEmail: incoming.customerEmail || null,
              customerPhone: incoming.customerPhone || null,
              vehicleId, stationId,
              pickupDate: new Date(incoming.pickupDate) as any,
              returnDate: new Date(incoming.returnDate) as any,
              status: incoming.status || 'confirmed',
              source: 'api',
              notes: incoming.notes || null,
              metadata: { externalId: incoming.externalId, connectorId: connector.id, lastSynced: new Date().toISOString() },
            });
            processed++;
          }
        } catch (err) {
          errors.push(`${incoming.externalId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          failed++;
        }
      }

      const syncStatus = failed > 0 && processed === 0 ? 'failed' : failed > 0 ? 'partial' : 'success';
      await storage.updateSyncJob(job.id, {
        status: syncStatus, recordsProcessed: processed, recordsFailed: failed, recordsSkipped: skipped,
        errorLog: errors.length > 0 ? errors.slice(0, 50) : null, completedAt: new Date(),
      });
      await storage.updateIntegrationConnector(connector.id, {
        lastSyncAt: new Date(), lastSyncStatus: syncStatus,
        lastSyncMessage: `Processed: ${processed}, Failed: ${failed}, Skipped: ${skipped}`,
      } as any);

      await storage.createAuditEntry({
        userId, action: 'connector_sync_complete', entityType: 'connector', entityId: String(connector.id),
        details: { jobId: job.id, processed, failed, skipped, syncStatus }, ipAddress: req.ip || null,
      });

      recordUsage({ action: "connector_sync_triggered", userId, entityType: "connector", entityId: String(connector.id) });
      res.json({ jobId: job.id, status: syncStatus, processed, failed, skipped, errors: errors.slice(0, 10) });
    } catch (e) { next(e); }
  });

  // WEBHOOK INGEST
  app.post("/api/webhooks/reservations", webhookLimiter, async (req, res, next) => {
    try {
      const webhookSchema = z.object({
        connectorToken: z.string().min(1),
        reservations: reservationSyncSchema.shape.reservations,
      }).strict();
      const { connectorToken, reservations: incomingReservations } = webhookSchema.parse(req.body);

      const allConnectors = await storage.getIntegrationConnectorsUnscoped('webhook');
      const connector = allConnectors.find(c => {
        const cfg = c.config as Record<string, unknown>;
        const stored = String(cfg.webhookToken ?? "");
        if (stored.length !== connectorToken.length) return false;
        return timingSafeEqual(Buffer.from(stored), Buffer.from(connectorToken));
      });
      if (!connector) return res.status(401).json({ message: "Invalid connector token" });
      if (connector.status !== 'active') return res.status(409).json({ message: "Connector is not active" });

      await runWithWorkspace(connector.workspaceId, async () => {

      const job = await storage.createSyncJob({
        connectorId: connector.id, status: 'running', direction: 'inbound',
        entityType: 'reservation', recordsProcessed: 0, recordsFailed: 0, recordsSkipped: 0,
      });
      await storage.updateSyncJob(job.id, { startedAt: new Date() });

      const allExisting = await storage.getReservations();
      const existingExternalIds = new Set<string>();
      for (const r of allExisting) {
        const extId = r.metadata && (r.metadata as Record<string, unknown>).externalId;
        if (typeof extId === 'string') existingExternalIds.add(extId);
      }

      let processed = 0, failed = 0, skipped = 0;
      const errors: string[] = [];

      for (const incoming of incomingReservations) {
        try {
          if (existingExternalIds.has(incoming.externalId)) { skipped++; continue; }
          if (new Date(incoming.pickupDate) >= new Date(incoming.returnDate)) {
            errors.push(`${incoming.externalId}: invalid date range`);
            failed++; continue;
          }
          await storage.createReservation({
            customerName: incoming.customerName,
            customerEmail: incoming.customerEmail || null,
            customerPhone: incoming.customerPhone || null,
            pickupDate: new Date(incoming.pickupDate) as any,
            returnDate: new Date(incoming.returnDate) as any,
            status: incoming.status || 'confirmed',
            source: 'api', notes: incoming.notes || null,
            metadata: { externalId: incoming.externalId, connectorId: connector.id, webhook: true },
          });
          existingExternalIds.add(incoming.externalId);
          processed++;
        } catch (err) {
          errors.push(`${incoming.externalId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
          failed++;
        }
      }

      const syncStatus = failed > 0 && processed === 0 ? 'failed' : failed > 0 ? 'partial' : 'success';
      await storage.updateSyncJob(job.id, {
        status: syncStatus, recordsProcessed: processed, recordsFailed: failed, recordsSkipped: skipped,
        errorLog: errors.length > 0 ? errors.slice(0, 50) : null, completedAt: new Date(),
      });
      await storage.updateIntegrationConnector(connector.id, {
        lastSyncAt: new Date(), lastSyncStatus: syncStatus,
        lastSyncMessage: `Webhook: ${processed} processed, ${failed} failed, ${skipped} skipped (dedup)`,
      } as any);

      res.json({ jobId: job.id, status: syncStatus, processed, failed, skipped });

      }); // end runWithWorkspace
    } catch (e) { next(e); }
  });
}
