import type { Express } from "express";
import { requireAuth, requireRole } from "../auth.js";
import { db } from "../db.js";
import { setupState, stations } from "../../shared/schema.js";
import { eq, and } from "drizzle-orm";

export function registerSetupRoutes(app: Express) {
  // Get setup state for workspace
  app.get("/api/setup/state", requireAuth, async (req, res, next) => {
    try {
      const workspaceId = (req.user as Express.User).workspaceId ?? 'default';
      const steps = await db.select().from(setupState).where(eq(setupState.workspaceId, workspaceId));
      res.json(steps);
    } catch (e) { next(e); }
  });

  // Save a single step
  app.post("/api/setup/step", requireRole("admin"), async (req, res, next) => {
    try {
      const workspaceId = (req.user as Express.User).workspaceId ?? 'default';
      const { step, data } = req.body;
      if (!step || !data) return res.status(400).json({ message: "step and data required" });

      // Upsert
      const existing = await db.select().from(setupState)
        .where(and(eq(setupState.workspaceId, workspaceId), eq(setupState.step, step)));

      if (existing.length > 0) {
        await db.update(setupState)
          .set({ data, completedAt: new Date() })
          .where(and(eq(setupState.workspaceId, workspaceId), eq(setupState.step, step)));
      } else {
        await db.insert(setupState).values({
          workspaceId,
          step,
          data,
          completedAt: new Date(),
        });
      }

      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  // Complete setup — provision initial resources
  app.post("/api/setup/complete", requireRole("admin"), async (req, res, next) => {
    try {
      const workspaceId = (req.user as Express.User).workspaceId ?? 'default';
      const { companyName, stationNames, fleetSize } = req.body;

      // Create stations if they don't exist
      if (Array.isArray(stationNames)) {
        for (const name of stationNames.slice(0, 50)) {
          if (typeof name === 'string' && name.trim()) {
            try {
              await db.insert(stations).values({
                workspaceId,
                name: name.trim(),
                code: name.trim().toLowerCase().replace(/\\s+/g, '-').slice(0, 20),
                active: true,
              });
            } catch { /* Ignore duplicates (unique constraint on ws+code) */ }
          }
        }
      }

      // Mark setup complete
      await db.insert(setupState).values({
        workspaceId,
        step: 'complete',
        data: { companyName, fleetSize, completedBy: (req.user as Express.User).id },
        completedAt: new Date(),
      }).onConflictDoUpdate({
        target: [setupState.workspaceId, setupState.step],
        set: { data: { companyName, fleetSize, completedBy: (req.user as Express.User).id }, completedAt: new Date() },
      });

      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  // System info (god-mode)
  app.get("/api/system/info", requireRole("admin"), (_req, res) => {
    res.json({
      nodeEnv: process.env.NODE_ENV || 'development', // Direct read for runtime diagnostics
      uptime: process.uptime(),
      memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      platform: process.platform,
      nodeVersion: process.version,
    });
  });
}
