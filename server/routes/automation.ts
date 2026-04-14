import type { Express } from "express";
import { z } from "zod/v4";
import { storage } from "../storage.js";
import { requireAuth, requireRole } from "../auth.js";
import { aiChatLimiter } from "../middleware/rate-limiter.js";
import { recordUsage, checkUsageCeiling } from "../metering/service.js";
import { requireEntitlement } from "../entitlements/engine.js";
import { requireCapability } from "../capabilities/engine.js";
import { automationRulePatchSchema, automationConditionSchema, automationActionSchema, executeAutomationRule } from "./_helpers.js";
import { insertAutomationRuleSchema } from "../../shared/schema.js";

export function registerAutomationRoutes(app: Express) {
  // AUTOMATION RULES CRUD
  app.get("/api/automation-rules", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      res.json(await storage.getAutomationRules(userId));
    } catch (e) { next(e); }
  });

  app.post("/api/automation-rules", requireRole("admin", "supervisor"), async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      // Validate JSONB fields with strict schemas before persisting
      if (req.body.conditions != null) automationConditionSchema.parse(req.body.conditions);
      if (req.body.actions != null) z.array(automationActionSchema).max(20).parse(req.body.actions);
      res.status(201).json(await storage.createAutomationRule(insertAutomationRuleSchema.parse({ ...req.body, createdBy: userId })));
    } catch (e) { next(e); }
  });

  app.patch("/api/automation-rules/:id", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const rule = await storage.getAutomationRule(Number(req.params.id));
      if (!rule) return res.status(404).json({ message: "Not found" });
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

  // Dry-run/test
  app.post("/api/automation-rules/:id/test", requireAuth, requireCapability("automation_execute"), requireEntitlement("automation_execution"), async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      res.json(await storage.testAutomationRule(id));
    } catch (e) { next(e); }
  });

  // Manual execute
  app.post("/api/automation-rules/:id/execute", requireAuth, requireCapability("automation_execute"), requireEntitlement("automation_execution"), async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const ruleId = Number(req.params.id);
      const rule = await storage.getAutomationRule(ruleId);
      if (!rule) return res.status(404).json({ message: "Rule not found" });
      if (!rule.active) return res.status(409).json({ message: "Rule is inactive" });

      // Ceiling check — fail fast if automation quota exhausted
      const ceiling = await checkUsageCeiling("automation_executed");
      if (!ceiling.allowed) {
        return res.status(429).json({
          message: "Usage ceiling reached for automation executions",
          code: "CEILING_REACHED",
          current: ceiling.current,
          ceiling: ceiling.ceiling,
        });
      }

      const result = await executeAutomationRule(rule, { manualTriggerBy: user.id });
      recordUsage({ action: "automation_executed", userId: user.id, entityType: "automation_rule", entityId: String(ruleId) });
      res.json(result);
    } catch (e) { next(e); }
  });

  // Execution history
  app.get("/api/automation-executions", requireAuth, async (req, res, next) => {
    try {
      const ruleId = req.query.ruleId ? Number(req.query.ruleId) : undefined;
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      res.json(await storage.getAutomationExecutions(ruleId, limit));
    } catch (e) { next(e); }
  });

  // AI NL → rule draft
  const nlDraftSchema = z.object({
    description: z.string().min(5).max(2000),
  }).strict();

  app.post("/api/automations/draft", requireAuth, requireCapability("ai_draft"), requireEntitlement("ai_automation_drafting"), aiChatLimiter, async (req, res, next) => {
    try {
      const { description } = nlDraftSchema.parse(req.body);

      // Ceiling check — fail fast if AI draft quota exhausted
      const ceiling = await checkUsageCeiling("ai_draft_created");
      if (!ceiling.allowed) {
        return res.status(429).json({
          message: "Usage ceiling reached for AI drafts",
          code: "CEILING_REACHED",
          current: ceiling.current,
          ceiling: ceiling.ceiling,
        });
      }

      const descLower = description.toLowerCase();

      let trigger = 'vehicle_status_change';
      const actions: Array<Record<string, unknown>> = [];
      const conditions: Record<string, unknown> = {};
      let parsedName = 'Custom Rule';
      let confidence = 0.5;
      const warnings: string[] = [];

      // Trigger detection
      if (descLower.includes('sla') || descLower.includes('overdue') || descLower.includes('late')) {
        trigger = 'sla_breach'; parsedName = 'SLA Breach Response'; confidence += 0.2;
      } else if (descLower.includes('wash') && (descLower.includes('complet') || descLower.includes('finish') || descLower.includes('done'))) {
        trigger = 'wash_completed'; parsedName = 'Wash Completion Handler'; confidence += 0.2;
      } else if (descLower.includes('evidence') || descLower.includes('photo') || descLower.includes('damage')) {
        trigger = 'evidence_uploaded'; parsedName = 'Evidence Upload Handler'; confidence += 0.2;
      } else if (descLower.includes('incident') && (descLower.includes('creat') || descLower.includes('new') || descLower.includes('open'))) {
        trigger = 'incident_created'; parsedName = 'Incident Response Rule'; confidence += 0.2;
      } else if (descLower.includes('reservation') || descLower.includes('booking')) {
        trigger = 'reservation_created'; parsedName = 'Reservation Handler'; confidence += 0.2;
      } else if (descLower.includes('repair') || descLower.includes('maintenance')) {
        trigger = 'repair_order_created'; parsedName = 'Repair Order Rule'; confidence += 0.2;
      } else if (descLower.includes('anomal') || descLower.includes('detect') || descLower.includes('spike')) {
        trigger = 'anomaly_detected'; parsedName = 'Anomaly Response Rule'; confidence += 0.2;
      } else if (descLower.includes('shift') && (descLower.includes('publish') || descLower.includes('schedul'))) {
        trigger = 'shift_published'; parsedName = 'Shift Publication Rule'; confidence += 0.2;
      } else if (descLower.includes('queue') && (descLower.includes('threshold') || descLower.includes('backlog') || descLower.includes('flood'))) {
        trigger = 'queue_threshold'; parsedName = 'Queue Threshold Rule'; confidence += 0.15;
      } else {
        warnings.push('Could not detect a specific trigger from description. Defaulting to vehicle_status_change.');
      }

      // Action detection
      if (descLower.includes('notify') || descLower.includes('alert') || descLower.includes('send') || descLower.includes('message') || descLower.includes('email')) {
        const severity = descLower.includes('critical') || descLower.includes('urgent') ? 'critical' : descLower.includes('warn') ? 'warning' : 'info';
        const recipientRole = descLower.includes('admin') ? 'admin' : descLower.includes('supervisor') ? 'supervisor' : null;
        actions.push({
          type: 'send_notification', severity,
          title: `[Auto] ${parsedName}`,
          body: `Automatically triggered: ${description.slice(0, 200)}`,
          audience: recipientRole ? 'role' : 'broadcast',
          ...(recipientRole ? { recipientRole } : {}),
        });
        confidence += 0.15;
      }
      if (descLower.includes('war room') || descLower.includes('warroom') || descLower.includes('escalat')) {
        actions.push({ type: 'create_room', title: `[Auto] ${parsedName}`, priority: 'high' });
        confidence += 0.1;
      }
      if (descLower.includes('incident') && descLower.includes('creat') && trigger !== 'incident_created') {
        actions.push({ type: 'create_incident', title: parsedName, severity: 'medium', category: 'general' });
        confidence += 0.1;
      }
      if (descLower.includes('log') || descLower.includes('record') || descLower.includes('track')) {
        actions.push({ type: 'log_event', eventAction: parsedName });
        confidence += 0.05;
      }
      if (actions.length === 0) {
        actions.push({ type: 'send_notification', severity: 'info', title: `[Auto] ${parsedName}`, body: description.slice(0, 200), audience: 'broadcast' });
        warnings.push('No specific action detected. Defaulting to broadcast notification.');
      }

      if (descLower.includes('critical')) conditions.severity = 'critical';
      if (descLower.includes('high priority') || descLower.includes('high-priority')) conditions.priority = 'high';

      confidence = Math.min(0.95, confidence);

      const proposalPayload = {
        name: parsedName,
        description: description.slice(0, 500),
        trigger, conditions: Object.keys(conditions).length > 0 ? conditions : null,
        actions, scope: 'shared', active: false,
      };

      const userId = (req.user as Express.User).id;
      const proposal = await storage.createProposal({
        userId, type: 'workflow', label: parsedName,
        description: `AI-drafted automation rule: ${description.slice(0, 200)}`,
        impact: confidence > 0.7 ? 'medium' : 'high',
        scope: 'shared', status: 'proposed', payload: proposalPayload,
      });

      await storage.createAuditEntry({
        userId, action: 'automation_draft_created', entityType: 'proposal',
        entityId: String(proposal.id),
        details: { trigger, actionCount: actions.length, confidence },
        ipAddress: req.ip || null,
      });

      recordUsage({ action: "ai_draft_created", userId, entityType: "proposal", entityId: String(proposal.id) });
      res.status(201).json({
        proposalId: proposal.id, draft: proposalPayload,
        confidence: Math.round(confidence * 100) / 100, warnings,
        message: confidence >= 0.7
          ? 'Rule drafted successfully. Submit for review to activate.'
          : 'Rule drafted with low confidence. Please review carefully before approving.',
      });
    } catch (e) { next(e); }
  });
}
