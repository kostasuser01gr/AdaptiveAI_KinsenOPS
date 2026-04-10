/**
 * Telematics ingestion routes — vehicle event ingest via API or webhook (Phase 4.2B).
 *
 * Hardened (Phase 4.2B-H):
 * - Deterministic dedupe via ON CONFLICT (no clock heuristics)
 * - Structured batch result: { inserted, deduped, rejected, errored }
 * - Payload size limit (64 KB per event, 500 events per batch)
 * - Timestamp sanity bounds (not before 2020, not more than 1h in the future)
 * - Station-scoped reads for non-admin users
 */
import type { Express } from "express";
import { z } from "zod/v4";
import { timingSafeEqual } from "crypto";
import { storage } from "../storage.js";
import { requireAuth, requireRole } from "../auth.js";
import { auditLog, AUDIT_ACTIONS } from "../middleware/audit.js";
import { requireEntitlement } from "../entitlements/engine.js";
import { webhookLimiter } from "../middleware/rate-limiter.js";
import { wsManager } from "../websocket.js";
import {
  normalizeBatch,
  validatePayloadSize,
  validateTimestamp,
  type RawTelematicsPayload,
} from "../telematics/normalizer.js";
import { processVehicleEvent } from "../telematics/derivation.js";
import { resolveStationScope } from "../middleware/stationScope.js";
import { logger } from "../observability/logger.js";
import { runWithWorkspace } from "../middleware/workspaceContext.js";

// ─── Constants ───
const MAX_BATCH_SIZE = 500;

// ─── Validation schemas ───

