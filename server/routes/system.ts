import type { Express } from "express";
import { storage } from "../storage.js";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import { searchLimiter } from "../middleware/rate-limiter.js";
import { metricsCollector } from "../observability/metrics.js";
import { wsManager } from "../websocket.js";
import { resolveStationScope } from "../middleware/stationScope.js";
import { taskRunner } from "../tasks/index.js";

export function registerSystemRoutes(app: Express) {
  // COMMAND PALETTE SEARCH
  app.get("/api/command-palette/search", requireAuth, searchLimiter, async (req, res, next) => {
    try {
      const q = String(req.query.q || '').trim();
      if (!q || q.length < 2) return res.json({ results: [], quickActions: [] });

      const qLower = q.toLowerCase();
      const user = req.user as Express.User;
      const paletteScope = await resolveStationScope(user);
      const results: Array<{ type: string; id: number | string; label: string; description?: string; route: string; icon: string }> = [];

      if (paletteScope === 'none') {
        return res.json({ results: [], quickActions: [], totalMatches: 0 });
      }

      const allVehicles = await storage.getVehicles();
      for (const v of allVehicles) {
        if (paletteScope !== null && v.stationId !== null && !paletteScope.includes(v.stationId as number)) continue;
        if (v.plate.toLowerCase().includes(qLower) || v.model.toLowerCase().includes(qLower)) {
          results.push({ type: 'vehicle', id: v.id, label: v.plate, description: `${v.model} — ${v.status}`, route: `/fleet`, icon: 'Car' });
        }
      }

      const allIncidents = paletteScope === null
        ? await storage.getIncidents()
        : (await storage.getIncidents()).filter(i => i.stationId !== null && paletteScope.includes(i.stationId));
      for (const i of allIncidents) {
        if (i.title.toLowerCase().includes(qLower) || `inc-${i.id}`.includes(qLower)) {
          results.push({ type: 'incident', id: i.id, label: `INC-${i.id}: ${i.title}`, description: `${i.severity} — ${i.status}`, route: `/war-room`, icon: 'AlertTriangle' });
        }
      }

      const allReservations = paletteScope === null
        ? await storage.getReservations()
        : (await storage.getReservations()).filter(r => r.stationId !== null && paletteScope.includes(r.stationId));
      for (const r of allReservations) {
        if (r.customerName.toLowerCase().includes(qLower) || (r.customerEmail && r.customerEmail.toLowerCase().includes(qLower))) {
          results.push({ type: 'reservation', id: r.id, label: `Reservation #${r.id}: ${r.customerName}`, description: r.status, route: `/calendar`, icon: 'CalendarDays' });
        }
      }

      const allRepairOrders = paletteScope === null
        ? await storage.getRepairOrders()
        : (await storage.getRepairOrders()).filter(ro => ro.stationId !== null && paletteScope.includes(ro.stationId));
      for (const ro of allRepairOrders) {
        if (ro.title.toLowerCase().includes(qLower) || `ro-${ro.id}`.includes(qLower)) {
          results.push({ type: 'repair_order', id: ro.id, label: `RO-${ro.id}: ${ro.title}`, description: `${ro.priority} — ${ro.status}`, route: `/fleet`, icon: 'Wrench' });
        }
      }

      const kbDocs = await storage.searchKnowledgeDocuments(q);
      for (const doc of kbDocs.slice(0, 5)) {
        results.push({ type: 'knowledge_document', id: doc.id, label: doc.title, description: `${doc.category} — ${doc.filename}`, route: `/knowledge-base`, icon: 'FileText' });
      }

      const allRules = await storage.getAutomationRules();
      for (const r of allRules) {
        if (r.name.toLowerCase().includes(qLower)) {
          results.push({ type: 'automation_rule', id: r.id, label: r.name, description: `Trigger: ${r.trigger}`, route: `/automations`, icon: 'Zap' });
        }
      }

      if (['admin', 'supervisor'].includes(user.role)) {
        const allUsers = await storage.getUsers();
        for (const u of allUsers) {
          if (u.displayName.toLowerCase().includes(qLower) || u.username.toLowerCase().includes(qLower)) {
            results.push({ type: 'user', id: u.id, label: u.displayName, description: `@${u.username} — ${u.role}`, route: `/users`, icon: 'User' });
          }
        }
      }

      const quickActions: Array<{ type: string; id: string; label: string; description: string; route: string; icon: string }> = [];
      const actionMap: Record<string, { label: string; route: string; icon: string; description: string }> = {
        fleet: { label: 'Go to Fleet', route: '/fleet', icon: 'Car', description: 'Vehicle management' },
        wash: { label: 'Go to Washers', route: '/washers', icon: 'Droplets', description: 'Wash queue' },
        shifts: { label: 'Go to Shifts', route: '/shifts', icon: 'Clock', description: 'Staff scheduling' },
        calendar: { label: 'Go to Calendar', route: '/calendar', icon: 'CalendarDays', description: 'Reservations view' },
        incidents: { label: 'Go to War Room', route: '/war-room', icon: 'AlertTriangle', description: 'Incident management' },
        analytics: { label: 'Go to Analytics', route: '/analytics', icon: 'BarChart3', description: 'KPI dashboard' },
        automations: { label: 'Go to Automations', route: '/automations', icon: 'Zap', description: 'Rule engine' },
        knowledge: { label: 'Go to Knowledge Base', route: '/knowledge-base', icon: 'BookOpen', description: 'Documents & SOPs' },
        trust: { label: 'Go to Trust Console', route: '/trust', icon: 'Shield', description: 'Governance & compliance' },
        settings: { label: 'Go to Settings', route: '/settings', icon: 'Settings', description: 'Preferences' },
      };
      for (const [key, action] of Object.entries(actionMap)) {
        if (key.includes(qLower) || action.label.toLowerCase().includes(qLower) || action.description.toLowerCase().includes(qLower)) {
          quickActions.push({ type: 'action', id: `action_${key}`, ...action });
        }
      }

      res.json({
        results: results.slice(0, 20),
        quickActions: quickActions.slice(0, 5),
        totalMatches: results.length,
      });
    } catch (e) { next(e); }
  });

  // SYSTEM HEALTH
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
      tasks: taskRunner.getStates(),
      timestamp: new Date().toISOString(),
    });
  });

  // METRICS
  app.get("/api/metrics", requireRole("admin"), async (_req, res) => {
    const metrics = metricsCollector.getMetrics();
    const wsStats = wsManager.getStats();
    res.json({
      ...metrics,
      websocket: wsStats,
      week1: metricsCollector.getWeek1Counters(),
      tasks: taskRunner.getStates(),
    });
  });

  // TASK RUNNER — manual trigger
  app.post("/api/tasks/:taskId/trigger", requireRole("admin"), async (req, res, next) => {
    try {
      const taskId = String(req.params.taskId);
      const result = await taskRunner.trigger(taskId);
      if (!result.ok) return res.status(400).json({ message: result.error });
      res.json({ message: "triggered", task: taskRunner.getState(taskId) });
    } catch (e) { next(e); }
  });

  // TASK RUNNER — list all task states
  app.get("/api/tasks", requireRole("admin", "supervisor"), async (_req, res) => {
    res.json(taskRunner.getStates());
  });
}
