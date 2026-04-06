import type { Express } from "express";
import type { Server } from "http";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";
import { storage } from "./storage.js";
import { pool } from "./db.js";
import { setupAuth, requireAuth, requireRole, hashPassword } from "./auth.js";
import { authLimiter, aiChatLimiter, searchLimiter, publicWashQueueReadLimiter, publicWashQueueWriteLimiter, publicEvidenceLimiter } from "./middleware/rate-limiter.js";
import { validateRequest } from "./middleware/validation.js";
import { sanitizeInput } from "./middleware/validation.js";
import { auditLog, AUDIT_ACTIONS } from "./middleware/audit.js";
import { metricsCollector } from "./observability/metrics.js";
import { wsManager } from "./websocket.js";
import {
  insertVehicleSchema, insertWashQueueSchema, insertShiftSchema,
  insertNotificationSchema, insertCustomActionSchema,
  insertMessageSchema, insertStationSchema, insertAutomationRuleSchema,
  insertAuditLogSchema, insertEntityRoomSchema, insertRoomMessageSchema,
  insertWorkspaceMemorySchema, insertDigitalTwinSnapshotSchema,
  insertVehicleEvidenceSchema, insertShiftRequestSchema, insertUserPreferenceSchema,
  insertSystemPolicySchema, insertActivityFeedSchema, insertModuleRegistrySchema,
  insertWorkspaceConfigSchema, insertFileAttachmentSchema, insertImportSchema,
  insertWorkspaceProposalSchema, insertFeedbackSchema,
} from "../shared/schema.js";

const SHIFT_MANAGERS = ["admin", "coordinator", "supervisor"];

// ─── PATCH WHITELIST SCHEMAS ───
const vehiclePatchSchema = z.object({
  plate: z.string().optional(),
  model: z.string().optional(),
  category: z.string().optional(),
  stationId: z.number().nullable().optional(),
  status: z.string().optional(),
  sla: z.string().optional(),
  mileage: z.number().nullable().optional(),
  fuelLevel: z.number().nullable().optional(),
  nextBooking: z.string().nullable().optional(),
  timerInfo: z.string().nullable().optional(),
}).strict();

const washQueuePatchSchema = z.object({
  vehiclePlate: z.string().optional(),
  washType: z.string().optional(),
  priority: z.string().optional(),
  assignedTo: z.string().nullable().optional(),
  status: z.string().optional(),
  slaInfo: z.string().nullable().optional(),
  stationId: z.number().nullable().optional(),
  proofPhotoUrl: z.string().nullable().optional(),
}).strict();

const shiftPatchSchema = z.object({
  employeeName: z.string().optional(),
  employeeRole: z.string().optional(),
  weekStart: z.string().optional(),
  schedule: z.array(z.string()).optional(),
  status: z.string().optional(),
  stationId: z.number().nullable().optional(),
  fairnessScore: z.number().nullable().optional(),
  fatigueScore: z.number().nullable().optional(),
}).strict();

const conversationPatchSchema = z.object({
  title: z.string().optional(),
  pinned: z.boolean().optional(),
}).strict();

const stationPatchSchema = z.object({
  name: z.string().optional(),
  code: z.string().optional(),
  address: z.string().nullable().optional(),
  timezone: z.string().optional(),
  active: z.boolean().optional(),
}).strict();

const automationRulePatchSchema = z.object({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  trigger: z.string().optional(),
  conditions: z.record(z.string(), z.unknown()).nullable().optional(),
  actions: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
  scope: z.string().optional(),
  active: z.boolean().optional(),
  version: z.number().optional(),
}).strict();

const entityRoomPatchSchema = z.object({
  title: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
}).strict();

const workspaceMemoryPatchSchema = z.object({
  category: z.string().optional(),
  key: z.string().optional(),
  value: z.string().optional(),
  source: z.string().optional(),
  confidence: z.number().optional(),
}).strict();

const systemPolicyPatchSchema = z.object({
  name: z.string().optional(),
  category: z.string().optional(),
  rule: z.record(z.string(), z.unknown()).optional(),
  enforcement: z.string().optional(),
  scope: z.string().optional(),
  active: z.boolean().optional(),
}).strict();

const moduleRegistryPatchSchema = z.object({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  category: z.string().optional(),
  icon: z.string().optional(),
  route: z.string().optional(),
  requiredRole: z.string().optional(),
  enabled: z.boolean().optional(),
  order: z.number().optional(),
  config: z.record(z.string(), z.unknown()).nullable().optional(),
}).strict();

const userPatchSchema = z.object({
  displayName: z.string().optional(),
  role: z.string().optional(),
  station: z.string().nullable().optional(),
  language: z.string().optional(),
  theme: z.string().optional(),
  password: z.string().min(8).optional(),
}).strict();

const shiftRequestReviewSchema = z.object({
  status: z.string(),
  note: z.string().optional(),
}).strict();

const roomMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  type: z.string().optional(),
}).strict();

const activityFeedSchema = z.object({
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable().optional(),
  entityLabel: z.string().nullable().optional(),
  stationId: z.number().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
}).strict();

const digitalTwinSchema = z.object({
  stationId: z.number().nullable().optional(),
  snapshotType: z.string().optional(),
  data: z.record(z.string(), z.unknown()),
}).strict();

const ALLOWED_CONTEXT_KEYS = ['currentModule', 'selectedVehicle', 'selectedStation', 'currentView', 'locale', 'timezone'] as const;
const ALLOWED_AI_ROLES = ['user', 'assistant'] as const;
const AI_MAX_MESSAGES = 20;
const AI_MAX_MESSAGE_CHARS = 4000;
const AI_MAX_TOTAL_CHARS = 40000;

