import type { Express } from "express";
import { z } from "zod/v4";
import { storage } from "../storage.js";
import { requireAuth, requireRole } from "../auth.js";
import { wsManager } from "../websocket.js";
import { auditLog, AUDIT_ACTIONS } from "../middleware/audit.js";
import { INCIDENT_TRANSITIONS } from "./_helpers.js";
import { resolveStationScope } from "../middleware/stationScope.js";
import { insertIncidentSchema } from "../../shared/schema.js";
import { withTransaction } from "../db.js";

export function registerIncidentRoutes(app: Express) {
  const incidentPatchSchema = z.object({
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    severity: z.enum(["low", "medium", "high", "critical"]).optional(),
    status: z.enum(["open", "investigating", "mitigating", "resolved", "closed"]).optional(),
    category: z.string().optional(),
    assignedTo: z.number().nullable().optional(),
    vehicleId: z.number().nullable().optional(),
    stationId: z.number().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  }).strict();

  app.get("/api/incidents", requireAuth, async (req, res, next) => {
    try {
      const filters: { status?: string; severity?: string; stationId?: number; assignedTo?: number } = {};
      if (req.query.status) filters.status = String(req.query.status);
      if (req.query.severity) filters.severity = String(req.query.severity);
      if (req.query.stationId) filters.stationId = Number(req.query.stationId);
      if (req.query.assignedTo) filters.assignedTo = Number(req.query.assignedTo);
      res.json(await storage.getIncidents(filters));
    } catch (e) { next(e); }
  });

  app.get("/api/incidents/:id", requireAuth, async (req, res, next) => {
    try {
      const incident = await storage.getIncident(Number(req.params.id));
      if (!incident) return res.status(404).json({ message: "Not found" });
      res.json(incident);
    } catch (e) { next(e); }
  });

  app.post("/api/incidents", requireRole("admin", "supervisor", "coordinator"), auditLog({ action: AUDIT_ACTIONS.CREATE, entityType: 'incident' }), async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const data = insertIncidentSchema.parse({ ...req.body, reportedBy: user.id });

      const incident = await withTransaction(async () => {
        const incident = await storage.createIncident(data);

        if (incident.severity === 'high' || incident.severity === 'critical') {
          const room = await storage.createEntityRoom({
            entityType: 'incident', entityId: String(incident.id),
            title: `[INC-${incident.id}] ${incident.title}`,
            status: 'open',
            priority: incident.severity === 'critical' ? 'critical' : 'high',
            metadata: { incidentId: incident.id, category: incident.category },
          });
          await storage.updateIncident(incident.id, { roomId: room.id });
          incident.roomId = room.id;
          await storage.createRoomMessage({
            roomId: room.id, userId: user.id, role: 'system',
            content: `Incident created: ${incident.title}\nSeverity: ${incident.severity}\nCategory: ${incident.category}${incident.description ? `\n\n${incident.description}` : ''}`,
            type: 'system',
          });
        }

        await storage.createActivityEntry({
          userId: user.id, actorName: user.displayName, action: 'incident_created',
          entityType: 'incident', entityId: String(incident.id), entityLabel: incident.title, stationId: incident.stationId,
        });

        return incident;
      });

      wsManager.broadcast({ type: 'incident:created', data: incident, channel: 'notifications' });
      res.status(201).json(incident);
    } catch (e) { next(e); }
  });

  app.patch("/api/incidents/:id", requireRole("admin", "supervisor", "coordinator"), auditLog({ action: AUDIT_ACTIONS.UPDATE, entityType: 'incident' }), async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const id = Number(req.params.id);
      const existing = await storage.getIncident(id);
      if (!existing) return res.status(404).json({ message: "Not found" });

      const data = incidentPatchSchema.parse(req.body);

      if (data.status && data.status !== existing.status) {
        const allowed = INCIDENT_TRANSITIONS[existing.status] || [];
        if (!allowed.includes(data.status)) {
          return res.status(422).json({
            message: `Invalid status transition: ${existing.status} → ${data.status}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}`,
          });
        }
      }

      const updateData: Partial<import("../../shared/schema.js").Incident> = { ...data };

      if (data.status === 'resolved' && existing.status !== 'resolved') {
        updateData.resolvedAt = new Date();
      }
      if (data.status === 'closed' && existing.status !== 'closed') {
        updateData.closedAt = new Date();
        if (existing.roomId) {
          await storage.updateEntityRoom(existing.roomId, { status: 'resolved' });
        }
      }

      const updated = await storage.updateIncident(id, updateData);
      if (!updated) return res.status(404).json({ message: "Not found" });

      if (data.status && data.status !== existing.status && existing.roomId) {
        await storage.createRoomMessage({
          roomId: existing.roomId, userId: user.id, role: 'system',
          content: `Status changed: ${existing.status} → ${data.status}`, type: 'system',
        });
      }

      await storage.createActivityEntry({
        userId: user.id, actorName: user.displayName,
        action: data.status ? `incident_${data.status}` : 'incident_updated',
        entityType: 'incident', entityId: String(id), entityLabel: updated.title, stationId: updated.stationId,
      });

      wsManager.broadcast({ type: 'incident:updated', data: updated, channel: 'notifications' });
      res.json(updated);
    } catch (e) { next(e); }
  });

  // Escalate incident
  app.post("/api/incidents/:id/escalate", requireRole("admin", "supervisor", "coordinator"), async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const id = Number(req.params.id);
      const incident = await storage.getIncident(id);
      if (!incident) return res.status(404).json({ message: "Not found" });

      // INC-2: Prevent escalation of closed/resolved incidents
      if (incident.status === 'closed' || incident.status === 'resolved') {
        return res.status(409).json({ message: `Cannot escalate ${incident.status} incident` });
      }

      const severityLadder = ['low', 'medium', 'high', 'critical'];
      const currentIdx = severityLadder.indexOf(incident.severity);
      const newSeverity = currentIdx < severityLadder.length - 1 ? severityLadder[currentIdx + 1] : 'critical';

      const updateData: Partial<import("../../shared/schema.js").Incident> = {
        severity: newSeverity,
        status: incident.status === 'open' ? 'investigating' : incident.status,
      };

      if (!incident.roomId) {
        const room = await storage.createEntityRoom({
          entityType: 'incident', entityId: String(incident.id),
          title: `[INC-${incident.id}] ${incident.title}`,
          status: 'open',
          priority: newSeverity === 'critical' ? 'critical' : 'high',
          metadata: { incidentId: incident.id, category: incident.category },
        });
        updateData.roomId = room.id;
        await storage.createRoomMessage({
          roomId: room.id, userId: user.id, role: 'system',
          content: `Incident escalated to ${newSeverity}. War Room created.`, type: 'system',
        });
      } else {
        await storage.createRoomMessage({
          roomId: incident.roomId, userId: user.id, role: 'system',
          content: `Incident escalated: ${incident.severity} → ${newSeverity}`, type: 'system',
        });
      }

      const updated = await storage.updateIncident(id, updateData);
      await storage.createAuditEntry({
        userId: user.id, action: 'incident_escalated', entityType: 'incident', entityId: String(id),
        details: { from: incident.severity, to: newSeverity }, ipAddress: req.ip || null,
      });
      wsManager.broadcast({ type: 'incident:escalated', data: updated, channel: 'notifications' });
      res.json(updated);
    } catch (e) { next(e); }
  });

  // Incident summaries
  app.get("/api/incidents/:id/summaries", requireAuth, async (req, res, next) => {
    try {
      const incident = await storage.getIncident(Number(req.params.id));
      if (!incident) return res.status(404).json({ message: "Incident not found" });
      const summaries = await storage.getIncidentSummaries(incident.id);
      res.json(summaries);
    } catch (e) { next(e); }
  });

  app.post("/api/incidents/:id/summary", requireAuth, auditLog({ action: AUDIT_ACTIONS.CREATE, entityType: 'incident_summary' }), async (req, res, next) => {
    try {
      const incidentId = Number(req.params.id);
      const incident = await storage.getIncident(incidentId);
      if (!incident) return res.status(404).json({ message: "Incident not found" });

      const existingSummaries = await storage.getIncidentSummaries(incidentId);
      if (existingSummaries.length > 0) {
        return res.status(409).json({
          message: "Summary already exists for this incident",
          existingSummaryId: existingSummaries[0].id,
          hint: "Use GET /api/incidents/:id/summaries to retrieve existing summaries",
        });
      }

      const dataSources: string[] = ['incident'];

      let roomMessages: Array<{ role: string; content: string; createdAt: Date }> = [];
      if (incident.roomId) {
        const msgs = await storage.getRoomMessages(incident.roomId);
        roomMessages = msgs.map(m => ({ role: m.role, content: m.content, createdAt: m.createdAt }));
        if (roomMessages.length > 0) dataSources.push('war_room_messages');
      }

      let repairOrderData: Array<{ title: string; status: string; priority: string }> = [];
      if (incident.vehicleId) {
        const ros = await storage.getRepairOrders({ vehicleId: incident.vehicleId });
        repairOrderData = ros.map(r => ({ title: r.title, status: r.status, priority: r.priority }));
        if (repairOrderData.length > 0) dataSources.push('repair_orders');
      }

      let downtimeData: Array<{ reason: string; startedAt: Date; endedAt: Date | null }> = [];
      if (incident.vehicleId) {
        const dt = await storage.getDowntimeEvents({ vehicleId: incident.vehicleId });
        downtimeData = dt.map(d => ({ reason: d.reason, startedAt: d.startedAt, endedAt: d.endedAt }));
        if (downtimeData.length > 0) dataSources.push('downtime_events');
      }

      const parts: string[] = [];
      parts.push(`## Incident: ${incident.title}`);
      parts.push(`**Severity:** ${incident.severity} | **Category:** ${incident.category} | **Status:** ${incident.status}`);
      if (incident.description) parts.push(`**Description:** ${incident.description}`);

      parts.push(`\n### Timeline`);
      parts.push(`- **Created:** ${new Date(incident.createdAt).toISOString()}`);
      if (incident.resolvedAt) parts.push(`- **Resolved:** ${new Date(incident.resolvedAt).toISOString()}`);
      if (incident.closedAt) parts.push(`- **Closed:** ${new Date(incident.closedAt).toISOString()}`);
      if (incident.resolvedAt) {
        const resolutionMinutes = Math.round((new Date(incident.resolvedAt).getTime() - new Date(incident.createdAt).getTime()) / 60000);
        parts.push(`- **Resolution time:** ${resolutionMinutes} minutes`);
      }

      if (roomMessages.length > 0) {
        parts.push(`\n### War Room Discussion (${roomMessages.length} messages)`);
        const userMessages = roomMessages.filter(m => m.role !== 'system').slice(0, 10);
        if (userMessages.length > 0) {
          parts.push(`Key messages:`);
          for (const msg of userMessages) {
            parts.push(`- [${msg.role}] ${msg.content.slice(0, 200)}${msg.content.length > 200 ? '...' : ''}`);
          }
        }
        if (roomMessages.length > 10) parts.push(`*(${roomMessages.length - 10} additional messages omitted)*`);
      }

      if (repairOrderData.length > 0) {
        parts.push(`\n### Related Repair Orders`);
        for (const ro of repairOrderData) parts.push(`- **${ro.title}** — Status: ${ro.status}, Priority: ${ro.priority}`);
      }

      if (downtimeData.length > 0) {
        parts.push(`\n### Downtime Impact`);
        let totalMinutes = 0;
        for (const dt of downtimeData) {
          const end = dt.endedAt ? new Date(dt.endedAt) : new Date();
          const minutes = Math.round((end.getTime() - new Date(dt.startedAt).getTime()) / 60000);
          totalMinutes += minutes;
          parts.push(`- ${dt.reason}: ${minutes} minutes${dt.endedAt ? '' : ' (ongoing)'}`);
        }
        parts.push(`- **Total downtime:** ${totalMinutes} minutes`);
      }

      if (dataSources.length === 1 && !incident.description && !incident.resolvedAt) {
        parts.push(`\n*Note: Limited data available for this incident. Summary is based on incident metadata only.*`);
      }

      const kpiImpact: Record<string, unknown> = {};
      if (downtimeData.length > 0) {
        kpiImpact.downtimeMinutes = downtimeData.reduce((sum, dt) => {
          const end = dt.endedAt ? new Date(dt.endedAt) : new Date();
          return sum + Math.round((end.getTime() - new Date(dt.startedAt).getTime()) / 60000);
        }, 0);
      }
      if (incident.resolvedAt) {
        kpiImpact.resolutionMinutes = Math.round((new Date(incident.resolvedAt).getTime() - new Date(incident.createdAt).getTime()) / 60000);
      }

      const summary = await storage.createIncidentSummary({
        incidentId, summary: parts.join('\n'), dataSourcesUsed: dataSources,
        kpiImpact: Object.keys(kpiImpact).length > 0 ? kpiImpact : null, generatedBy: 'system',
      });

      const memoryKey = `incident_${incidentId}_summary`;
      const existingMemory = (await storage.getWorkspaceMemory('incident_summary')).find(m => m.key === memoryKey);
      if (existingMemory) {
        await storage.updateWorkspaceMemory(existingMemory.id, { value: parts.slice(0, 5).join('\n').slice(0, 1000), confidence: 1.0 });
      } else {
        await storage.createWorkspaceMemory({
          category: 'incident_summary', key: memoryKey,
          value: parts.slice(0, 5).join('\n').slice(0, 1000), source: 'system', confidence: 1.0,
        });
      }

      res.status(201).json(summary);
    } catch (e) { next(e); }
  });

  // SCOPED incidents
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
}