const telematicsEventSchema = z.object({
  externalEventId: z.string().optional(),
  eventType: z.string().min(1),
  occurredAt: z.string().min(1),
  vehicleId: z.number().int().positive(),
  severity: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

const telematicsBatchSchema = z.object({
  events: z.array(telematicsEventSchema).min(1).max(MAX_BATCH_SIZE),
  source: z.string().min(1).optional(),
});

const webhookBatchSchema = z.object({
  connectorToken: z.string().min(1),
  events: z.array(telematicsEventSchema).min(1).max(MAX_BATCH_SIZE),
});

export function registerTelematicsRoutes(app: Express) {
  // ─── Authenticated batch ingestion ───
  app.post(
    "/api/telematics/events",
    requireAuth,
    requireRole("admin", "supervisor"),
    requireEntitlement("connector_sync"),
    auditLog({ action: AUDIT_ACTIONS.CREATE, entityType: "vehicle_event" }),
    async (req, res, next) => {
      try {
        const { events, source } = telematicsBatchSchema.parse(req.body);
        const effectiveSource = source ?? "api";

        const inserted: number[] = [];
        const deduped: number[] = [];
        const rejected: { index: number; message: string }[] = [];

        // Pre-validate payload sizes and timestamps
        const preValidated: RawTelematicsPayload[] = [];
        for (let i = 0; i < events.length; i++) {
          const ev = events[i];
          const sizeErr = validatePayloadSize(ev.data);
          if (sizeErr) { rejected.push({ index: i, message: sizeErr }); continue; }
          const tsErr = validateTimestamp(ev.occurredAt);
          if (tsErr) { rejected.push({ index: i, message: tsErr }); continue; }
          preValidated.push(ev as RawTelematicsPayload);
        }

        const { valid, errors: normErrors } = normalizeBatch(
          preValidated,
          effectiveSource,
        );

        // Offset normalization errors to match original batch indices
        for (const err of normErrors) {
          rejected.push({ index: err.index, message: err.message });
        }

        for (const ev of valid) {
          try {
            const result = await storage.createVehicleEventEx(ev);
            if (result.inserted) {
              inserted.push(result.row.id);
              // Run derivation hooks asynchronously
              processVehicleEvent(result.row).catch((e) => {
                logger.error("Derivation failed (fire-and-forget)", e instanceof Error ? e : new Error(String(e)), { eventId: result.row.id });
              });
            } else {
              deduped.push(result.row.id);
            }
          } catch (err: any) {
            // Unique constraint violation = concurrent dupe — treat as deduped, not errored
            if (err?.code === "23505") {
              deduped.push(-1);
            } else {
              rejected.push({ index: -1, message: err?.message ?? "Storage error" });
            }
          }
        }

        // Broadcast for real-time dashboards
        if (inserted.length > 0) {
          wsManager.broadcast({
            type: "vehicle_events:ingested",
            data: { count: inserted.length, source: effectiveSource },
            channel: "vehicle_events",
          });
        }

        // Observability: log ingestion summary
        logger.info("Telematics batch ingested", {
          source: effectiveSource,
          inserted: inserted.length,
          deduped: deduped.length,
          rejected: rejected.length,
        });

        return res.json({
          inserted: inserted.length,
          deduped: deduped.length,
          rejected: rejected.length,
          errors: rejected.length > 0 ? rejected : undefined,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // ─── Webhook ingestion (no session auth — token-based) ───
  app.post("/api/webhooks/telematics", webhookLimiter, async (req, res, next) => {
    try {
      const { connectorToken, events } = webhookBatchSchema.parse(req.body);

      // Find active webhook connector by token (unscoped — token IS the identity)
      const allConnectors = await storage.getIntegrationConnectorsUnscoped("webhook");
      const connector = allConnectors.find((c) => {
        const cfg = c.config as Record<string, unknown>;
        const stored = String(cfg.webhookToken ?? "");
        if (stored.length !== connectorToken.length) return false;
        return timingSafeEqual(Buffer.from(stored), Buffer.from(connectorToken));
      });
      if (!connector) return res.status(401).json({ message: "Invalid connector token" });
      if (connector.status !== "active") return res.status(409).json({ message: "Connector is not active" });

      // Run the rest of the handler within the connector's workspace context
      await runWithWorkspace(connector.workspaceId, async () => {

      const effectiveSource = `webhook:${connector.name}`;
      const inserted: number[] = [];
      const deduped: number[] = [];
      const rejected: { index: number; message: string }[] = [];

      // Pre-validate payload sizes and timestamps
      const preValidated: RawTelematicsPayload[] = [];
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        const sizeErr = validatePayloadSize(ev.data);
        if (sizeErr) { rejected.push({ index: i, message: sizeErr }); continue; }
        const tsErr = validateTimestamp(ev.occurredAt);
        if (tsErr) { rejected.push({ index: i, message: tsErr }); continue; }
        preValidated.push(ev as RawTelematicsPayload);
      }

      const { valid, errors: normErrors } = normalizeBatch(
        preValidated,
        effectiveSource,
        connector.id,
      );

      for (const err of normErrors) {
        rejected.push({ index: err.index, message: err.message });
      }

      for (const ev of valid) {
        try {
          const result = await storage.createVehicleEventEx(ev);
          if (result.inserted) {
            inserted.push(result.row.id);
            processVehicleEvent(result.row).catch((e) => {
              logger.error("Derivation failed (webhook)", e instanceof Error ? e : new Error(String(e)), { eventId: result.row.id });
            });
          } else {
            deduped.push(result.row.id);
          }
        } catch (err: any) {
          if (err?.code === "23505") {
            deduped.push(-1);
          } else {
            rejected.push({ index: -1, message: err?.message ?? "Storage error" });
          }
        }
      }

      if (inserted.length > 0) {
        wsManager.broadcast({
          type: "vehicle_events:ingested",
          data: { count: inserted.length, connectorId: connector.id },
          channel: "vehicle_events",
        });
      }

      logger.info("Telematics webhook ingested", {
        connectorId: connector.id,
        inserted: inserted.length,
        deduped: deduped.length,
        rejected: rejected.length,
      });

      return res.json({
        inserted: inserted.length,
        deduped: deduped.length,
        rejected: rejected.length,
        errors: rejected.length > 0 ? rejected : undefined,
      });
      }); // end runWithWorkspace
    } catch (err) {
      next(err);
    }
  });

  // ─── Query vehicle events (authenticated, station-scoped) ───
  app.get("/api/telematics/events", requireAuth, async (req, res, next) => {
    try {
      const filters: Parameters<typeof storage.getVehicleEvents>[0] = {};
      if (req.query.vehicleId) filters.vehicleId = Number(req.query.vehicleId);
      if (req.query.eventType) filters.eventType = String(req.query.eventType);
      if (req.query.connectorId) filters.connectorId = Number(req.query.connectorId);
      if (req.query.from) filters.from = new Date(String(req.query.from));
      if (req.query.to) filters.to = new Date(String(req.query.to));
      if (req.query.processed !== undefined) filters.processed = req.query.processed === "true";
      if (req.query.limit) filters.limit = Math.min(Number(req.query.limit), 500);

      // Station scope: non-admin users only see events for vehicles assigned to their station
      const scope = await resolveStationScope(req.user!);
      if (scope === "none") return res.json([]);
      if (scope !== null) {
        // Get vehicles belonging to user's stations, then filter events
        const vehicles = await storage.getVehicles();
        const stationVehicleIds = new Set(
          vehicles.filter((v: any) => v.stationId !== null && scope.includes(v.stationId)).map((v: any) => v.id),
        );
        if (filters.vehicleId && !stationVehicleIds.has(filters.vehicleId)) return res.json([]);
        if (!filters.vehicleId) {
          // Without a specific vehicleId filter, we need to restrict. Return empty if too broad.
          // Station-scoped users must specify a vehicleId for event queries.
          return res.status(400).json({ message: "vehicleId filter required for station-scoped users" });
        }
      }

      const events = await storage.getVehicleEvents(filters);
      return res.json(events);
    } catch (err) {
      next(err);
    }
  });

  // ─── Get single vehicle event (station-scoped) ───
  app.get("/api/telematics/events/:id", requireAuth, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const event = await storage.getVehicleEvent(id);
      if (!event) return res.status(404).json({ message: "Vehicle event not found" });

      // Station scope check
      const scope = await resolveStationScope(req.user!);
      if (scope === "none") return res.status(404).json({ message: "Vehicle event not found" });
      if (scope !== null) {
        const vehicle = await storage.getVehicle(event.vehicleId);
        if (!vehicle || (vehicle as any).stationId === null || !scope.includes((vehicle as any).stationId)) {
          return res.status(404).json({ message: "Vehicle event not found" });
        }
      }

      return res.json(event);
    } catch (err) {
      next(err);
    }
  });

  // ─── Event count/summary for a vehicle (station-scoped) ───
  app.get("/api/telematics/vehicles/:vehicleId/summary", requireAuth, async (req, res, next) => {
    try {
      const vehicleId = Number(req.params.vehicleId);

      // Station scope check
      const scope = await resolveStationScope(req.user!);
      if (scope === "none") return res.status(403).json({ message: "No station assigned" });
      if (scope !== null) {
        const vehicle = await storage.getVehicle(vehicleId);
        if (!vehicle || (vehicle as any).stationId === null || !scope.includes((vehicle as any).stationId)) {
          return res.status(404).json({ message: "Vehicle not found" });
        }
      }

      const [total, recentEvents, byType] = await Promise.all([
        storage.countVehicleEvents(vehicleId),
        storage.getVehicleEvents({ vehicleId, limit: 20 }),
        storage.countVehicleEventsByType(vehicleId),
      ]);

      return res.json({ vehicleId, totalEvents: total, byType, recentEvents });
    } catch (err) {
      next(err);
    }
  });
}
