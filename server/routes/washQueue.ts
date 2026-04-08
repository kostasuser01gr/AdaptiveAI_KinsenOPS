import type { Express } from "express";
import { storage } from "../storage.js";
import { requireAuth, requireRole } from "../auth.js";
import { wsManager } from "../websocket.js";
import { publicWashQueueReadLimiter, publicWashQueueWriteLimiter } from "../middleware/rate-limiter.js";
import { washQueuePatchSchema, evaluateAutomationRules } from "./_helpers.js";
import { resolveStationScope } from "../middleware/stationScope.js";
import { insertWashQueueSchema } from "../../shared/schema.js";

export function registerWashQueueRoutes(app: Express) {
  // PUBLIC wash-queue listing (washer tablet)
  app.get("/api/wash-queue", publicWashQueueReadLimiter, async (_req, res, next) => {
    try { res.json(await storage.getWashQueue()); } catch (e) { next(e); }
  });

  app.post("/api/wash-queue", publicWashQueueWriteLimiter, async (req, res, next) => {
    try {
      const data = insertWashQueueSchema.parse(req.body);
      // Calculate SLA deadline based on priority
      const slaHours: Record<string, number> = { High: 2, Medium: 4, Low: 8 };
      const deadline = data.priority && slaHours[data.priority]
        ? new Date(Date.now() + slaHours[data.priority] * 3600000)
        : null;
      const item = await storage.createWashQueueItem({ ...data, slaDeadline: deadline } as typeof data);
      wsManager.broadcast({ type: 'wash:created', data: item, channel: 'wash-queue' });
      evaluateAutomationRules('wash_created', { washId: item.id, vehiclePlate: item.vehiclePlate });
      res.status(201).json(item);
    } catch (e) { next(e); }
  });

  app.patch("/api/wash-queue/:id", requireAuth, async (req, res, next) => {
    try {
      const item = await storage.updateWashQueueItem(Number(req.params.id), washQueuePatchSchema.parse(req.body));
      if (!item) return res.status(404).json({ message: "Not found" });
      wsManager.broadcast({ type: 'wash:updated', data: item, channel: 'wash-queue' });
      if (item.status === 'completed') {
        evaluateAutomationRules('wash_completed', { washId: item.id, vehiclePlate: item.vehiclePlate });
      }
      res.json(item);
    } catch (e) { next(e); }
  });

  app.delete("/api/wash-queue/:id", requireRole("admin", "supervisor"), async (req, res, next) => {
    try {
      await storage.deleteWashQueueItem(Number(req.params.id));
      wsManager.broadcast({ type: 'wash:deleted', data: { id: Number(req.params.id) }, channel: 'wash-queue' });
      res.status(204).end();
    } catch (e) { next(e); }
  });

  // SLA Breach check
  app.get("/api/wash-queue/overdue", requireAuth, async (_req, res, next) => {
    try {
      res.json(await storage.getOverdueWashItems());
    } catch (e) { next(e); }
  });

  // SCOPED wash queue
  app.get("/api/scoped/wash-queue", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const stationScope = await resolveStationScope(user);
      if (stationScope === 'none') return res.json([]);
      const allWash = await storage.getWashQueue();
      if (stationScope === null) {
        res.json(allWash);
      } else {
        res.json(allWash.filter(w => w.stationId === null || stationScope.includes(w.stationId as number)));
      }
    } catch (e) { next(e); }
  });
}
