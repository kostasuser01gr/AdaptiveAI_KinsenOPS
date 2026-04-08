import type { Express } from "express";
import { storage } from "../storage.js";
import { requireRole, requireAuth } from "../auth.js";
import { requireEntitlement } from "../entitlements/engine.js";
import { requireCapability } from "../capabilities/engine.js";
import { insertAuditLogSchema } from "../../shared/schema.js";
import { recordUsage } from "../metering/service.js";

export function registerTrustRoutes(app: Express) {
  // TRUST PERMISSIONS
  app.get("/api/trust/permissions", requireRole("admin", "supervisor"), async (_req, res, next) => {
    try {
      const allUsers = await storage.getUsers();
      const allStations = await storage.getStations();

      const roleCounts: Record<string, number> = {};
      const stationAssignments: Record<string, string[]> = {};

      for (const user of allUsers) {
        roleCounts[user.role] = (roleCounts[user.role] || 0) + 1;
        if (user.station) {
          if (!stationAssignments[user.station]) stationAssignments[user.station] = [];
          stationAssignments[user.station].push(user.displayName);
        }
      }

      const permissionMatrix = {
        admin: {
          description: 'Full system access',
          permissions: ['manage_users', 'manage_stations', 'manage_policies', 'delete_entities', 'export_data', 'manage_connectors', 'manage_automations', 'view_audit_log', 'manage_kpis', 'all_stations'],
        },
        supervisor: {
          description: 'Operations oversight',
          permissions: ['view_users', 'manage_shifts', 'manage_incidents', 'manage_automations', 'view_audit_log', 'generate_briefings', 'manage_connectors', 'manage_kpis', 'all_stations'],
        },
        coordinator: {
          description: 'Day-to-day coordination',
          permissions: ['manage_shifts', 'manage_incidents', 'view_analytics', 'manage_automations', 'assigned_station'],
        },
        agent: {
          description: 'Operational staff',
          permissions: ['view_vehicles', 'manage_wash_queue', 'submit_evidence', 'view_shifts', 'view_incidents', 'assigned_station'],
        },
        washer: {
          description: 'Wash station operator',
          permissions: ['view_wash_queue', 'update_wash_status', 'submit_evidence', 'assigned_station'],
        },
      };

      res.json({
        roles: permissionMatrix,
        roleCounts,
        stationAssignments,
        totalUsers: allUsers.length,
        totalStations: allStations.length,
      });
    } catch (e) { next(e); }
  });

  // TRUST RETENTION
  app.get("/api/trust/retention", requireRole("admin", "supervisor"), async (_req, res, next) => {
    try {
      const policies = await storage.getSystemPolicies('retention');
      const allFeedback = await storage.getFeedback();

      const retentionStatus = [
        { entityType: 'audit_log', retentionDays: 90, enforceable: true },
        { entityType: 'chat_messages', retentionDays: 365, enforceable: false },
        { entityType: 'feedback', currentCount: allFeedback.length, retentionDays: 180, enforceable: false },
      ];

      res.json({
        policies,
        retentionStatus,
        activePolicies: policies.filter(p => p.active).length,
        totalPolicies: policies.length,
      });
    } catch (e) { next(e); }
  });

  // TRUST EXPORT PREVIEW
  app.get("/api/trust/export-preview", requireAuth, requireCapability("trust_export"), requireEntitlement("trust_export_preview"), async (req, res, next) => {
    try {
      const vehicleCount = (await storage.getVehicles()).length;
      const incidentCount = (await storage.getIncidents()).length;
      const reservationCount = (await storage.getReservations()).length;

      res.json({
        exportable: [
          { entity: 'vehicles', count: vehicleCount, formats: ['csv', 'json'] },
          { entity: 'incidents', count: incidentCount, formats: ['csv', 'json'] },
          { entity: 'reservations', count: reservationCount, formats: ['csv', 'json'] },
          { entity: 'audit_log', formats: ['csv'] },
        ],
        requiresApproval: true,
        note: 'Exports of data containing PII require admin approval',
      });
      recordUsage({ action: "trust_export_previewed", userId: (req.user as Express.User)?.id });
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

  // AUDIT LOG CSV EXPORT
  app.get("/api/audit-log/export", requireAuth, requireCapability("trust_export"), async (req, res, next) => {
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
}
