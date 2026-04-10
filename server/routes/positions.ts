import type { Express } from "express";
import { z } from "zod/v4";
import { storage } from "../storage.js";
import { requireAuth, requireRole } from "../auth.js";
import { auditLog, AUDIT_ACTIONS } from "../middleware/audit.js";
import { wsManager } from "../websocket.js";
import {
  insertStationPositionSchema,
  insertPositionAssignmentSchema,
  insertVehicleTransferSchema,
} from "../../shared/schema.js";

export function registerPositionRoutes(app: Express) {
  // ─── Station Positions ───
  app.get("/api/positions", requireAuth, async (req, res, next) => {
    try {
      const stationId = req.query.stationId ? Number(req.query.stationId) : undefined;
      res.json(await storage.getStationPositions(stationId));
    } catch (e) { next(e); }
  });

  app.get("/api/positions/:id", requireAuth, async (req, res, next) => {
    try {
      const p = await storage.getStationPosition(Number(req.params.id));
      if (!p) return res.status(404).json({ message: "Position not found" });
      res.json(p);
    } catch (e) { next(e); }
  });

  app.post("/api/positions", requireAuth, requireRole("admin", "supervisor"),
    auditLog({ action: AUDIT_ACTIONS.CREATE, entityType: "station_position" }),
    async (req, res, next) => {
      try {
        const data = insertStationPositionSchema.parse(req.body);
        const p = await storage.createStationPosition(data);
        res.status(201).json(p);
      } catch (e) { next(e); }
    });

  app.patch("/api/positions/:id", requireAuth, requireRole("admin", "supervisor"),
    auditLog({ action: AUDIT_ACTIONS.UPDATE, entityType: "station_position" }),
    async (req, res, next) => {
      try {
        const patchSchema = z.object({
          label: z.string().optional(),
          type: z.string().optional(),
          capacity: z.number().optional(),
          active: z.boolean().optional(),
          metadata: z.record(z.string(), z.unknown()).nullable().optional(),
        }).strict();
        const data = patchSchema.parse(req.body);
        const p = await storage.updateStationPosition(Number(req.params.id), data);
        if (!p) return res.status(404).json({ message: "Position not found" });
        res.json(p);
      } catch (e) { next(e); }
    });

  app.delete("/api/positions/:id", requireAuth, requireRole("admin"),
    auditLog({ action: AUDIT_ACTIONS.DELETE, entityType: "station_position" }),
    async (req, res, next) => {
      try {
        await storage.deleteStationPosition(Number(req.params.id));
        res.status(204).end();
      } catch (e) { next(e); }
    });

  // ─── Position Assignments ───
  app.get("/api/position-assignments", requireAuth, async (req, res, next) => {
    try {
      const positionId = req.query.positionId ? Number(req.query.positionId) : undefined;
      res.json(await storage.getPositionAssignments(positionId));
    } catch (e) { next(e); }
  });

  app.get("/api/position-assignments/active/:positionId", requireAuth, async (req, res, next) => {
    try {
      res.json(await storage.getActiveAssignments(Number(req.params.positionId)));
    } catch (e) { next(e); }
  });

  app.get("/api/position-assignments/vehicle/:vehicleId", requireAuth, async (req, res, next) => {
    try {
      const a = await storage.getVehicleAssignment(Number(req.params.vehicleId));
      if (!a) return res.status(404).json({ message: "No active assignment" });
      res.json(a);
    } catch (e) { next(e); }
  });

  app.post("/api/position-assignments", requireAuth,
    auditLog({ action: AUDIT_ACTIONS.CREATE, entityType: "position_assignment" }),
    async (req, res, next) => {
      try {
        const user = req.user as Express.User;
        const data = insertPositionAssignmentSchema.parse({ ...req.body, assignedBy: user.id });
        const a = await storage.createPositionAssignment(data);
        wsManager.broadcast({ type: "position_assigned", data: a, channel: "vehicles" });
        res.status(201).json(a);
      } catch (e) { next(e); }
    });

  app.post("/api/position-assignments/:id/release", requireAuth,
    auditLog({ action: AUDIT_ACTIONS.UPDATE, entityType: "position_assignment" }),
    async (req, res, next) => {
      try {
        const a = await storage.releasePositionAssignment(Number(req.params.id));
        if (!a) return res.status(404).json({ message: "Assignment not found" });
        wsManager.broadcast({ type: "position_released", data: a, channel: "vehicles" });
        res.json(a);
      } catch (e) { next(e); }
    });

  // ─── Vehicle Transfers ───
  app.get("/api/transfers", requireAuth, async (req, res, next) => {
    try {
      const filters: { vehicleId?: number; fromStationId?: number; toStationId?: number; status?: string } = {};
      if (req.query.vehicleId) filters.vehicleId = Number(req.query.vehicleId);
      if (req.query.fromStationId) filters.fromStationId = Number(req.query.fromStationId);
      if (req.query.toStationId) filters.toStationId = Number(req.query.toStationId);
      if (req.query.status) filters.status = String(req.query.status);
      res.json(await storage.getVehicleTransfers(filters));
    } catch (e) { next(e); }
  });

  app.get("/api/transfers/:id", requireAuth, async (req, res, next) => {
    try {
      const t = await storage.getVehicleTransfer(Number(req.params.id));
      if (!t) return res.status(404).json({ message: "Transfer not found" });
      res.json(t);
    } catch (e) { next(e); }
  });

  app.post("/api/transfers", requireAuth, requireRole("admin", "supervisor", "coordinator"),
    auditLog({ action: AUDIT_ACTIONS.CREATE, entityType: "vehicle_transfer" }),
    async (req, res, next) => {
      try {
        const user = req.user as Express.User;
        const data = insertVehicleTransferSchema.parse({ ...req.body, requestedBy: user.id });
        const t = await storage.createVehicleTransfer(data);
        wsManager.broadcast({ type: "transfer_created", data: t, channel: "vehicles" });
        res.status(201).json(t);
      } catch (e) { next(e); }
    });

  const transferPatchSchema = z.object({
    status: z.enum(["requested", "in_transit", "delivered", "cancelled"]).optional(),
    driverName: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    estimatedArrival: z.string().nullable().optional(),
  }).strict();

  app.patch("/api/transfers/:id", requireAuth, requireRole("admin", "supervisor", "coordinator"),
    auditLog({ action: AUDIT_ACTIONS.UPDATE, entityType: "vehicle_transfer" }),
    async (req, res, next) => {
      try {
        const data = transferPatchSchema.parse(req.body);

        // Auto-set departed/arrived timestamps based on status
        const extra: Record<string, unknown> = {};
        if (data.status === "in_transit") extra.departedAt = new Date();
        if (data.status === "delivered") extra.arrivedAt = new Date();

        const t = await storage.updateVehicleTransfer(Number(req.params.id), { ...data, ...extra } as any);
        if (!t) return res.status(404).json({ message: "Transfer not found" });

        // When delivered, update the vehicle's stationId
        if (data.status === "delivered") {
          await storage.updateVehicle(t.vehicleId, { stationId: t.toStationId });
        }

        wsManager.broadcast({ type: "transfer_updated", data: t, channel: "vehicles" });
        res.json(t);
      } catch (e) { next(e); }
    });
}