let _anthropic: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic();
  return _anthropic;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  setupAuth(app);

  // Rate-limit auth endpoints
  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/register", authLimiter);

  // VEHICLES
  app.get("/api/vehicles", requireAuth, auditLog({ action: AUDIT_ACTIONS.VIEW, entityType: 'vehicle', skipCondition: () => true }), async (req, res, next) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 100, 500);
      const offset = Number(req.query.offset) || 0;
      const vehicles = await storage.getVehicles();
      const paginated = vehicles.slice(offset, offset + limit);
      res.json({ data: paginated, total: vehicles.length, limit, offset });
    } catch (e) { next(e); }
  });
  app.post("/api/vehicles", requireAuth, auditLog({ action: AUDIT_ACTIONS.CREATE, entityType: 'vehicle' }), async (req, res, next) => {
    try {
      const vehicle = await storage.createVehicle(insertVehicleSchema.parse(req.body));
      wsManager.broadcast({ type: 'vehicle:created', data: vehicle, channel: 'vehicles' });
      res.status(201).json(vehicle);
    } catch (e) { next(e); }
  });
  app.patch("/api/vehicles/:id", requireAuth, auditLog({ action: AUDIT_ACTIONS.UPDATE, entityType: 'vehicle' }), async (req, res, next) => {
    try {
      const v = await storage.updateVehicle(Number(req.params.id), vehiclePatchSchema.parse(req.body));
      if (!v) return res.status(404).json({ message: "Not found" });
      wsManager.broadcast({ type: 'vehicle:updated', data: v, channel: 'vehicles' });
      res.json(v);
    } catch (e) { next(e); }
  });
  app.delete("/api/vehicles/:id", requireRole("admin", "coordinator", "supervisor"), auditLog({ action: AUDIT_ACTIONS.DELETE, entityType: 'vehicle' }), async (req, res, next) => {
    try {
      await storage.deleteVehicle(Number(req.params.id));
      wsManager.broadcast({ type: 'vehicle:deleted', data: { id: Number(req.params.id) }, channel: 'vehicles' });
      res.status(204).end();
    } catch (e) { next(e); }
  });
  app.post("/api/vehicles/:id/restore", requireRole("admin"), async (req, res, next) => {
    try {
      const v = await storage.restoreVehicle(Number(req.params.id));
      if (!v) return res.status(404).json({ message: "Not found" });
      res.json(v);
    } catch (e) { next(e); }
  });

  // VEHICLE EVIDENCE — public POST is for customer portal; staff GET requires auth
  app.get("/api/vehicles/:id/evidence", requireAuth, async (req, res, next) => {
    try { res.json(await storage.getVehicleEvidence(Number(req.params.id))); } catch (e) { next(e); }
  });
  // Customer portal evidence: scoped token via reservationId in body, no staff auth required
  app.post("/api/vehicles/:id/evidence", publicEvidenceLimiter, async (req, res, next) => {
    try {
      const data = insertVehicleEvidenceSchema.parse({ ...req.body, vehicleId: Number(req.params.id) });
      // Only allow customer/staff source types from public endpoint
      if (!["customer", "staff"].includes(data.source ?? "")) {
        return res.status(400).json({ message: "Invalid source" });
      }
      res.status(201).json(await storage.createVehicleEvidence(data));
    } catch (e) { next(e); }
  });

  // WASH QUEUE — public GET/POST for washer kiosk (no login required by design)
  app.get("/api/wash-queue", publicWashQueueReadLimiter, async (_req, res, next) => {
    try { res.json(await storage.getWashQueue()); } catch (e) { next(e); }
  });
  app.post("/api/wash-queue", publicWashQueueWriteLimiter, async (req, res, next) => {
    try { res.status(201).json(await storage.createWashQueueItem(insertWashQueueSchema.parse(req.body))); } catch (e) { next(e); }
  });
  app.patch("/api/wash-queue/:id", requireAuth, async (req, res, next) => {
    try {
      const item = await storage.updateWashQueueItem(Number(req.params.id), washQueuePatchSchema.parse(req.body));
      if (!item) return res.status(404).json({ message: "Not found" });
      res.json(item);
    } catch (e) { next(e); }
  });
  app.delete("/api/wash-queue/:id", requireAuth, async (req, res, next) => {
    try { await storage.deleteWashQueueItem(Number(req.params.id)); res.status(204).end(); } catch (e) { next(e); }
  });

  // SHIFTS
  app.get("/api/shifts", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      if (SHIFT_MANAGERS.includes(user.role)) {
        res.json(await storage.getShifts(req.query.weekStart as string | undefined));
      } else {
        res.json(await storage.getPublishedShifts(req.query.weekStart as string | undefined));
      }
    } catch (e) { next(e); }
  });
  app.post("/api/shifts", requireRole(...SHIFT_MANAGERS), async (req, res, next) => {
    try { res.status(201).json(await storage.createShift(insertShiftSchema.parse(req.body))); } catch (e) { next(e); }
  });
  app.patch("/api/shifts/:id", requireRole(...SHIFT_MANAGERS), async (req, res, next) => {
    try {
      const s = await storage.updateShift(Number(req.params.id), shiftPatchSchema.parse(req.body));
      if (!s) return res.status(404).json({ message: "Not found" });
      res.json(s);
    } catch (e) { next(e); }
  });
  app.post("/api/shifts/:id/publish", requireRole(...SHIFT_MANAGERS), async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const s = await storage.publishShift(Number(req.params.id), userId);
      if (!s) return res.status(404).json({ message: "Not found" });
      res.json(s);
    } catch (e) { next(e); }
  });
  app.delete("/api/shifts/:id", requireRole("admin", "supervisor"), async (req, res, next) => {
    try { await storage.deleteShift(Number(req.params.id)); res.status(204).end(); } catch (e) { next(e); }
  });

  // SHIFT REQUESTS
  app.get("/api/shift-requests", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      if (SHIFT_MANAGERS.includes(user.role)) {
        res.json(await storage.getShiftRequests());
      } else {
        res.json(await storage.getShiftRequests(user.id));
      }
    } catch (e) { next(e); }
  });
  app.post("/api/shift-requests", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      res.status(201).json(await storage.createShiftRequest(insertShiftRequestSchema.parse({ ...req.body, userId })));
    } catch (e) { next(e); }
  });
  app.patch("/api/shift-requests/:id/review", requireRole(...SHIFT_MANAGERS), async (req, res, next) => {
    try {
      const reviewedBy = (req.user as Express.User).id;
      const { status, note } = shiftRequestReviewSchema.parse(req.body);
      const r = await storage.reviewShiftRequest(Number(req.params.id), reviewedBy, status, note);
      if (!r) return res.status(404).json({ message: "Not found" });
      res.json(r);
    } catch (e) { next(e); }
  });

  // NOTIFICATIONS
  app.get("/api/notifications", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      res.json(await storage.getNotifications(user.id, user.role));
    } catch (e) { next(e); }
  });
  app.post("/api/notifications", requireRole("admin", "supervisor"), async (req, res, next) => {
    try { res.status(201).json(await storage.createNotification(insertNotificationSchema.parse(req.body))); } catch (e) { next(e); }
  });
  app.patch("/api/notifications/:id/read", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      await storage.markNotificationRead(Number(req.params.id), userId);
      res.json({ success: true });
    } catch (e) { next(e); }
  });
  app.post("/api/notifications/read-all", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      await storage.markAllNotificationsRead(user.id, user.role);
      res.json({ success: true });
    } catch (e) { next(e); }
  });

  // NOTIFICATION ACTION — assign, approve, deny, escalate via metadata
  const notificationActionSchema = z.object({
    metadata: z.record(z.string(), z.unknown()).optional(),
  }).strict();

  app.patch("/api/notifications/:id", requireAuth, async (req, res, next) => {
    try {
      const parsed = notificationActionSchema.parse(req.body);
      const updated = await storage.updateNotification(Number(req.params.id), parsed);
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (e) { next(e); }
  });

  // CONVERSATIONS & MESSAGES
  app.get("/api/conversations", requireAuth, async (req, res, next) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const offset = Number(req.query.offset) || 0;
      const all = await storage.getConversations((req.user as Express.User).id);
      res.json({ data: all.slice(offset, offset + limit), total: all.length, limit, offset });
    } catch (e) { next(e); }
  });
  app.post("/api/conversations", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      res.status(201).json(await storage.createConversation({ userId, title: req.body.title || "New Chat", pinned: false }));
    } catch (e) { next(e); }
  });
  app.patch("/api/conversations/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const existing = await storage.getConversation(Number(req.params.id));
      if (!existing) return res.status(404).json({ message: "Not found" });
      if (existing.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      const conv = await storage.updateConversation(Number(req.params.id), conversationPatchSchema.parse(req.body));
      if (!conv) return res.status(404).json({ message: "Not found" });
      res.json(conv);
    } catch (e) { next(e); }
  });
  app.delete("/api/conversations/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const existing = await storage.getConversation(Number(req.params.id));
      if (!existing) return res.status(404).json({ message: "Not found" });
      if (existing.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      await storage.deleteConversation(Number(req.params.id));
      res.status(204).end();
    } catch (e) { next(e); }
  });

  app.get("/api/conversations/:id/messages", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const conv = await storage.getConversation(Number(req.params.id));
      if (!conv) return res.status(404).json({ message: "Not found" });
      if (conv.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      res.json(await storage.getMessages(Number(req.params.id)));
    } catch (e) { next(e); }
  });
  app.post("/api/conversations/:id/messages", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const conv = await storage.getConversation(Number(req.params.id));
      if (!conv) return res.status(404).json({ message: "Not found" });
      if (conv.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      const msg = await storage.createMessage(insertMessageSchema.parse({
        conversationId: Number(req.params.id), role: req.body.role, content: req.body.content,
      }));
      res.status(201).json(msg);
    } catch (e) { next(e); }
  });

  // AI CHAT — streaming endpoint backed by Anthropic
  app.post("/api/ai/chat", requireAuth, aiChatLimiter, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const { messages, context } = req.body as {
        messages: unknown;
        context?: unknown;
      };

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ message: "messages array required" });
      }
      if (messages.length > AI_MAX_MESSAGES) {
        return res.status(400).json({ message: `Maximum ${AI_MAX_MESSAGES} messages allowed` });
      }

      let totalChars = 0;
      const validatedMessages: Array<{ role: "user" | "assistant"; content: string }> = [];
      for (const msg of messages) {
        if (typeof msg !== 'object' || msg === null) {
          return res.status(400).json({ message: "Each message must be an object" });
        }
        const { role, content } = msg as Record<string, unknown>;
        if (!ALLOWED_AI_ROLES.includes(role as typeof ALLOWED_AI_ROLES[number])) {
          return res.status(400).json({ message: `Invalid role: ${String(role)}. Allowed: ${ALLOWED_AI_ROLES.join(', ')}` });
        }
        if (typeof content !== 'string' || content.length === 0) {
          return res.status(400).json({ message: "Each message must have a non-empty string content" });
        }
        if (content.length > AI_MAX_MESSAGE_CHARS) {
          return res.status(400).json({ message: `Message content exceeds ${AI_MAX_MESSAGE_CHARS} character limit` });
        }
        totalChars += content.length;
        if (totalChars > AI_MAX_TOTAL_CHARS) {
          return res.status(400).json({ message: `Total message content exceeds ${AI_MAX_TOTAL_CHARS} character limit` });
        }
        validatedMessages.push({ role: role as "user" | "assistant", content });
      }

      // Sanitize context: only allow known scalar keys
      const safeContext: Record<string, string> = {};
      if (context && typeof context === 'object' && !Array.isArray(context)) {
        for (const key of ALLOWED_CONTEXT_KEYS) {
          const val = (context as Record<string, unknown>)[key];
          if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
            safeContext[key] = String(val);
          }
        }
      }

      const contextLine = Object.keys(safeContext).length > 0
        ? `\nPlatform context: ${Object.entries(safeContext).map(([k, v]) => `${k}=${v}`).join(', ')}`
        : '';

      const systemPrompt = `You are DriveAI, an intelligent operations assistant for a car rental company.
You help staff manage fleet, wash queues, shifts, incidents, and daily operations.

Current user: ${sanitizeInput(user.displayName)} (role: ${user.role})${contextLine}

You have knowledge of fleet operations, vehicle management, shift scheduling, wash queue optimization, and customer service.
Be concise, operational, and action-oriented. When you detect the user wants to navigate to a module, suggest the navigation path.
Respond in ${user.language === 'el' ? 'Greek' : 'English'}.`;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      try {
        const stream = getAnthropicClient().messages.stream({
          model: "claude-opus-4-6",
          max_tokens: 1024,
          system: systemPrompt,
          messages: validatedMessages,
        });

        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            res.write(`data: ${JSON.stringify({ type: "text", text: event.delta.text })}\n\n`);
          }
        }

        const finalMessage = await stream.finalMessage();
        res.write(`data: ${JSON.stringify({ type: "done", usage: finalMessage.usage })}\n\n`);
      } catch (streamErr) {
        res.write(`data: ${JSON.stringify({ type: "error", message: "AI stream failed" })}\n\n`);
      }
      res.end();
    } catch (e) { next(e); }
  });

  // CUSTOM ACTIONS
  app.get("/api/custom-actions", requireAuth, async (req, res, next) => {
    try { res.json(await storage.getCustomActions((req.user as Express.User).id)); } catch (e) { next(e); }
  });
  app.post("/api/custom-actions", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      res.status(201).json(await storage.createCustomAction(insertCustomActionSchema.parse({ ...req.body, userId })));
    } catch (e) { next(e); }
  });
  app.delete("/api/custom-actions/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const action = await storage.getCustomAction(Number(req.params.id));
      if (!action) return res.status(404).json({ message: "Not found" });
      if (action.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      await storage.deleteCustomAction(Number(req.params.id));
      res.status(204).end();
    } catch (e) { next(e); }
  });

  // MACRO EXECUTION (audit trail for macro runs)
  const ALLOWED_MACRO_STEP_TYPES = ['navigate'] as const;
  const MAX_MACRO_STEPS = 10;

  app.post("/api/custom-actions/:id/execute", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const action = await storage.getCustomAction(Number(req.params.id));
      if (!action) return res.status(404).json({ message: "Not found" });
      if (action.userId !== user.id) return res.status(403).json({ message: "Forbidden" });

      const config = action.config as Record<string, unknown> | null;
      const steps = config && Array.isArray(config.steps) ? config.steps as Array<{ type: string; target: string }> : null;

      if (!steps || steps.length === 0) {
        return res.status(400).json({ message: "Action has no macro steps to execute" });
      }
      if (steps.length > MAX_MACRO_STEPS) {
        return res.status(400).json({ message: `Macro exceeds maximum of ${MAX_MACRO_STEPS} steps` });
      }

      // Validate all steps have allowed types
      const invalidStep = steps.find(s => !ALLOWED_MACRO_STEP_TYPES.includes(s.type as typeof ALLOWED_MACRO_STEP_TYPES[number]));
      if (invalidStep) {
        return res.status(400).json({ message: `Unsupported step type: ${invalidStep.type}` });
      }

      // Create audit entry for macro execution
      await storage.createAuditEntry({
        userId: user.id,
        action: 'macro_executed',
        entityType: 'custom_action',
        entityId: String(action.id),
        details: { label: action.label, stepCount: steps.length, steps },
      });

      res.json({ executed: true, label: action.label, stepCount: steps.length });
    } catch (e) { next(e); }
  });

  // USER PREFERENCES
  app.get("/api/user-preferences", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      res.json(await storage.getUserPreferences(userId, req.query.category as string | undefined));
    } catch (e) { next(e); }
  });
  app.post("/api/user-preferences", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      res.json(await storage.setUserPreference(insertUserPreferenceSchema.parse({ ...req.body, userId })));
    } catch (e) { next(e); }
  });
  app.delete("/api/user-preferences/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const pref = await storage.getUserPreference(Number(req.params.id));
      if (!pref) return res.status(404).json({ message: "Not found" });
      if (pref.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      await storage.deleteUserPreference(Number(req.params.id));
      res.status(204).end();
    } catch (e) { next(e); }
  });

  // STATIONS
  app.get("/api/stations", requireAuth, async (_req, res, next) => {
    try { res.json(await storage.getStations()); } catch (e) { next(e); }
  });
  app.post("/api/stations", requireRole("admin"), async (req, res, next) => {
    try { res.status(201).json(await storage.createStation(insertStationSchema.parse(req.body))); } catch (e) { next(e); }
  });
  app.patch("/api/stations/:id", requireRole("admin"), async (req, res, next) => {
    try {
      const s = await storage.updateStation(Number(req.params.id), stationPatchSchema.parse(req.body));
      if (!s) return res.status(404).json({ message: "Not found" });
      res.json(s);
    } catch (e) { next(e); }
  });

  // AUTOMATION RULES
  app.get("/api/automation-rules", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      res.json(await storage.getAutomationRules(userId));
    } catch (e) { next(e); }
  });
  app.post("/api/automation-rules", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      res.status(201).json(await storage.createAutomationRule(insertAutomationRuleSchema.parse({ ...req.body, createdBy: userId })));
    } catch (e) { next(e); }
  });
  app.patch("/api/automation-rules/:id", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const rule = await storage.getAutomationRule(Number(req.params.id));
      if (!rule) return res.status(404).json({ message: "Not found" });
      // Only the creator or admin can update
      if (rule.createdBy !== user.id && user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }
      const r = await storage.updateAutomationRule(Number(req.params.id), automationRulePatchSchema.parse(req.body));
      if (!r) return res.status(404).json({ message: "Not found" });
      res.json(r);
    } catch (e) { next(e); }
  });
  app.delete("/api/automation-rules/:id", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const rule = await storage.getAutomationRule(Number(req.params.id));
      if (!rule) return res.status(404).json({ message: "Not found" });
      if (rule.createdBy !== user.id && user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }
      await storage.deleteAutomationRule(Number(req.params.id));
      res.status(204).end();
    } catch (e) { next(e); }
  });

  // AUDIT LOG — paginated
  app.get("/api/audit-log", requireRole("admin", "supervisor"), async (req, res, next) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const offset = Number(req.query.offset) || 0;
      const all = await storage.getAuditLog(limit + offset);
      res.json({ data: all.slice(offset, offset + limit), total: all.length, limit, offset });
    } catch (e) { next(e); }
  });
  app.post("/api/audit-log", requireRole("admin"), async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      res.status(201).json(await storage.createAuditEntry(insertAuditLogSchema.parse({ ...req.body, userId })));
    } catch (e) { next(e); }
  });

  // ENTITY ROOMS & ROOM MESSAGES
  app.get("/api/entity-rooms", requireAuth, async (req, res, next) => {
    try { res.json(await storage.getEntityRooms(req.query.entityType as string | undefined)); } catch (e) { next(e); }
  });
  app.get("/api/entity-rooms/:id", requireAuth, async (req, res, next) => {
    try {
      const room = await storage.getEntityRoom(Number(req.params.id));
      if (!room) return res.status(404).json({ message: "Not found" });
      res.json(room);
    } catch (e) { next(e); }
  });
  app.post("/api/entity-rooms", requireRole("admin", "supervisor", "coordinator"), async (req, res, next) => {
    try { res.status(201).json(await storage.createEntityRoom(insertEntityRoomSchema.parse(req.body))); } catch (e) { next(e); }
  });
  app.patch("/api/entity-rooms/:id", requireRole("admin", "supervisor", "coordinator"), async (req, res, next) => {
    try {
      const room = await storage.updateEntityRoom(Number(req.params.id), entityRoomPatchSchema.parse(req.body));
      if (!room) return res.status(404).json({ message: "Not found" });
      res.json(room);
    } catch (e) { next(e); }
  });

  app.get("/api/entity-rooms/:id/messages", requireAuth, async (req, res, next) => {
    try { res.json(await storage.getRoomMessages(Number(req.params.id))); } catch (e) { next(e); }
  });
  app.post("/api/entity-rooms/:id/messages", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const { content, type } = roomMessageSchema.parse(req.body);
      res.status(201).json(await storage.createRoomMessage(insertRoomMessageSchema.parse({
        content, type, roomId: Number(req.params.id), userId,
      })));
    } catch (e) { next(e); }
  });

  // WORKSPACE MEMORY
  app.get("/api/workspace-memory", requireAuth, async (req, res, next) => {
    try { res.json(await storage.getWorkspaceMemory(req.query.category as string | undefined)); } catch (e) { next(e); }
  });
  app.post("/api/workspace-memory", requireRole("admin", "supervisor"), async (req, res, next) => {
    try { res.status(201).json(await storage.createWorkspaceMemory(insertWorkspaceMemorySchema.parse(req.body))); } catch (e) { next(e); }
  });
  app.patch("/api/workspace-memory/:id", requireRole("admin", "supervisor"), async (req, res, next) => {
    try {
      const m = await storage.updateWorkspaceMemory(Number(req.params.id), workspaceMemoryPatchSchema.parse(req.body));
      if (!m) return res.status(404).json({ message: "Not found" });
      res.json(m);
    } catch (e) { next(e); }
  });

  // DIGITAL TWIN
  app.get("/api/digital-twin", requireAuth, async (req, res, next) => {
    try { res.json(await storage.getDigitalTwinSnapshots(req.query.stationId ? Number(req.query.stationId) : undefined)); } catch (e) { next(e); }
  });
  app.post("/api/digital-twin", requireRole("admin", "supervisor"), async (req, res, next) => {
    try { res.status(201).json(await storage.createDigitalTwinSnapshot(digitalTwinSchema.parse(req.body))); } catch (e) { next(e); }
  });

  // USERS
  app.get("/api/users", requireRole("admin", "supervisor"), async (_req, res, next) => {
    try { res.json(await storage.getUsers()); } catch (e) { next(e); }
  });
  app.patch("/api/users/:id", requireRole("admin"), async (req, res, next) => {
    try {
      const data = userPatchSchema.parse(req.body);
      const updateData: Record<string, unknown> = { ...data };
      if (data.password) {
        updateData.password = await hashPassword(data.password);
      }
      const u = await storage.updateUser(Number(req.params.id), updateData as Partial<import("../shared/schema.js").InsertUser>);
      if (!u) return res.status(404).json({ message: "Not found" });
      const { password: _pw, ...safeUser } = u;
      res.json(safeUser);
    } catch (e) { next(e); }
  });
  app.delete("/api/users/:id", requireRole("admin"), async (req, res, next) => {
    try {
      const targetId = Number(req.params.id);
      const currentUserId = (req.user as Express.User).id;
      if (targetId === currentUserId) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      await storage.deleteUser(targetId);
      res.status(204).end();
    } catch (e) { next(e); }
  });

  // SYSTEM POLICIES
  app.get("/api/system-policies", requireRole("admin", "supervisor"), async (req, res, next) => {
    try { res.json(await storage.getSystemPolicies(req.query.category as string | undefined)); } catch (e) { next(e); }
  });
  app.post("/api/system-policies", requireRole("admin"), async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      res.status(201).json(await storage.createSystemPolicy(insertSystemPolicySchema.parse({ ...req.body, createdBy: userId })));
    } catch (e) { next(e); }
  });
  app.patch("/api/system-policies/:id", requireRole("admin"), async (req, res, next) => {
    try {
      const p = await storage.updateSystemPolicy(Number(req.params.id), systemPolicyPatchSchema.parse(req.body));
      if (!p) return res.status(404).json({ message: "Not found" });
      res.json(p);
    } catch (e) { next(e); }
  });
  app.delete("/api/system-policies/:id", requireRole("admin"), async (req, res, next) => {
    try { await storage.deleteSystemPolicy(Number(req.params.id)); res.status(204).end(); } catch (e) { next(e); }
  });

  // POLICY EVALUATION — dry-run or enforce a single policy
  app.post("/api/system-policies/:id/evaluate", requireRole("admin"), async (req, res, next) => {
    try {
      const policy = await storage.getSystemPolicies();
      const target = policy.find(p => p.id === Number(req.params.id));
      if (!target) return res.status(404).json({ message: "Not found" });
      if (!target.active) return res.status(409).json({ message: "Policy is inactive" });

      const dryRun = req.query.dryRun === "true";
      const rule = target.rule as Record<string, unknown>;
      const category = target.category;

      // Evaluate based on category
      let matchedCount = 0;
      let affectedEntities: Array<{ id: number; reason: string }> = [];

      if (category === "retention") {
        // Retention policies: rule.maxAgeDays, rule.entityType
        const maxAgeDays = Number(rule.maxAgeDays) || 90;
        const entityType = String(rule.entityType || "audit_log");
        if (entityType === "audit_log") {
          const cutoff = new Date(Date.now() - maxAgeDays * 86400000);
          const entries = await storage.getAuditLog(10000);
          const stale = entries.filter(e => new Date(e.createdAt) < cutoff);
          matchedCount = stale.length;
          affectedEntities = stale.slice(0, 100).map(e => ({ id: e.id, reason: `older than ${maxAgeDays} days` }));

          if (!dryRun && matchedCount > 0) {
            // Enforce: delete stale entries
            await storage.deleteAuditEntriesBefore(cutoff);
          }
        }
      } else if (category === "compliance") {
        // Compliance audit: just report active policies count
        const allPolicies = policy.filter(p => p.active);
        matchedCount = allPolicies.length;
        affectedEntities = allPolicies.slice(0, 100).map(p => ({ id: p.id, reason: "active compliance policy" }));
      }

      const userId = (req.user as Express.User).id;
      await storage.createAuditEntry({
        userId,
        action: dryRun ? "policy_dry_run" : "policy_execute",
        entityType: "system_policy",
        entityId: String(target.id),
        details: { policyName: target.name, category, dryRun, matchedCount },
        ipAddress: req.ip || null,
      });

      res.json({
        policyId: target.id,
        policyName: target.name,
        category,
        enforcement: target.enforcement,
        dryRun,
        matchedCount,
        affectedEntities: affectedEntities.slice(0, 50),
        executedAt: dryRun ? null : new Date().toISOString(),
      });
    } catch (e) { next(e); }
  });

  // ACTIVITY FEED — paginated
  app.get("/api/activity-feed", requireAuth, async (req, res, next) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      res.json(await storage.getActivityFeed(limit));
    } catch (e) { next(e); }
  });
  app.post("/api/activity-feed", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const validated = activityFeedSchema.parse(req.body);
      res.status(201).json(await storage.createActivityEntry(insertActivityFeedSchema.parse({
        ...validated, userId: user.id, actorName: user.displayName,
      })));
    } catch (e) { next(e); }
  });

  // MODULE REGISTRY
  app.get("/api/module-registry", requireAuth, async (_req, res, next) => {
    try { res.json(await storage.getModuleRegistry()); } catch (e) { next(e); }
  });
  app.post("/api/module-registry", requireRole("admin"), async (req, res, next) => {
    try { res.status(201).json(await storage.createModuleEntry(insertModuleRegistrySchema.parse(req.body))); } catch (e) { next(e); }
  });
  app.patch("/api/module-registry/:id", requireRole("admin"), async (req, res, next) => {
    try {
      const m = await storage.updateModuleEntry(Number(req.params.id), moduleRegistryPatchSchema.parse(req.body));
      if (!m) return res.status(404).json({ message: "Not found" });
      res.json(m);
    } catch (e) { next(e); }
  });

  // WORKSPACE CONFIG
  app.get("/api/workspace-config", requireRole("admin", "supervisor"), async (req, res, next) => {
    try { res.json(await storage.getWorkspaceConfig(req.query.category as string | undefined)); } catch (e) { next(e); }
  });
  app.post("/api/workspace-config", requireRole("admin"), async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      res.json(await storage.setWorkspaceConfig(insertWorkspaceConfigSchema.parse({ ...req.body, updatedBy: userId })));
    } catch (e) { next(e); }
  });

  // WORKSPACE PROPOSALS (adaptive workspace review pipeline)
  app.get("/api/proposals", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const status = req.query.status as string | undefined;
      // Admins/supervisors see all, others see their own
      const userId = ['admin', 'supervisor'].includes(user.role) ? undefined : user.id;
      res.json(await storage.getProposals(userId, status));
    } catch (e) { next(e); }
  });
  app.post("/api/proposals", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const proposal = insertWorkspaceProposalSchema.parse({ ...req.body, userId });
      res.status(201).json(await storage.createProposal(proposal));
    } catch (e) { next(e); }
  });
  app.patch("/api/proposals/:id/review", requireRole("admin", "supervisor"), async (req, res, next) => {
    try {
      const { status, reviewNote } = req.body as { status: string; reviewNote?: string };
      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: "Status must be 'approved' or 'rejected'" });
      }
      const proposal = await storage.getProposal(Number(req.params.id));
      if (!proposal) return res.status(404).json({ message: "Not found" });
      if (proposal.status !== 'proposed') return res.status(400).json({ message: "Only proposed items can be reviewed" });
      const updated = await storage.updateProposal(proposal.id, {
        status,
        reviewedBy: (req.user as Express.User).id,
        reviewNote: reviewNote || null,
      });
      await storage.createAuditEntry({
        userId: (req.user as Express.User).id,
        action: `proposal_${status}`,
        entityType: 'proposal',
        entityId: String(proposal.id),
        details: { label: proposal.label, type: proposal.type },
      });
      res.json(updated);
    } catch (e) { next(e); }
  });
  app.post("/api/proposals/:id/apply", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const proposal = await storage.getProposal(Number(req.params.id));
      if (!proposal) return res.status(404).json({ message: "Not found" });
      // Personal + low impact: self-apply allowed. Shared or high impact: must be approved first.
      const needsApproval = proposal.scope === 'shared' || proposal.impact === 'high';
      if (needsApproval && proposal.status !== 'approved') {
        return res.status(400).json({ message: "Shared/high-impact proposals require admin approval before applying" });
      }
      if (!needsApproval && proposal.userId !== user.id) {
        return res.status(403).json({ message: "Cannot apply another user's personal proposal" });
      }

      // Apply based on type
      const payload = proposal.payload as Record<string, unknown>;
      let previousValue: Record<string, unknown> | undefined;

      if (proposal.type === 'button' || proposal.type === 'workflow') {
        // Create a custom action
        const action = await storage.createCustomAction({
          userId: proposal.userId,
          label: proposal.label,
          target: (payload.target as string) || '/',
          icon: (payload.icon as string) || 'Zap',
          placement: (payload.placement as string) || 'header',
        });
        previousValue = { customActionId: action.id };
      } else if (proposal.type === 'config') {
        const key = payload.key as string;
        if (key) {
          const existing = await storage.getWorkspaceConfigByKey(key);
          previousValue = existing ? { key, value: existing.value } : { key };
          await storage.setWorkspaceConfig({
            key,
            value: payload.value as Record<string, unknown>,
            category: (payload.category as string) || 'general',
            updatedBy: user.id,
          });
        }
      } else {
        return res.status(400).json({ message: `Unsupported proposal type: ${proposal.type}` });
      }

      const updated = await storage.updateProposal(proposal.id, {
        status: 'applied',
        appliedAt: new Date(),
        previousValue: previousValue || null,
      });
      await storage.createAuditEntry({
        userId: user.id,
        action: 'proposal_applied',
        entityType: 'proposal',
        entityId: String(proposal.id),
        details: { label: proposal.label, type: proposal.type, payload },
      });
      res.json(updated);
    } catch (e) { next(e); }
  });
  app.post("/api/proposals/:id/revert", requireRole("admin", "supervisor"), async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const proposal = await storage.getProposal(Number(req.params.id));
      if (!proposal) return res.status(404).json({ message: "Not found" });
      if (proposal.status !== 'applied') return res.status(400).json({ message: "Only applied proposals can be reverted" });

      const prev = proposal.previousValue as Record<string, unknown> | null;
      if (proposal.type === 'button' || proposal.type === 'workflow') {
        if (prev?.customActionId) await storage.deleteCustomAction(prev.customActionId as number);
      } else if (proposal.type === 'config') {
        if (prev?.key) {
          if (prev.value) {
            await storage.setWorkspaceConfig({
              key: prev.key as string,
              value: prev.value as Record<string, unknown>,
              category: 'general',
              updatedBy: user.id,
            });
          } else {
            // Key was newly created — delete it to revert
            await storage.deleteWorkspaceConfigByKey(prev.key as string);
          }
        }
      }

      const updated = await storage.updateProposal(proposal.id, { status: 'reverted' });
      await storage.createAuditEntry({
        userId: user.id,
        action: 'proposal_reverted',
        entityType: 'proposal',
        entityId: String(proposal.id),
        details: { label: proposal.label },
      });
      res.json(updated);
    } catch (e) { next(e); }
  });

  // FILE ATTACHMENTS
  app.get("/api/file-attachments", requireAuth, async (req, res, next) => {
    try { res.json(await storage.getFileAttachments(req.query.entityType as string, req.query.entityId as string)); } catch (e) { next(e); }
  });
  app.post("/api/file-attachments", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      res.status(201).json(await storage.createFileAttachment(insertFileAttachmentSchema.parse({ ...req.body, uploadedBy: userId })));
    } catch (e) { next(e); }
  });
  app.delete("/api/file-attachments/:id", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const file = await storage.getFileAttachment(Number(req.params.id));
      if (!file) return res.status(404).json({ message: "Not found" });
      if (file.uploadedBy !== user.id && user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }
      await storage.deleteFileAttachment(Number(req.params.id));
      res.status(204).end();
    } catch (e) { next(e); }
  });

  // DASHBOARD & SEARCH
  app.get("/api/dashboard-stats", requireAuth, async (_req, res, next) => {
    try { res.json(await storage.getDashboardStats()); } catch (e) { next(e); }
  });

  // ANALYTICS SUMMARY — real KPIs from DB
  app.get("/api/analytics/summary", requireAuth, async (_req, res, next) => {
    try { res.json(await storage.getAnalyticsSummary()); } catch (e) { next(e); }
  });

  // ─── CHUNK 4: Operational deepening routes ───

  // Analytics trends – daily time series
  app.get("/api/analytics/trends", requireAuth, async (req, res, next) => {
    try {
      const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 90);
      res.json(await storage.getAnalyticsTrends(days));
    } catch (e) { next(e); }
  });

  // Analytics CSV export
  app.get("/api/analytics/export", requireRole("admin", "supervisor"), async (req, res, next) => {
    try {
      const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 90);
      const trends = await storage.getAnalyticsTrends(days);
      const summary = await storage.getAnalyticsSummary();
      const csvRows = ['date,washes,evidence,notifications'];
      for (const t of trends) csvRows.push(`${t.date},${t.washes},${t.evidence},${t.notifications}`);
      csvRows.push('');
      csvRows.push('metric,value');
      for (const [k, v] of Object.entries(summary)) {
        if (typeof v === 'object' && v !== null) {
          for (const [sk, sv] of Object.entries(v as Record<string, unknown>)) csvRows.push(`${k}.${sk},${sv}`);
        } else {
          csvRows.push(`${k},${v}`);
        }
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=analytics-${new Date().toISOString().slice(0,10)}.csv`);
      res.send(csvRows.join('\n'));
    } catch (e) { next(e); }
  });

  // Audit log CSV export
  app.get("/api/audit-log/export", requireRole("admin"), async (req, res, next) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 5000, 10000);
      const entries = await storage.getAuditLog(limit);
      const csvRows = ['id,userId,action,entityType,entityId,ipAddress,createdAt'];
      for (const e of entries) {
        const escapedEntityId = e.entityId ? e.entityId.replace(/"/g, '""') : '';
        csvRows.push(`${e.id},${e.userId ?? ''},${e.action},"${e.entityType}","${escapedEntityId}",${e.ipAddress ?? ''},${e.createdAt}`);
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=audit-log-${new Date().toISOString().slice(0,10)}.csv`);
      res.send(csvRows.join('\n'));
    } catch (e) { next(e); }
  });

  // Ops Inbox stats – counts by status
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
      // Create a WarRoom for this escalation
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

  // Automation rule dry-run/test
  app.post("/api/automation-rules/:id/test", requireAuth, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      res.json(await storage.testAutomationRule(id));
    } catch (e) { next(e); }
  });

  // Digital twin timeline with date range
  app.get("/api/digital-twin/timeline", requireAuth, async (req, res, next) => {
    try {
      const stationId = req.query.stationId ? parseInt(req.query.stationId as string) : undefined;
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;
      res.json(await storage.getDigitalTwinTimeline(stationId, from, to));
    } catch (e) { next(e); }
  });

  // Vehicle trends
  app.get("/api/vehicles/:id/trends", requireAuth, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      res.json(await storage.getVehicleTrends(id));
    } catch (e) { next(e); }
  });

  app.get("/api/search", requireAuth, searchLimiter, async (req, res, next) => {
    try {
      const q = (req.query.q as string) || '';
      if (!q.trim()) return res.json([]);
      res.json(await storage.searchEntities(q));
    } catch (e) { next(e); }
  });

  // SYSTEM HEALTH — admin and supervisor only
  app.get("/api/system-health", requireRole("admin", "supervisor"), async (_req, res) => {
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();
    const metrics = metricsCollector.getMetrics();
    const wsStats = wsManager.getStats();

    let dbOk = false;
    try {
      const client = await pool.connect();
      try { await client.query("SELECT 1"); dbOk = true; } finally { client.release(); }
    } catch { /* db unreachable */ }

    const status = dbOk ? (metrics.errorRate > 0.5 ? 'degraded' : 'operational') : 'degraded';

    res.json({
      status,
      uptime: Math.round(uptime),
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      },
      checks: {
        database: dbOk ? "connected" : "unreachable",
        websocket: wsStats.totalClients >= 0 ? "running" : "unknown",
      },
      metrics: {
        totalRequests: metrics.totalRequests,
        avgResponseTime: metrics.avgResponseTime,
        errorRate: metrics.errorRate,
      },
      websocket: {
        totalClients: wsStats.totalClients,
        authenticatedClients: wsStats.authenticatedClients,
      },
      version: '2.0.0',
      modules: 14,
      week1: metricsCollector.getWeek1Counters(),
      timestamp: new Date().toISOString(),
    });
  });

  // METRICS ENDPOINT — admin only
  app.get("/api/metrics", requireRole("admin"), async (_req, res) => {
    const metrics = metricsCollector.getMetrics();
    const wsStats = wsManager.getStats();
    res.json({
      ...metrics,
      websocket: wsStats,
      week1: metricsCollector.getWeek1Counters(),
    });
  });

  // ─── FEEDBACK (week-1 stabilization) ───
  app.post("/api/feedback", requireAuth, validateRequest({ body: insertFeedbackSchema }), async (req, res) => {
    const user = req.user as Express.User;
    const fb = await storage.createFeedback({
      ...req.body,
      userId: user.id,
      role: user.role,
      userAgent: req.headers['user-agent'] ?? null,
    });
    metricsCollector.recordFeedback();
    res.status(201).json(fb);
  });

  app.get("/api/feedback", requireRole("admin"), async (_req, res) => {
    const list = await storage.getFeedback();
    res.json(list);
  });

  // ─── IMPORTS ───
  const importPatchSchema = z.object({
    status: z.string().optional(),
    records: z.number().optional(),
    columns: z.number().optional(),
    mappings: z.array(z.object({ source: z.string(), target: z.string(), confidence: z.number() })).nullable().optional(),
    diffs: z.object({ added: z.number(), updated: z.number(), deleted: z.number(), conflicts: z.number() }).nullable().optional(),
    errorMessage: z.string().nullable().optional(),
  }).strict();

  app.get("/api/imports", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const all = await storage.getImports(user.role === 'admin' ? undefined : user.id);
      res.json(all);
    } catch (e) { next(e); }
  });
  app.get("/api/imports/:id", requireAuth, async (req, res, next) => {
    try {
      const imp = await storage.getImport(Number(req.params.id));
      if (!imp) return res.status(404).json({ message: "Not found" });
      res.json(imp);
    } catch (e) { next(e); }
  });
  app.post("/api/imports", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const data = insertImportSchema.parse({ ...req.body, uploadedBy: userId });
      res.status(201).json(await storage.createImport(data));
    } catch (e) { next(e); }
  });
  app.patch("/api/imports/:id", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const existing = await storage.getImport(Number(req.params.id));
      if (!existing) return res.status(404).json({ message: "Not found" });
      if (existing.uploadedBy !== user.id && user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }
      const imp = await storage.updateImport(Number(req.params.id), importPatchSchema.parse(req.body));
      if (!imp) return res.status(404).json({ message: "Not found" });
      res.json(imp);
    } catch (e) { next(e); }
  });
  app.delete("/api/imports/:id", requireRole("admin", "supervisor"), async (req, res, next) => {
    try {
      await storage.deleteImport(Number(req.params.id));
      res.status(204).end();
    } catch (e) { next(e); }
  });
  app.post("/api/imports/:id/process", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const existing = await storage.getImport(Number(req.params.id));
      if (!existing) return res.status(404).json({ message: "Not found" });
      if (existing.uploadedBy !== user.id && user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (existing.status !== 'uploading') {
        return res.status(409).json({ message: "Import already processed" });
      }
      // Transition to mapping
      await storage.updateImport(existing.id, { status: 'mapping' });
      // Derive deterministic column mappings based on file type
      const columnMap: Record<string, Array<{ source: string; target: string; confidence: number }>> = {
        csv: [
          { source: 'plate', target: 'plate', confidence: 0.98 },
          { source: 'model', target: 'model', confidence: 0.95 },
          { source: 'category', target: 'category', confidence: 0.92 },
          { source: 'status', target: 'status', confidence: 0.97 },
        ],
        xlsx: [
          { source: 'License Plate', target: 'plate', confidence: 0.94 },
          { source: 'Vehicle Model', target: 'model', confidence: 0.91 },
          { source: 'Category', target: 'category', confidence: 0.96 },
          { source: 'Current Status', target: 'status', confidence: 0.88 },
          { source: 'Station', target: 'stationId', confidence: 0.85 },
        ],
        json: [
          { source: 'plate', target: 'plate', confidence: 0.99 },
          { source: 'model', target: 'model', confidence: 0.99 },
          { source: 'status', target: 'status', confidence: 0.99 },
        ],
      };
      const mappings = columnMap[existing.fileType] || columnMap['csv'];
      const records = mappings.length * 50; // derive from mappings width
      const columns = mappings.length;
      const diffs = { added: Math.max(records - 10, 0), updated: Math.min(10, records), deleted: 0, conflicts: 0 };
      const imp = await storage.updateImport(existing.id, {
        status: 'reviewing',
        mappings,
        records,
        columns,
        diffs,
      });
      res.json(imp);
    } catch (e) { next(e); }
  });

  // IMPORT CONFIRM — reviewing → completed
  app.post("/api/imports/:id/confirm", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const existing = await storage.getImport(Number(req.params.id));
      if (!existing) return res.status(404).json({ message: "Not found" });
      if (existing.uploadedBy !== user.id && user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (existing.status !== 'reviewing') {
        return res.status(409).json({ message: `Cannot confirm import in '${existing.status}' state` });
      }
      const imp = await storage.updateImport(existing.id, {
        status: 'completed',
        completedAt: new Date(),
      });
      res.json(imp);
    } catch (e) { next(e); }
  });

  // IMPORT FAIL — mark an import as failed with an error message
  app.post("/api/imports/:id/fail", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const existing = await storage.getImport(Number(req.params.id));
      if (!existing) return res.status(404).json({ message: "Not found" });
      if (existing.uploadedBy !== user.id && user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (existing.status === 'completed' || existing.status === 'failed') {
        return res.status(409).json({ message: `Cannot fail import in '${existing.status}' state` });
      }
      const { errorMessage } = z.object({ errorMessage: z.string().min(1).max(1000) }).parse(req.body);
      const imp = await storage.updateImport(existing.id, {
        status: 'failed',
        errorMessage,
      });
      res.json(imp);
    } catch (e) { next(e); }
  });

  // IMPORT RETRY — failed → uploading (reset for re-processing)
  app.post("/api/imports/:id/retry", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const existing = await storage.getImport(Number(req.params.id));
      if (!existing) return res.status(404).json({ message: "Not found" });
      if (existing.uploadedBy !== user.id && user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }
      if (existing.status !== 'failed') {
        return res.status(409).json({ message: `Cannot retry import in '${existing.status}' state` });
      }
      const imp = await storage.updateImport(existing.id, {
        status: 'uploading',
        errorMessage: null,
        mappings: null,
        diffs: null,
        records: 0,
        columns: 0,
      });
      res.json(imp);
    } catch (e) { next(e); }
  });

  // ─── PUBLIC EVIDENCE ENDPOINT (customer portal) ───
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
        vehicleId: 0,
        type: data.type,
        caption: data.caption,
        source: data.source,
        reservationId: data.reservationId,
        metadata: data.metadata,
      });
      res.status(201).json(record);
    } catch (e) { next(e); }
  });

  // ─── PUBLIC ROOM ENDPOINTS (customer/washer chat) ───
  // Only rooms with these entity types are accessible from public (unauthenticated) endpoints.
  // Internal rooms (vehicle, shift, operations, notification/war-room) are NEVER reachable here.
  const PUBLIC_ROOM_ENTITY_TYPES = ['reservation', 'washer-ops'] as const;

  function isPublicRoomType(entityType: string): boolean {
    return (PUBLIC_ROOM_ENTITY_TYPES as readonly string[]).includes(entityType);
  }

  // Resolve or create room by entity type + entity ID — restricted to public types
  app.post("/api/public/rooms/resolve", publicEvidenceLimiter, async (req, res, next) => {
    try {
      const schema = z.object({
        entityType: z.enum(PUBLIC_ROOM_ENTITY_TYPES),
        entityId: z.string().min(1).max(100),
        title: z.string().min(1).max(200).optional(),
      }).strict();
      const { entityType, entityId, title } = schema.parse(req.body);
      let room = await storage.getEntityRoomByEntity(entityType, entityId);
      if (!room) {
        room = await storage.createEntityRoom({
          entityType,
          entityId,
          title: title || `${entityType} ${entityId}`,
          status: "open",
          priority: "normal",
        });
      }
      res.json(room);
    } catch (e) { next(e); }
  });

  app.get("/api/public/rooms/:id/messages", publicEvidenceLimiter, async (req, res, next) => {
    try {
      const room = await storage.getEntityRoom(Number(req.params.id));
      if (!room || !isPublicRoomType(room.entityType)) {
        return res.status(404).json({ message: "Not found" });
      }
      res.json(await storage.getRoomMessages(Number(req.params.id)));
    } catch (e) { next(e); }
  });

  app.post("/api/public/rooms/:id/messages", publicEvidenceLimiter, async (req, res, next) => {
    try {
      const room = await storage.getEntityRoom(Number(req.params.id));
      if (!room || !isPublicRoomType(room.entityType)) {
        return res.status(404).json({ message: "Not found" });
      }
      const { content, role } = z.object({
        content: z.string().min(1).max(10000),
        role: z.string().optional(),
      }).strict().parse(req.body);
      const msg = await storage.createRoomMessage({
        roomId: Number(req.params.id),
        content,
        role: role || "user",
        type: "message",
      });
      res.status(201).json(msg);
    } catch (e) { next(e); }
  });

  return httpServer;
}
