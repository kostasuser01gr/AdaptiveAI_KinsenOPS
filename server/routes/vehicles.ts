import type { Express } from "express";
import { z } from "zod/v4";
import { storage } from "../storage.js";
import { requireAuth, requireRole } from "../auth.js";
import { wsManager } from "../websocket.js";
import { publicEvidenceLimiter } from "../middleware/rate-limiter.js";
import { vehiclePatchSchema, evaluateAutomationRules } from "./_helpers.js";
import { resolveStationScope } from "../middleware/stationScope.js";
import { cached, invalidate, CacheTTL } from "../cache.js";
import {
  insertVehicleSchema,
  insertVehicleEvidenceSchema,
} from "../../shared/schema.js";

export function registerVehicleRoutes(app: Express) {
  // VEHICLES CRUD
  app.get("/api/vehicles", requireAuth, async (_req, res, next) => {
    try {
      res.json(await cached("vehicles:all", CacheTTL.SHORT, () => storage.getVehicles()));
    } catch (e) { next(e); }
  });

  app.get("/api/vehicles/:id", requireAuth, async (req, res, next) => {
    try {
      const v = await storage.getVehicle(Number(req.params.id));
      if (!v) return res.status(404).json({ message: "Not found" });
      res.json(v);
    } catch (e) { next(e); }
  });

  app.post("/api/vehicles", requireRole("admin", "supervisor"), async (req, res, next) => {
    try {
      const v = await storage.createVehicle(insertVehicleSchema.parse(req.body));
      await invalidate("vehicles:*", "dashboard-stats", "analytics:*");
      wsManager.broadcast({ type: 'vehicle:created', data: v, channel: 'vehicles' });
      res.status(201).json(v);
    } catch (e) { next(e); }
  });

  app.patch("/api/vehicles/:id", requireRole("admin", "supervisor", "agent"), async (req, res, next) => {
    try {
      const v = await storage.updateVehicle(Number(req.params.id), vehiclePatchSchema.parse(req.body));
      if (!v) return res.status(404).json({ message: "Not found" });
      await invalidate("vehicles:*", "dashboard-stats", "analytics:*");
      wsManager.broadcast({ type: 'vehicle:updated', data: v, channel: 'vehicles' });
      evaluateAutomationRules('vehicle_status_change', { vehicleId: v.id, status: v.status });
      res.json(v);
    } catch (e) { next(e); }
  });

  app.delete("/api/vehicles/:id", requireRole("admin"), async (req, res, next) => {
    try {
      await storage.deleteVehicle(Number(req.params.id));
      await invalidate("vehicles:*", "dashboard-stats", "analytics:*");
      wsManager.broadcast({ type: 'vehicle:deleted', data: { id: Number(req.params.id) }, channel: 'vehicles' });
      res.status(204).end();
    } catch (e) { next(e); }
  });

  app.post("/api/vehicles/:id/restore", requireRole("admin"), async (req, res, next) => {
    try {
      const v = await storage.restoreVehicle(Number(req.params.id));
      if (!v) return res.status(404).json({ message: "Not found" });
      wsManager.broadcast({ type: 'vehicle:restored', data: v, channel: 'vehicles' });
      res.json(v);
    } catch (e) { next(e); }
  });

  // VEHICLE EVIDENCE
  app.get("/api/vehicles/:id/evidence", requireAuth, async (req, res, next) => {
    try { res.json(await storage.getVehicleEvidence(Number(req.params.id))); } catch (e) { next(e); }
  });

  app.post("/api/vehicles/:id/evidence", requireAuth, async (req, res, next) => {
    try {
      const data = insertVehicleEvidenceSchema.parse({ ...req.body, vehicleId: Number(req.params.id) });
      const e = await storage.createVehicleEvidence(data);
      evaluateAutomationRules('evidence_uploaded', { vehicleId: Number(req.params.id), evidenceId: e.id });
      res.status(201).json(e);
    } catch (e) { next(e); }
  });

  // Vehicle trends
  app.get("/api/vehicles/:id/trends", requireAuth, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      res.json(await storage.getVehicleTrends(id));
    } catch (e) { next(e); }
  });

  // SCOPED vehicles
  app.get("/api/scoped/vehicles", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const stationScope = await resolveStationScope(user);
      if (stationScope === 'none') return res.json([]);
      const allVehicles = await storage.getVehicles();
      if (stationScope === null) {
        res.json(allVehicles);
      } else {
        res.json(allVehicles.filter(v => v.stationId === null || stationScope.includes(v.stationId as number)));
      }
    } catch (e) { next(e); }
  });

  // PUBLIC evidence endpoint (customer portal)
  app.post("/api/public/evidence", publicEvidenceLimiter, async (req, res, next) => {
    try {
      const schema = z.object({
        reservationId: z.string().min(1).max(100),
        type: z.string().min(1).max(50),
        caption: z.string().max(500).optional(),
        source: z.enum(["customer", "staff"]),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }).strict();
      const data = schema.parse(req.body);
      const record = await storage.createVehicleEvidence({
        vehicleId: null,
        type: data.type,
        caption: data.caption,
        source: data.source,
        reservationId: data.reservationId,
        metadata: data.metadata,
      });
      res.status(201).json(record);
    } catch (e) { next(e); }
  });
}
