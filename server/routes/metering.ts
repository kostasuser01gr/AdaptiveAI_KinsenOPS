/**
 * Usage metering admin routes — reporting & event inspection (Phase 4.2A).
 */
import type { Express } from "express";
import { storage } from "../storage.js";
import { requireAuth, requireRole } from "../auth.js";

export function registerMeteringRoutes(app: Express) {
  // ─── DAILY ROLLUP REPORT ───
  app.get(
    "/api/usage/summary",
    requireAuth,
    requireRole("admin"),
    async (req, res, next) => {
      try {
        const filters: { workspaceId?: string; feature?: string; from?: string; to?: string } = {};
        if (req.query.workspaceId) filters.workspaceId = String(req.query.workspaceId);
        if (req.query.feature) filters.feature = String(req.query.feature);
        if (req.query.from) filters.from = String(req.query.from);
        if (req.query.to) filters.to = String(req.query.to);
        const rollups = await storage.getDailyRollups(filters);
        res.json(rollups);
      } catch (e) { next(e); }
    },
  );

  // ─── RAW EVENTS (ADMIN AUDIT) ───
  app.get(
    "/api/usage/events",
    requireAuth,
    requireRole("admin"),
    async (req, res, next) => {
      try {
        const filters: { workspaceId?: string; feature?: string; userId?: number; from?: Date; to?: Date; limit?: number } = {};
        if (req.query.workspaceId) filters.workspaceId = String(req.query.workspaceId);
        if (req.query.feature) filters.feature = String(req.query.feature);
        if (req.query.userId) filters.userId = Number(req.query.userId);
        if (req.query.from) filters.from = new Date(String(req.query.from));
        if (req.query.to) filters.to = new Date(String(req.query.to));
        filters.limit = Math.min(Number(req.query.limit) || 100, 500);
        const events = await storage.getUsageEvents(filters);
        res.json(events);
      } catch (e) { next(e); }
    },
  );

  // ─── USAGE TOTAL FOR A FEATURE ───
  app.get(
    "/api/usage/total/:feature",
    requireAuth,
    requireRole("admin"),
    async (req, res, next) => {
      try {
        const workspaceId = String(req.query.workspaceId || "default");
        const from = req.query.from ? String(req.query.from) : undefined;
        const to = req.query.to ? String(req.query.to) : undefined;
        const total = await storage.getUsageTotal(workspaceId, String(req.params.feature), from, to);
        res.json({ feature: req.params.feature, workspaceId, from, to, total });
      } catch (e) { next(e); }
    },
  );
}
