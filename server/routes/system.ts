import type { Express } from "express";
import { storage } from "../storage.js";
import { pool, aiPool } from "../db.js";
import { requireAuth, requireRole } from "../auth.js";
import { searchLimiter } from "../middleware/rate-limiter.js";
import { metricsCollector } from "../observability/metrics.js";
import { wsManager } from "../websocket.js";
import { resolveStationScope } from "../middleware/stationScope.js";
import { taskRunner } from "../tasks/index.js";
import { redis } from "../redis.js";
import { getAllFeatureFlags, setFeatureFlag, clearFeatureFlag, type FeatureFlagName, getFeatureFlagNames } from "../featureFlags.js";
import { getAllBreakerStats } from "../circuitBreaker.js";
import { logger } from "../observability/logger.js";
import { apiLimiter } from "../middleware/rate-limiter.js";

export function registerSystemRoutes(app: Express) {
  // ─── Client error reporting ─────────────────────────────────────────────
  app.post("/api/client-errors", apiLimiter, (req, res) => {
    const { message, stack, componentStack, url, userAgent } = req.body ?? {};
    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ ok: false, message: "message is required" });
    }
    logger.error("Client error", undefined, {
      clientError: true,
      message: String(message).slice(0, 1000),
      stack: typeof stack === "string" ? stack.slice(0, 4000) : undefined,
      componentStack: typeof componentStack === "string" ? componentStack.slice(0, 4000) : undefined,
      url: typeof url === "string" ? url.slice(0, 500) : undefined,
      userAgent: typeof userAgent === "string" ? userAgent.slice(0, 300) : undefined,
      userId: (req.user as any)?.id ?? null,
    });
    res.json({ ok: true });
  });

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

      const allVehicles = await storage.getVehicles(paletteScope !== null ? { stationIds: paletteScope } : undefined);
      for (const v of allVehicles) {
        if (v.plate.toLowerCase().includes(qLower) || v.model.toLowerCase().includes(qLower)) {
          results.push({ type: 'vehicle', id: v.id, label: v.plate, description: `${v.model} — ${v.status}`, route: `/fleet`, icon: 'Car' });
        }
      }

      const allIncidents = await storage.getIncidents(paletteScope !== null ? { stationIds: paletteScope } : undefined);
      for (const i of allIncidents) {
        if (i.title.toLowerCase().includes(qLower) || `inc-${i.id}`.includes(qLower)) {
          results.push({ type: 'incident', id: i.id, label: `INC-${i.id}: ${i.title}`, description: `${i.severity} — ${i.status}`, route: `/war-room`, icon: 'AlertTriangle' });
        }
      }

      const allReservations = await storage.getReservations(paletteScope !== null ? { stationIds: paletteScope } : undefined);
      for (const r of allReservations) {
        if (r.customerName.toLowerCase().includes(qLower) || (r.customerEmail && r.customerEmail.toLowerCase().includes(qLower))) {
          results.push({ type: 'reservation', id: r.id, label: `Reservation #${r.id}: ${r.customerName}`, description: r.status, route: `/calendar`, icon: 'CalendarDays' });
        }
      }

      const allRepairOrders = await storage.getRepairOrders(paletteScope !== null ? { stationIds: paletteScope } : undefined);
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

    let redisOk = false;
    try {
      if (redis) { await redis.ping(); redisOk = true; }
      else { redisOk = true; } // Redis is optional
    } catch { /* redis unreachable */ }

    const taskStates = taskRunner.getStates();
    const failingTasks = taskStates.filter((t: any) => t.enabled && t.errorCount > t.runCount * 0.5 && t.runCount > 0);

    const allOk = dbOk && redisOk && failingTasks.length === 0;
    const status = !dbOk ? 'degraded' : !allOk ? 'degraded' : metrics.errorRate > 50 ? 'degraded' : 'operational';

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
        redis: redisOk ? "connected" : "unreachable",
        websocket: wsStats.totalClients >= 0 ? "running" : "unknown",
        tasks: failingTasks.length === 0 ? "healthy" : `${failingTasks.length} failing`,
      },
      pools: {
        main: {
          total: pool.totalCount,
          idle: pool.idleCount,
          waiting: pool.waitingCount,
        },
        ai: {
          total: aiPool.totalCount,
          idle: aiPool.idleCount,
          waiting: aiPool.waitingCount,
        },
      },
      metrics: {
        totalRequests: metrics.totalRequests,
        avgResponseTime: metrics.avgResponseTime,
        errorRate: metrics.errorRate,
      },
      websocket: {
        totalClients: wsStats.totalClients,
        authenticatedClients: wsStats.authenticatedClients,
        subscriptions: wsStats.subscriptions,
      },
      version: '2.0.0',
      modules: 14,
      week1: metricsCollector.getWeek1Counters(),
      tasks: taskStates,
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

  // FEATURE FLAGS — read (any authenticated user)
  app.get("/api/feature-flags", requireAuth, async (_req, res) => {
    res.json(getAllFeatureFlags());
  });

  // FEATURE FLAGS — toggle (admin only)
  app.post("/api/admin/feature-flags", requireRole("admin"), async (req, res) => {
    const { flag, enabled } = req.body as { flag: string; enabled: boolean };
    const validNames = getFeatureFlagNames();
    if (!validNames.includes(flag as FeatureFlagName)) {
      return res.status(400).json({ message: `Unknown flag: ${flag}` });
    }
    if (typeof enabled !== "boolean") {
      return res.status(400).json({ message: "enabled must be a boolean" });
    }
    setFeatureFlag(flag as FeatureFlagName, enabled);
    res.json({ flag, enabled, message: "Flag updated" });
  });

  // FEATURE FLAGS — reset to default (admin only)
  app.delete("/api/admin/feature-flags/:flag", requireRole("admin"), async (req, res) => {
    const flag = req.params.flag;
    const validNames = getFeatureFlagNames();
    if (!validNames.includes(flag as FeatureFlagName)) {
      return res.status(400).json({ message: `Unknown flag: ${flag}` });
    }
    clearFeatureFlag(flag as FeatureFlagName);
    res.json({ flag, message: "Reset to default" });
  });

  // CIRCUIT BREAKER STATUS
  app.get("/api/admin/circuit-breakers", requireRole("admin", "supervisor"), async (_req, res) => {
    res.json(getAllBreakerStats());
  });
}
