/**
 * Webhook management & delivery routes.
 * Provides CRUD for webhook endpoints and a delivery log viewer.
 * Also exports `dispatchWebhookEvent()` for internal use by other routes.
 *
 * Actual HTTP delivery runs through the durable queue in server/webhooks/queue.ts
 * (BullMQ-backed when REDIS_URL is set, in-process retry-with-backoff otherwise).
 */
import type { Express, Request, Response } from "express";
import { requireRole } from "../auth.js";
import { db } from "../db.js";
import { webhooks, webhookDeliveries, insertWebhookSchema } from "../../shared/schema.js";
import { eq, desc } from "drizzle-orm";
import { randomBytes } from "crypto";
import { logger } from "../observability/logger.js";
import { validateIdParam } from "../middleware/validation.js";
import { z } from "zod/v4";
import { getWebhookQueue } from "../webhooks/queue.js";
import { newDeliveryId } from "../webhooks/delivery.js";

function isAllowedWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    // Block internal/private IPs and metadata endpoints
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') return false;
    if (host.startsWith('10.') || host.startsWith('192.168.') || host === '169.254.169.254') return false;
    if (host.match(/^172\.(1[6-9]|2\d|3[01])\./) ) return false;
    if (host.endsWith('.internal') || host.endsWith('.local')) return false;
    return true;
  } catch { return false; }
}

const webhookPatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  url: z.string().url().max(2000).optional(),
  events: z.array(z.string().min(1).max(100)).max(50).optional(),
  active: z.boolean().optional(),
  retryPolicy: z.enum(['none', 'linear', 'exponential']).optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
}).strict();

export function registerWebhookRoutes(app: Express) {
  // ─── LIST webhooks ──────────────────────────────────────────────────
  app.get("/api/webhooks", requireRole("admin", "supervisor"), async (_req: Request, res: Response, next) => {
    try {
      const rows = await db.select().from(webhooks).orderBy(desc(webhooks.createdAt));
      res.json(rows.map(r => ({ ...r, secret: "••••••" })));
    } catch (e) { next(e); }
  });

  // ─── CREATE webhook ─────────────────────────────────────────────────
  app.post("/api/webhooks", requireRole("admin"), async (req: Request, res: Response, next) => {
    try {
      const user = req.user as Express.User;
      const secret = randomBytes(32).toString("hex");
      const data = insertWebhookSchema.parse({ ...req.body, secret, createdBy: user.id });
      if (!isAllowedWebhookUrl(data.url)) {
        return res.status(422).json({ message: "Webhook URL not allowed: must be a public HTTPS/HTTP endpoint" });
      }
      const [row] = await db.insert(webhooks).values(data).returning();
      res.status(201).json({ ...row, secret }); // Show secret only on creation
    } catch (e) { next(e); }
  });

  // ─── UPDATE webhook ─────────────────────────────────────────────────
  app.patch("/api/webhooks/:id", requireRole("admin"), async (req: Request, res: Response, next) => {
    try {
      const parsed = webhookPatchSchema.parse(req.body);
      if (parsed.url && !isAllowedWebhookUrl(parsed.url)) {
        return res.status(422).json({ message: "Webhook URL not allowed: must be a public HTTPS/HTTP endpoint" });
      }
      const updates: Record<string, unknown> = { updatedAt: new Date(), ...parsed };
      const [row] = await db.update(webhooks).set(updates).where(eq(webhooks.id, Number(req.params.id))).returning();
      if (!row) return res.status(404).json({ message: "Webhook not found" });
      res.json({ ...row, secret: "••••••" });
    } catch (e) { next(e); }
  });

  // ─── DELETE webhook ─────────────────────────────────────────────────
  app.delete("/api/webhooks/:id", requireRole("admin"), async (req: Request, res: Response, next) => {
    try {
      const [row] = await db.delete(webhooks).where(eq(webhooks.id, Number(req.params.id))).returning();
      if (!row) return res.status(404).json({ message: "Webhook not found" });
      res.status(204).end();
    } catch (e) { next(e); }
  });

  // ─── GET delivery log for a webhook ─────────────────────────────────
  app.get("/api/webhooks/:id/deliveries", requireRole("admin", "supervisor"), validateIdParam(), async (req: Request, res: Response, next) => {
    try {
      const rows = await db.select().from(webhookDeliveries)
        .where(eq(webhookDeliveries.webhookId, Number(req.params.id)))
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(50);
      res.json(rows);
    } catch (e) { next(e); }
  });

  // ─── MANUAL test delivery ───────────────────────────────────────────
  app.post("/api/webhooks/:id/test", requireRole("admin"), async (req: Request, res: Response, next) => {
    try {
      const [wh] = await db.select().from(webhooks).where(eq(webhooks.id, Number(req.params.id)));
      if (!wh) return res.status(404).json({ message: "Webhook not found" });
      const testPayload = { message: "Webhook test delivery" };
      const deliveryId = await getWebhookQueue().enqueue({
        webhookId: wh.id,
        eventType: "test",
        payload: testPayload,
        deliveryId: newDeliveryId(),
      });
      res.json({ status: "enqueued", deliveryId });
    } catch (e) { next(e); }
  });
}

/**
 * Dispatch a webhook event to all active subscribers.
 * Called from other route modules when events happen.
 * Enqueues one durable delivery job per matching subscriber.
 */
export async function dispatchWebhookEvent(eventType: string, payload: Record<string, unknown>) {
  try {
    const active = await db.select().from(webhooks).where(eq(webhooks.active, true));
    const matching = active.filter(wh => {
      const events = wh.events as string[];
      return events.includes("*") || events.includes(eventType);
    });
    const queue = getWebhookQueue();
    for (const wh of matching) {
      queue.enqueue({ webhookId: wh.id, eventType, payload })
        .catch((err: unknown) => logger.error("Webhook enqueue failed", err as Error, { webhookId: wh.id, eventType }));
    }
  } catch (err) {
    logger.error('Failed to dispatch webhook event', err as Error, { eventType });
  }
}
