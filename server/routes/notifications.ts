import type { Express } from "express";
import { z } from "zod/v4";
import { storage } from "../storage.js";
import { requireAuth, requireRole } from "../auth.js";
import { wsManager } from "../websocket.js";
import { insertNotificationSchema } from "../../shared/schema.js";

export function registerNotificationRoutes(app: Express) {
  // NOTIFICATIONS
  app.get("/api/notifications", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      res.json(await storage.getNotifications(user.id, user.role, user.station ? parseInt(user.station) : undefined));
    } catch (e) { next(e); }
  });

  app.post("/api/notifications", requireRole("admin", "supervisor"), async (req, res, next) => {
    try {
      const n = await storage.createNotification(insertNotificationSchema.parse(req.body));
      wsManager.broadcast({ type: 'notification:created', data: n, channel: 'notifications' });
      res.status(201).json(n);
    } catch (e) { next(e); }
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      await storage.markNotificationRead(Number(req.params.id), userId);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  app.post("/api/notifications/read-all", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      await storage.markAllNotificationsRead(user.id, user.role, user.station ? parseInt(user.station) : undefined);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  // Notification action — structured workflow for actionable notifications
  const notificationActionSchema = z.object({
    action: z.enum(["acknowledge", "dismiss", "escalate", "resolve"]),
    note: z.string().max(1000).optional(),
  }).strict();

  app.post("/api/notifications/:id/action", requireAuth, async (req, res, next) => {
    try {
      const { action, note } = notificationActionSchema.parse(req.body);
      const userId = (req.user as Express.User).id;

      const statusMap: Record<string, string> = {
        acknowledge: 'in_progress',
        dismiss: 'resolved',
        escalate: 'escalated',
        resolve: 'resolved',
      };

      const updated = await storage.updateNotification(Number(req.params.id), {
        status: statusMap[action],
        assignedTo: action === 'acknowledge' ? userId : undefined,
      } as any);
      if (!updated) return res.status(404).json({ message: "Not found" });

      if (note) {
        await storage.createAuditEntry({
          userId,
          action: `notification_${action}`,
          entityType: 'notification',
          entityId: String(updated.id),
          details: { note },
          ipAddress: req.ip || null,
        });
      }

      wsManager.broadcast({ type: 'notification_updated', data: updated });
      res.json(updated);
    } catch (e) { next(e); }
  });

  // Ops Inbox stats
  app.get("/api/ops-inbox/stats", requireAuth, async (req, res, next) => {
    try {
      const user = req.user!;
      res.json(await storage.getNotificationStats(user.id, user.role, user.station ? parseInt(user.station) : undefined));
    } catch (e) { next(e); }
  });

  // Notification assignment & status update
  const notificationAssignSchema = z.object({
    assignedTo: z.number().nullable().optional(),
    status: z.string().min(1).max(50).optional(),
  }).strict();

  app.patch("/api/notifications/:id/assign", requireAuth, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const parsed = notificationAssignSchema.parse(req.body);
      const update: Partial<{ assignedTo: number | null; status: string }> = {};
      if (parsed.assignedTo !== undefined) update.assignedTo = parsed.assignedTo;
      if (parsed.status) update.status = parsed.status;
      const n = await storage.updateNotification(id, update as any);
      if (!n) return res.status(404).json({ error: 'Notification not found' });
      wsManager.broadcast({ type: 'notification_updated', data: n });
      res.json(n);
    } catch (e) { next(e); }
  });

  // Escalate notification to WarRoom
  app.post("/api/notifications/:id/escalate", requireAuth, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const notif = await storage.updateNotification(id, { status: 'escalated' } as any);
      if (!notif) return res.status(404).json({ error: 'Notification not found' });
      const room = await storage.createEntityRoom({
        entityType: 'notification',
        entityId: String(id),
        title: `[Escalated] ${notif.title}`,
        status: 'open',
        priority: notif.severity === 'critical' ? 'critical' : 'high',
        metadata: { sourceNotificationId: id, escalatedBy: req.user!.id },
      });
      await storage.createRoomMessage({
        roomId: room.id,
        userId: req.user!.id,
        role: req.user!.role,
        content: `Escalated from Ops Inbox: ${notif.title}\n\n${notif.body}`,
        type: 'system',
      });
      wsManager.broadcast({ type: 'notification_escalated', data: { notification: notif, room } });
      res.json({ notification: notif, room });
    } catch (e) { next(e); }
  });
}
