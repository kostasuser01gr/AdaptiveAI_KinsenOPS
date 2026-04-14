/**
 * Webhook management & delivery routes.
 * Provides CRUD for webhook endpoints and a delivery log viewer.
 * Also exports `dispatchWebhookEvent()` for internal use by other routes.
 */
import type { Express, Request, Response } from "express";
import { requireRole } from "../auth.js";
import { db } from "../db.js";
import { webhooks, webhookDeliveries, insertWebhookSchema } from "../../shared/schema.js";
import { eq, desc } from "drizzle-orm";
import { randomBytes, createHmac } from "crypto";
import { logger } from "../observability/logger.js";
import { validateIdParam } from "../middleware/validation.js";
import { z } from "zod/v4";

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
      // Strip secrets from response
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
      const testPayload = { event: "test", timestamp: new Date().toISOString(), data: { message: "Webhook test delivery" } };
      const result = await deliverWebhook(wh, "test", testPayload);
      res.json(result);
    } catch (e) { next(e); }
  });
}

/**
 * Dispatch a webhook event to all active subscribers.
 * Called from other route modules when events happen.
 */
export async function dispatchWebhookEvent(eventType: string, payload: Record<string, unknown>) {
  try {
    const active = await db.select().from(webhooks).where(eq(webhooks.active, true));
    const matching = active.filter(wh => {
      const events = wh.events as string[];
      return events.includes("*") || events.includes(eventType);
    });
    // Fire-and-forget — don't block the caller
    for (const wh of matching) {
      deliverWebhook(wh, eventType, payload).catch(err => logger.error('Webhook delivery failed', err, { webhookId: wh.id, eventType }));
    }
  } catch (err) {
    logger.error('Failed to dispatch webhook event', err as Error, { eventType });
  }
}

async function deliverWebhook(
  wh: typeof webhooks.$inferSelect,
  eventType: string,
  payload: Record<string, unknown>
): Promise<{ status: string; responseCode?: number }> {
  const body = JSON.stringify({ event: eventType, timestamp: new Date().toISOString(), data: payload });
  const signature = createHmac("sha256", wh.secret).update(body).digest("hex");

  let responseCode: number | undefined;
  let responseBody: string | undefined;
  let status: string;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const resp = await fetch(wh.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": `sha256=${signature}`,
        "X-Webhook-Event": eventType,
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    responseCode = resp.status;
    responseBody = await resp.text().catch(() => "");
    status = resp.ok ? "success" : "failed";
  } catch {
    status = "failed";
    responseBody = "Connection error or timeout";
  }

  // Record delivery
  await db.insert(webhookDeliveries).values({
    webhookId: wh.id,
    eventType,
    payload,
    status,
    responseCode,
    responseBody: responseBody?.slice(0, 2000),
    attempt: 1,
  }).catch(err => logger.error('Failed to record webhook delivery', err, { webhookId: wh.id }));

  // Update last delivered timestamp
  if (status === "success") {
    await db.update(webhooks).set({ lastDeliveredAt: new Date() }).where(eq(webhooks.id, wh.id)).catch(err => logger.error('Failed to update webhook timestamp', err));
  }

  return { status, responseCode };
}
