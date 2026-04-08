import type { Express } from "express";
import { z } from "zod/v4";
import { storage } from "../storage.js";
import { requireAuth } from "../auth.js";
import { wsManager } from "../websocket.js";
import { auditLog, AUDIT_ACTIONS } from "../middleware/audit.js";
import { REPAIR_ORDER_TRANSITIONS } from "./_helpers.js";
import { resolveStationScope } from "../middleware/stationScope.js";
import { insertRepairOrderSchema, insertDowntimeEventSchema } from "../../shared/schema.js";

export function registerFleetRoutes(app: Express) {
  // REPAIR ORDERS
  const repairOrderPatchSchema = z.object({
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    vehicleId: z.number().nullable().optional(),
    stationId: z.number().nullable().optional(),
    assignedTo: z.number().nullable().optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    status: z.enum(["open", "in_progress", "awaiting_parts", "completed", "cancelled"]).optional(),
    estimatedCost: z.string().nullable().optional(),
    actualCost: z.string().nullable().optional(),
    parts: z.array(z.unknown()).nullable().optional(),
    notes: z.string().nullable().optional(),
    completedAt: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  }).strict();

  app.get("/api/repair-orders", requireAuth, async (req, res, next) => {
    try {
      const filters: { stationId?: number; vehicleId?: number; status?: string; assignedTo?: number } = {};
      if (req.query.stationId) filters.stationId = Number(req.query.stationId);
      if (req.query.vehicleId) filters.vehicleId = Number(req.query.vehicleId);
      if (req.query.status) filters.status = String(req.query.status);
      if (req.query.assignedTo) filters.assignedTo = Number(req.query.assignedTo);
      res.json(await storage.getRepairOrders(filters));
    } catch (e) { next(e); }
  });

  app.get("/api/repair-orders/:id", requireAuth, async (req, res, next) => {
    try {
      const ro = await storage.getRepairOrder(Number(req.params.id));
      if (!ro) return res.status(404).json({ message: "Not found" });
      res.json(ro);
    } catch (e) { next(e); }
  });

  app.post("/api/repair-orders", requireAuth, auditLog({ action: AUDIT_ACTIONS.CREATE, entityType: 'repair_order' }), async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const data = insertRepairOrderSchema.parse({ ...req.body, createdBy: user.id });
      const ro = await storage.createRepairOrder(data);

      // Auto-create downtime for high/critical repairs
      if ((data.priority === 'high' || data.priority === 'critical') && data.vehicleId) {
        await storage.createDowntimeEvent({
          vehicleId: data.vehicleId,
          repairOrderId: ro.id,
          reason: `Repair: ${ro.title}`,
          startedAt: new Date(),
          metadata: { autoCreated: true, repairPriority: data.priority },
        });
        // Update vehicle status to maintenance
        await storage.updateVehicle(data.vehicleId, { status: 'maintenance' });
      }

      await storage.createActivityEntry({
        userId: user.id, actorName: user.displayName, action: 'repair_order_created',
        entityType: 'repair_order', entityId: String(ro.id), entityLabel: ro.title, stationId: ro.stationId,
      });

      wsManager.broadcast({ type: 'repair_order:created', data: ro });
      res.status(201).json(ro);
    } catch (e) { next(e); }
  });

  app.patch("/api/repair-orders/:id", requireAuth, auditLog({ action: AUDIT_ACTIONS.UPDATE, entityType: 'repair_order' }), async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const id = Number(req.params.id);
      const existing = await storage.getRepairOrder(id);
      if (!existing) return res.status(404).json({ message: "Not found" });

      const data = repairOrderPatchSchema.parse(req.body);

      if (data.status && data.status !== existing.status) {
        const allowed = REPAIR_ORDER_TRANSITIONS[existing.status] || [];
        if (!allowed.includes(data.status)) {
          return res.status(422).json({
            message: `Invalid status transition: ${existing.status} → ${data.status}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}`,
          });
        }
      }

      const updateData: Record<string, unknown> = { ...data };

      // Mark completion timestamp
      if (data.status === 'completed' && existing.status !== 'completed') {
        updateData.completedAt = new Date();
        // Close associated downtime
        if (existing.vehicleId) {
          const downtimeEvents = await storage.getDowntimeEvents({ vehicleId: existing.vehicleId });
          const openDowntime = downtimeEvents.find(d => d.repairOrderId === id && !d.endedAt);
          if (openDowntime) {
            await storage.updateDowntimeEvent(openDowntime.id, { endedAt: new Date() });
          }
          // Restore vehicle to available
          await storage.updateVehicle(existing.vehicleId, { status: 'available' });
        }
      } else if (data.status === 'cancelled' && existing.vehicleId) {
        // Cancel associated downtime
        const downtimeEvents = await storage.getDowntimeEvents({ vehicleId: existing.vehicleId });
        const openDowntime = downtimeEvents.find(d => d.repairOrderId === id && !d.endedAt);
        if (openDowntime) {
          await storage.updateDowntimeEvent(openDowntime.id, { endedAt: new Date() });
        }
        await storage.updateVehicle(existing.vehicleId, { status: 'available' });
      }

      const updated = await storage.updateRepairOrder(id, updateData);
      if (!updated) return res.status(404).json({ message: "Not found" });

      await storage.createActivityEntry({
        userId: user.id, actorName: user.displayName,
        action: data.status ? `repair_order_${data.status}` : 'repair_order_updated',
        entityType: 'repair_order', entityId: String(id), entityLabel: updated.title, stationId: updated.stationId,
      });

      wsManager.broadcast({ type: 'repair_order:updated', data: updated });
      res.json(updated);
    } catch (e) { next(e); }
  });

  // DOWNTIME EVENTS
  app.get("/api/downtime-events", requireAuth, async (req, res, next) => {
    try {
      const filters: { vehicleId?: number; stationId?: number } = {};
      if (req.query.vehicleId) filters.vehicleId = Number(req.query.vehicleId);
      if (req.query.stationId) filters.stationId = Number(req.query.stationId);
      res.json(await storage.getDowntimeEvents(filters));
    } catch (e) { next(e); }
  });

  app.post("/api/downtime-events", requireAuth, async (req, res, next) => {
    try {
      res.status(201).json(await storage.createDowntimeEvent(insertDowntimeEventSchema.parse(req.body)));
    } catch (e) { next(e); }
  });

  app.patch("/api/downtime-events/:id", requireAuth, async (req, res, next) => {
    try {
      const patchSchema = z.object({
        endedAt: z.coerce.date().nullable().optional(),
        reason: z.string().optional(),
        metadata: z.record(z.string(), z.unknown()).nullable().optional(),
      }).strict();

      const updated = await storage.updateDowntimeEvent(Number(req.params.id), patchSchema.parse(req.body));
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (e) { next(e); }
  });

  // SCOPED repair orders
  app.get("/api/scoped/repair-orders", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const stationScope = await resolveStationScope(user);
      if (stationScope === 'none') return res.json([]);
      if (stationScope === null) {
        res.json(await storage.getRepairOrders());
      } else {
        const all = await storage.getRepairOrders();
        res.json(all.filter(ro => ro.stationId !== null && stationScope.includes(ro.stationId)));
      }
    } catch (e) { next(e); }
  });
}
