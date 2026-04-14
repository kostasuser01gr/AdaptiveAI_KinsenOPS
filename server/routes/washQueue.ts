import type { Express } from "express";
import { storage } from "../storage.js";
import { requireAuth, requireRole } from "../auth.js";
import { wsManager } from "../websocket.js";
import { publicWashQueueReadLimiter } from "../middleware/rate-limiter.js";
import { washQueuePatchSchema, evaluateAutomationRules } from "./_helpers.js";
import { resolveStationScope } from "../middleware/stationScope.js";
import { insertWashQueueSchema } from "../../shared/schema.js";
import { validateIdParam } from "../middleware/validation.js";

export function registerWashQueueRoutes(app: Express) {
  // PUBLIC wash-queue listing (washer tablet)
  app.get("/api/wash-queue", publicWashQueueReadLimiter, async (_req, res, next) => {
    try { res.json(await storage.getWashQueue()); } catch (e) { next(e); }
  });

  app.post("/api/wash-queue", requireAuth, async (req, res, next) => {
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

  app.delete("/api/wash-queue/:id", requireRole("admin", "supervisor"), validateIdParam(), async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      await storage.deleteWashQueueItem(id);
      wsManager.broadcast({ type: 'wash:deleted', data: { id }, channel: 'wash-queue' });
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

  // ─── Priority score calculation (auto-rank queue items) ──────────────
  app.get("/api/wash-queue/scored", requireAuth, async (_req, res, next) => {
    try {
      const items = await storage.getWashQueue();
      const now = Date.now();
      const scored = items
        .filter(i => i.status !== 'completed' && i.status !== 'cancelled')
        .map(item => {
          let score = 0;
          // Priority weight
          if (item.priority === 'High') score += 40;
          else if (item.priority === 'Medium') score += 20;
          else score += 5;
          // SLA urgency — boost items nearing or past deadline
          if (item.slaDeadline) {
            const remaining = new Date(item.slaDeadline).getTime() - now;
            const hours = remaining / 3600000;
            if (hours <= 0) score += 50; // already breached
            else if (hours <= 1) score += 30;
            else if (hours <= 2) score += 15;
          }
          // Wait time — older items get boosted (1 point per 30 min waiting)
          if (item.createdAt) {
            const waitMs = now - new Date(item.createdAt).getTime();
            score += Math.min(20, Math.floor(waitMs / 1800000));
          }
          // VIP / category bonus
          if (item.washType === 'full_detail') score += 10;
          return { ...item, priorityScore: score };
        })
        .sort((a, b) => b.priorityScore - a.priorityScore);
      res.json(scored);
    } catch (e) { next(e); }
  });
}
