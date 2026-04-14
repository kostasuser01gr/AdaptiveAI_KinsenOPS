import type { Express } from "express";
import { z } from "zod/v4";
import { storage } from "../storage.js";
import { requireAuth, requireRole } from "../auth.js";
import { auditLog, AUDIT_ACTIONS } from "../middleware/audit.js";
import { recordUsage, checkUsageCeiling } from "../metering/service.js";
import { searchLimiter } from "../middleware/rate-limiter.js";
import { requireEntitlement } from "../entitlements/engine.js";
import { requireCapability } from "../capabilities/engine.js";
import {
  insertKpiDefinitionSchema,
} from "../../shared/schema.js";

export function registerAnalyticsRoutes(app: Express) {
  // DASHBOARD STATS
  app.get("/api/dashboard-stats", requireAuth, async (_req, res, next) => {
    try { res.json(await storage.getDashboardStats()); } catch (e) { next(e); }
  });

  // ANALYTICS SUMMARY
  app.get("/api/analytics/summary", requireAuth, async (_req, res, next) => {
    try { res.json(await storage.getAnalyticsSummary()); } catch (e) { next(e); }
  });

  // ANALYTICS TRENDS
  app.get("/api/analytics/trends", requireAuth, async (req, res, next) => {
    try {
      const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 90);
      res.json(await storage.getAnalyticsTrends(days));
    } catch (e) { next(e); }
  });

  // ANALYTICS CSV EXPORT
  app.get("/api/analytics/export", requireRole("admin", "supervisor"), async (req, res, next) => {
    try {
      const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 90);
      const trends = await storage.getAnalyticsTrends(days);
      const summary = await storage.getAnalyticsSummary();
      // RT-12: CSV-safe escaping to prevent formula injection
      const csvSafe = (val: unknown): string => {
        const s = String(val ?? '');
        if (/^[=+\-@\t\r]/.test(s) || s.includes('"') || s.includes(',') || s.includes('\n')) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      };
      const csvRows = ['date,washes,evidence,notifications'];
      for (const t of trends) csvRows.push([t.date, t.washes, t.evidence, t.notifications].map(csvSafe).join(','));
      csvRows.push('');
      csvRows.push('metric,value');
      for (const [k, v] of Object.entries(summary)) {
        if (typeof v === 'object' && v !== null) {
          for (const [sk, sv] of Object.entries(v as Record<string, unknown>)) csvRows.push(`${csvSafe(`${k}.${sk}`)},${csvSafe(sv)}`);
        } else {
          csvRows.push(`${csvSafe(k)},${csvSafe(v)}`);
        }
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=analytics-${new Date().toISOString().slice(0,10)}.csv`);
      res.send(csvRows.join('\n'));
    } catch (e) { next(e); }
  });

  // KPI DEFINITIONS
  app.get("/api/kpi/definitions", requireAuth, async (req, res, next) => {
    try {
      const category = req.query.category ? String(req.query.category) : undefined;
      res.json(await storage.getKpiDefinitions(category));
    } catch (e) { next(e); }
  });

  app.post("/api/kpi/definitions", requireRole("admin", "supervisor"), auditLog({ action: AUDIT_ACTIONS.CREATE, entityType: 'kpi_definition' }), async (req, res, next) => {
    try { res.status(201).json(await storage.createKpiDefinition(insertKpiDefinitionSchema.parse(req.body))); } catch (e) { next(e); }
  });

  const kpiDefinitionPatchSchema = z.object({
    name: z.string().optional(),
    description: z.string().nullable().optional(),
    category: z.string().optional(),
    unit: z.string().optional(),
    targetValue: z.number().nullable().optional(),
    warningThreshold: z.number().nullable().optional(),
    criticalThreshold: z.number().nullable().optional(),
    active: z.boolean().optional(),
  }).strict();

  app.patch("/api/kpi/definitions/:id", requireRole("admin", "supervisor"), async (req, res, next) => {
    try {
      const kpi = await storage.updateKpiDefinition(Number(req.params.id), kpiDefinitionPatchSchema.parse(req.body));
      if (!kpi) return res.status(404).json({ message: "Not found" });
      res.json(kpi);
    } catch (e) { next(e); }
  });

  // KPI SNAPSHOTS
  app.get("/api/kpi/snapshots/:slug", requireAuth, requireEntitlement("kpi_snapshots"), async (req, res, next) => {
    try {
      const slug = String(req.params.slug);
      const from = req.query.from ? String(req.query.from) : undefined;
      const to = req.query.to ? String(req.query.to) : undefined;
      const stationId = req.query.stationId ? Number(req.query.stationId) : undefined;
      res.json(await storage.getKpiSnapshots(slug, from, to, stationId));
    } catch (e) { next(e); }
  });

  // KPI COMPUTE
  app.get("/api/kpi/compute", requireAuth, requireEntitlement("kpi_snapshots"), async (req, res, next) => {
    try {
      const from = req.query.from ? String(req.query.from) : new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const to = req.query.to ? String(req.query.to) : new Date().toISOString().slice(0, 10);

      const allVehicles = await storage.getVehicles();
      const allWash = await storage.getWashQueue();
      const allIncidents = await storage.getIncidents();
      const allDowntime = await storage.getDowntimeEvents();
      const allReservations = await storage.getReservations();

      const totalVehicles = allVehicles.length;
      const maintenanceVehicles = allVehicles.filter(v => v.status === 'maintenance').length;
      const activeVehicles = allVehicles.filter(v => v.status === 'rented' || v.status === 'washing').length;
      const fleetUtilization = totalVehicles > 0 ? (activeVehicles / totalVehicles) * 100 : 0;
      const fleetAvailability = totalVehicles > 0 ? ((totalVehicles - maintenanceVehicles) / totalVehicles) * 100 : 0;

      const completedWashes = allWash.filter(w => w.status === 'completed');
      const withinSla = completedWashes.filter(w => {
        if (!w.slaDeadline || !w.completedAt) return true;
        return new Date(w.completedAt) <= new Date(w.slaDeadline);
      });
      const washSlaAttainment = completedWashes.length > 0 ? (withinSla.length / completedWashes.length) * 100 : 100;

      const turnarounds = completedWashes
        .filter(w => w.completedAt && w.createdAt)
        .map(w => (new Date(w.completedAt!).getTime() - new Date(w.createdAt).getTime()) / 60000);
      const avgTurnaround = turnarounds.length > 0 ? turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length : 0;

      const resolvedIncidents = allIncidents.filter(i => i.resolvedAt);
      const resolutionTimes = resolvedIncidents.map(i =>
        (new Date(i.resolvedAt!).getTime() - new Date(i.createdAt).getTime()) / 60000
      );
      const avgIncidentResolution = resolutionTimes.length > 0 ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length : 0;

      const activeReservations = allReservations.filter(r => r.status === 'confirmed' || r.status === 'checked_out').length;
      const openDowntime = allDowntime.filter(d => !d.endedAt).length;

      res.json({
        dateRange: { from, to },
        kpis: {
          fleet_utilization: { value: Math.round(fleetUtilization * 10) / 10, unit: 'percent' },
          fleet_availability: { value: Math.round(fleetAvailability * 10) / 10, unit: 'percent' },
          wash_sla_attainment: { value: Math.round(washSlaAttainment * 10) / 10, unit: 'percent' },
          avg_wash_turnaround: { value: Math.round(avgTurnaround), unit: 'minutes' },
          avg_incident_resolution: { value: Math.round(avgIncidentResolution), unit: 'minutes' },
          active_reservations: { value: activeReservations, unit: 'count' },
          open_downtime: { value: openDowntime, unit: 'count' },
          total_vehicles: { value: totalVehicles, unit: 'count' },
          completed_washes: { value: completedWashes.length, unit: 'count' },
          open_incidents: { value: allIncidents.filter(i => i.status !== 'closed' && i.status !== 'resolved').length, unit: 'count' },
        },
      });
    } catch (e) { next(e); }
  });

  // KPI SNAPSHOT BATCH
  app.post("/api/kpi/snapshot", requireRole("admin", "supervisor"), requireEntitlement("kpi_snapshots"), async (req, res, next) => {
    try {
      // Ceiling check — fail fast if KPI snapshot quota exhausted
      const ceiling = await checkUsageCeiling("kpi_snapshot_created");
      if (!ceiling.allowed) {
        return res.status(429).json({
          message: "Usage ceiling reached for KPI snapshots",
          code: "CEILING_REACHED",
          current: ceiling.current,
          ceiling: ceiling.ceiling,
        });
      }

      const today = new Date().toISOString().slice(0, 10);
      const allVehicles = await storage.getVehicles();
      const allWash = await storage.getWashQueue();
      const totalVehicles = allVehicles.length;
      const maintenanceVehicles = allVehicles.filter(v => v.status === 'maintenance').length;
      const completedWashes = allWash.filter(w => w.status === 'completed');
      const withinSla = completedWashes.filter(w => {
        if (!w.slaDeadline || !w.completedAt) return true;
        return new Date(w.completedAt) <= new Date(w.slaDeadline);
      });
      const activeVehicles = allVehicles.filter(v => v.status === 'rented' || v.status === 'washing').length;

      const snaps = [
        { kpiSlug: 'fleet_utilization', value: totalVehicles > 0 ? (activeVehicles / totalVehicles) * 100 : 0, date: today },
        { kpiSlug: 'fleet_availability', value: totalVehicles > 0 ? ((totalVehicles - maintenanceVehicles) / totalVehicles) * 100 : 0, date: today },
        { kpiSlug: 'wash_sla_attainment', value: completedWashes.length > 0 ? (withinSla.length / completedWashes.length) * 100 : 100, date: today },
      ];

      const created = [];
      for (const s of snaps) created.push(await storage.createKpiSnapshot(s));
      recordUsage({ action: "kpi_snapshot_created", userId: (req.user as Express.User)?.id });
      res.status(201).json(created);
    } catch (e) { next(e); }
  });

  // ANOMALIES
  app.get("/api/anomalies", requireAuth, requireEntitlement("anomaly_detection"), async (req, res, next) => {
    try {
      const filters: { type?: string; status?: string; stationId?: number } = {};
      if (req.query.type) filters.type = String(req.query.type);
      if (req.query.status) filters.status = String(req.query.status);
      if (req.query.stationId) filters.stationId = Number(req.query.stationId);
      res.json(await storage.getAnomalies(filters));
    } catch (e) { next(e); }
  });

  app.get("/api/anomalies/:id", requireAuth, requireEntitlement("anomaly_detection"), async (req, res, next) => {
    try {
      const a = await storage.getAnomaly(Number(req.params.id));
      if (!a) return res.status(404).json({ message: "Not found" });
      res.json(a);
    } catch (e) { next(e); }
  });

  app.patch("/api/anomalies/:id", requireAuth, requireEntitlement("anomaly_detection"), async (req, res, next) => {
    try {
      const existing = await storage.getAnomaly(Number(req.params.id));
      if (!existing) return res.status(404).json({ message: "Not found" });
      const statusSchema = z.object({
        status: z.enum(["open", "acknowledged", "resolved", "dismissed"]),
      }).strict();
      const { status } = statusSchema.parse(req.body);
      const userId = (req.user as Express.User).id;
      const updated = await storage.updateAnomaly(Number(req.params.id), {
        status,
        ...(status === 'acknowledged' ? { acknowledgedBy: userId } : {}),
      });
      res.json(updated);
    } catch (e) { next(e); }
  });

  // ANOMALY DETECTION BATCH
  app.post("/api/anomalies/detect", requireRole("admin", "supervisor"), requireEntitlement("anomaly_detection"), async (req, res, next) => {
    try {
      // Ceiling check — fail fast if anomaly detection quota exhausted
      const ceiling = await checkUsageCeiling("anomaly_detection_run");
      if (!ceiling.allowed) {
        return res.status(429).json({
          message: "Usage ceiling reached for anomaly detection",
          code: "CEILING_REACHED",
          current: ceiling.current,
          ceiling: ceiling.ceiling,
        });
      }

      const detected: Array<{ type: string; title: string }> = [];
      const existingOpen = await storage.getAnomalies({ status: 'open' });

      // 1. Wash stagnation
      const washItems = await storage.getWashQueue();
      const stagnant = washItems.filter(w =>
        w.status === 'pending' &&
        (Date.now() - new Date(w.createdAt).getTime()) > 4 * 3600000
      );
      if (stagnant.length >= 3) {
        const alreadyExists = existingOpen.some(a => a.type === 'wash_stagnation');
        if (!alreadyExists) {
          const a = await storage.createAnomaly({
            type: 'wash_stagnation',
            severity: stagnant.length >= 5 ? 'critical' : 'warning',
            title: `${stagnant.length} wash items stagnant for 4+ hours`,
            description: `Vehicles: ${stagnant.slice(0, 5).map(w => w.vehiclePlate).join(', ')}`,
            entityType: 'wash_queue',
            status: 'open',
          });
          detected.push({ type: a.type, title: a.title });
          await storage.createNotification({
            type: 'anomaly',
            severity: stagnant.length >= 5 ? 'critical' : 'warning',
            title: a.title,
            body: a.description,
            audience: 'role',
            recipientRole: 'supervisor',
            sourceEntityType: 'anomaly',
            sourceEntityId: String(a.id),
          });
        }
      }

      // 2. Repeated damage
      const allVehicles = await storage.getVehicles();
      const sevenDaysAgo = Date.now() - 7 * 86400000;
      for (const v of allVehicles.slice(0, 200)) {
        const alreadyExists = existingOpen.some(a => a.type === 'repeated_damage' && a.entityId === String(v.id));
        if (alreadyExists) continue;
        const evidence = await storage.getVehicleEvidence(v.id);
        const recent = evidence.filter(e => new Date(e.createdAt).getTime() > sevenDaysAgo);
        if (recent.length >= 3) {
          const a = await storage.createAnomaly({
            type: 'repeated_damage',
            severity: recent.length >= 5 ? 'critical' : 'warning',
            title: `Vehicle ${v.plate} has ${recent.length} evidence items in 7 days`,
            description: `${recent.length} damage/evidence items logged recently for vehicle ${v.plate} (${v.model})`,
            entityType: 'vehicle',
            entityId: String(v.id),
            stationId: v.stationId,
            status: 'open',
          });
          detected.push({ type: a.type, title: a.title });
        }
      }

      // 3. Notification spike
      const allNotifs = await storage.getNotifications(0, 'admin');
      const oneHourAgo = Date.now() - 3600000;
      const recentNotifs = allNotifs.filter(n => new Date(n.createdAt).getTime() > oneHourAgo);
      if (recentNotifs.length > 20) {
        const alreadyExists = existingOpen.some(a => a.type === 'notification_spike');
        if (!alreadyExists) {
          const a = await storage.createAnomaly({
            type: 'notification_spike',
            severity: recentNotifs.length > 50 ? 'critical' : 'warning',
            title: `Notification spike: ${recentNotifs.length} in last hour`,
            description: `Unusually high notification volume detected. Top types: ${[...new Set(recentNotifs.map(n => n.type))].slice(0, 3).join(', ')}`,
            entityType: 'notification',
            status: 'open',
          });
          detected.push({ type: a.type, title: a.title });
        }
      }

      recordUsage({ action: "anomaly_detection_run", userId: (req.user as Express.User)?.id });
      res.json({ detected: detected.length, anomalies: detected });
    } catch (e) { next(e); }
  });

  // EXECUTIVE BRIEFINGS
  app.get("/api/executive-briefings", requireAuth, requireEntitlement("executive_briefings"), async (req, res, next) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      res.json(await storage.getExecutiveBriefings(limit));
    } catch (e) { next(e); }
  });

  app.get("/api/executive-briefings/:id", requireAuth, requireEntitlement("executive_briefings"), async (req, res, next) => {
    try {
      const b = await storage.getExecutiveBriefing(Number(req.params.id));
      if (!b) return res.status(404).json({ message: "Not found" });
      res.json(b);
    } catch (e) { next(e); }
  });

  app.post("/api/executive-briefings/generate", requireAuth, requireCapability("briefing_generate"), requireEntitlement("executive_briefings"), async (req, res, next) => {
    try {
      // Ceiling check — fail fast if briefing quota exhausted
      const ceiling = await checkUsageCeiling("briefing_generated");
      if (!ceiling.allowed) {
        return res.status(429).json({
          message: "Usage ceiling reached for executive briefings",
          code: "CEILING_REACHED",
          current: ceiling.current,
          ceiling: ceiling.ceiling,
        });
      }

      const today = new Date().toISOString().slice(0, 10);

      const allVehicles = await storage.getVehicles();
      const allWash = await storage.getWashQueue();
      const allIncidents = await storage.getIncidents();
      const allAnomalies = await storage.getAnomalies({ status: 'open' });
      const allReservations = await storage.getReservations();
      const allDowntime = await storage.getDowntimeEvents({ open: true });

      const totalVehicles = allVehicles.length;
      const readyVehicles = allVehicles.filter(v => v.status === 'ready').length;
      const completedWashes = allWash.filter(w => w.status === 'completed').length;
      const pendingWashes = allWash.filter(w => w.status === 'pending').length;
      const openIncidents = allIncidents.filter(i => i.status !== 'closed' && i.status !== 'resolved').length;
      const criticalIncidents = allIncidents.filter(i => i.severity === 'critical' && i.status !== 'closed').length;
      const activeReservations = allReservations.filter(r => r.status === 'confirmed' || r.status === 'checked_out').length;

      const kpiSummary = {
        totalVehicles, readyVehicles,
        fleetUtilization: totalVehicles > 0 ? Math.round(((totalVehicles - readyVehicles) / totalVehicles) * 100) : 0,
        completedWashes, pendingWashes, openIncidents, criticalIncidents, activeReservations,
        openDowntime: allDowntime.length, openAnomalies: allAnomalies.length,
      };

      const anomalySummary = {
        total: allAnomalies.length,
        byType: allAnomalies.reduce((acc, a) => { acc[a.type] = (acc[a.type] || 0) + 1; return acc; }, {} as Record<string, number>),
      };

      const recommendations: string[] = [];
      if (kpiSummary.fleetUtilization < 50) recommendations.push('Fleet utilization is below 50%. Consider reassigning idle vehicles.');
      if (pendingWashes > 10) recommendations.push(`${pendingWashes} washes pending. Consider adding wash staff or extending hours.`);
      if (criticalIncidents > 0) recommendations.push(`${criticalIncidents} critical incident(s) open. Prioritize resolution.`);
      if (allAnomalies.length > 0) recommendations.push(`${allAnomalies.length} open anomalies require attention.`);
      if (allDowntime.length > 3) recommendations.push(`${allDowntime.length} vehicles currently in downtime. Review repair pipeline.`);

      const briefing = await storage.createExecutiveBriefing({
        title: `Daily Briefing — ${today}`,
        summary: `Fleet: ${totalVehicles} vehicles (${readyVehicles} ready). ${completedWashes} washes completed, ${pendingWashes} pending. ${openIncidents} open incidents (${criticalIncidents} critical). ${activeReservations} active reservations.`,
        date: today,
        kpiSummary, anomalySummary, recommendations,
        generatedBy: 'system',
      });

      recordUsage({ action: "briefing_generated", userId: (req.user as Express.User)?.id, entityType: "briefing", entityId: String(briefing.id) });
      res.status(201).json(briefing);
    } catch (e) { next(e); }
  });

  // VEHICLE TRENDS
  app.get("/api/vehicles/:id/trends", requireAuth, async (req, res, next) => {
    try { res.json(await storage.getVehicleTrends(Number(req.params.id))); } catch (e) { next(e); }
  });

  // SEARCH
  app.get("/api/search", requireAuth, searchLimiter, async (req, res, next) => {
    try {
      const q = (req.query.q as string) || '';
      if (!q.trim()) return res.json([]);
      res.json(await storage.searchEntities(q));
    } catch (e) { next(e); }
  });
}
