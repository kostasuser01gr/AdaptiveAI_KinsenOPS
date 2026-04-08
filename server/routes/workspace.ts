import type { Express } from "express";
import { z } from "zod/v4";
import { storage } from "../storage.js";
import { requireAuth, requireRole } from "../auth.js";
import { auditLog, AUDIT_ACTIONS } from "../middleware/audit.js";
import {
  entityRoomPatchSchema, workspaceMemoryPatchSchema, systemPolicyPatchSchema,
  moduleRegistryPatchSchema, activityFeedSchema, digitalTwinSchema, roomMessageSchema,
  SHIFT_MANAGERS,
} from "./_helpers.js";
import { resolveStationScope } from "../middleware/stationScope.js";
import {
  insertEntityRoomSchema, insertRoomMessageSchema, insertWorkspaceMemorySchema,
  insertSystemPolicySchema, insertActivityFeedSchema, insertModuleRegistrySchema,
  insertWorkspaceConfigSchema, insertWorkspaceProposalSchema, insertFeedbackSchema,
  insertCustomActionSchema,
} from "../../shared/schema.js";
import { validateRequest } from "../middleware/validation.js";
import { metricsCollector } from "../observability/metrics.js";

export function registerWorkspaceRoutes(app: Express) {
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
    try {
      const room = await storage.getEntityRoom(Number(req.params.id));
      if (!room) return res.status(404).json({ message: "Not found" });
      res.json(await storage.getRoomMessages(room.id));
    } catch (e) { next(e); }
  });
  app.post("/api/entity-rooms/:id/messages", requireAuth, async (req, res, next) => {
    try {
      const room = await storage.getEntityRoom(Number(req.params.id));
      if (!room) return res.status(404).json({ message: "Not found" });
      const userId = (req.user as Express.User).id;
      const { content, type } = roomMessageSchema.parse(req.body);
      res.status(201).json(await storage.createRoomMessage(insertRoomMessageSchema.parse({
        content, type, roomId: room.id, userId,
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

  // WORKSPACE MEMORY SEARCH
  app.get("/api/workspace-memory/search", requireAuth, async (req, res, next) => {
    try {
      const query = String(req.query.q || '').trim();
      const category = req.query.category ? String(req.query.category) : undefined;
      const limit = Math.min(Number(req.query.limit) || 10, 50);

      if (!query) return res.status(400).json({ message: "Query parameter 'q' required" });

      const all = await storage.getWorkspaceMemory(category);
      const lowerQuery = query.toLowerCase();
      const queryTokens = lowerQuery.split(/\s+/).filter(t => t.length > 2);

      const scored = all.map(entry => {
        let score = 0;
        const keyLower = entry.key.toLowerCase();
        const valueLower = entry.value.toLowerCase();
        const categoryLower = entry.category.toLowerCase();

        if (keyLower === lowerQuery) score += 10;
        if (keyLower.includes(lowerQuery)) score += 5;
        if (valueLower.includes(lowerQuery)) score += 3;
        if (categoryLower.includes(lowerQuery)) score += 2;
        for (const token of queryTokens) {
          if (keyLower.includes(token)) score += 2;
          if (valueLower.includes(token)) score += 1;
        }
        score *= entry.confidence;

        return { entry, score };
      });

      const results = scored
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(s => ({ ...s.entry, relevanceScore: Math.round(s.score * 100) / 100 }));

      res.json(results);
    } catch (e) { next(e); }
  });

  // DIGITAL TWIN
  app.get("/api/digital-twin", requireAuth, async (req, res, next) => {
    try { res.json(await storage.getDigitalTwinSnapshots(req.query.stationId ? Number(req.query.stationId) : undefined)); } catch (e) { next(e); }
  });
  app.post("/api/digital-twin", requireRole("admin", "supervisor"), async (req, res, next) => {
    try { res.status(201).json(await storage.createDigitalTwinSnapshot(digitalTwinSchema.parse(req.body))); } catch (e) { next(e); }
  });
  app.get("/api/digital-twin/timeline", requireAuth, async (req, res, next) => {
    try {
      const stationId = req.query.stationId ? parseInt(req.query.stationId as string) : undefined;
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;
      res.json(await storage.getDigitalTwinTimeline(stationId, from, to));
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

  // POLICY EVALUATION
  app.post("/api/system-policies/:id/evaluate", requireRole("admin"), async (req, res, next) => {
    try {
      const policy = await storage.getSystemPolicies();
      const target = policy.find(p => p.id === Number(req.params.id));
      if (!target) return res.status(404).json({ message: "Not found" });
      if (!target.active) return res.status(409).json({ message: "Policy is inactive" });

      const dryRun = req.query.dryRun === "true";
      const rule = target.rule as Record<string, unknown>;
      const category = target.category;

      let matchedCount = 0;
      let affectedEntities: Array<{ id: number; reason: string }> = [];

      if (category === "retention") {
        const maxAgeDays = Number(rule.maxAgeDays) || 90;
        const entityType = String(rule.entityType || "audit_log");
        if (entityType === "audit_log") {
          const cutoff = new Date(Date.now() - maxAgeDays * 86400000);
          const entries = await storage.getAuditLog(10000);
          const stale = entries.filter(e => new Date(e.createdAt) < cutoff);
          matchedCount = stale.length;
          affectedEntities = stale.slice(0, 100).map(e => ({ id: e.id, reason: `older than ${maxAgeDays} days` }));
          if (!dryRun && matchedCount > 0) {
            await storage.deleteAuditEntriesBefore(cutoff);
          }
        }
      } else if (category === "compliance") {
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
        policyId: target.id, policyName: target.name, category, enforcement: target.enforcement,
        dryRun, matchedCount, affectedEntities: affectedEntities.slice(0, 50),
        executedAt: dryRun ? null : new Date().toISOString(),
      });
    } catch (e) { next(e); }
  });

  // ACTIVITY FEED
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

  // WORKSPACE PROPOSALS
  app.get("/api/proposals", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const status = req.query.status as string | undefined;
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
      const needsApproval = proposal.scope === 'shared' || proposal.impact === 'high';
      if (needsApproval && proposal.status !== 'approved') {
        return res.status(400).json({ message: "Shared/high-impact proposals require admin approval before applying" });
      }
      if (!needsApproval && proposal.userId !== user.id) {
        return res.status(403).json({ message: "Cannot apply another user's personal proposal" });
      }

      const payload = proposal.payload as Record<string, unknown>;
      let previousValue: Record<string, unknown> | undefined;

      if (proposal.type === 'button' || proposal.type === 'workflow') {
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

  // FEEDBACK
  app.post("/api/feedback", requireAuth, validateRequest({ body: insertFeedbackSchema }), async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const fb = await storage.createFeedback({
        ...req.body,
        userId: user.id,
        role: user.role,
        userAgent: req.headers['user-agent'] ?? null,
      });
      metricsCollector.recordFeedback();
      res.status(201).json(fb);
    } catch (e) { next(e); }
  });
  app.get("/api/feedback", requireRole("admin"), async (_req, res, next) => {
    try { res.json(await storage.getFeedback()); } catch (e) { next(e); }
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

  // MACRO EXECUTION
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

      const invalidStep = steps.find(s => !ALLOWED_MACRO_STEP_TYPES.includes(s.type as typeof ALLOWED_MACRO_STEP_TYPES[number]));
      if (invalidStep) {
        return res.status(400).json({ message: `Unsupported step type: ${invalidStep.type}` });
      }

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

  // SCOPED ENDPOINTS
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

  app.get("/api/scoped/reservations", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const stationScope = await resolveStationScope(user);
      if (stationScope === 'none') return res.json([]);
      if (stationScope === null) {
        res.json(await storage.getReservations());
      } else {
        const all = await storage.getReservations();
        res.json(all.filter(r => r.stationId !== null && stationScope.includes(r.stationId)));
      }
    } catch (e) { next(e); }
  });

  app.get("/api/scoped/incidents", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const stationScope = await resolveStationScope(user);
      if (stationScope === 'none') return res.json([]);
      if (stationScope === null) {
        res.json(await storage.getIncidents());
      } else {
        const all = await storage.getIncidents();
        res.json(all.filter(i => i.stationId !== null && stationScope.includes(i.stationId)));
      }
    } catch (e) { next(e); }
  });

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

  app.get("/api/scoped/shifts", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const stationScope = await resolveStationScope(user);
      if (stationScope === 'none') return res.json([]);
      const weekStart = req.query.weekStart as string | undefined;
      if (SHIFT_MANAGERS.includes(user.role) && stationScope === null) {
        res.json(await storage.getShifts(weekStart));
      } else {
        const allShifts = await storage.getShifts(weekStart);
        if (stationScope !== null) {
          res.json(allShifts.filter(s => s.stationId === null || stationScope.includes(s.stationId as number)));
        } else {
          res.json(await storage.getPublishedShifts(weekStart));
        }
      }
    } catch (e) { next(e); }
  });
}
