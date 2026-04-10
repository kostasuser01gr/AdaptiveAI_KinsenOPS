import type { Express } from "express";
import { z } from "zod/v4";
import { storage } from "../storage.js";
import { requireAuth, requireRole } from "../auth.js";
import { auditLog, AUDIT_ACTIONS } from "../middleware/audit.js";

export function registerAppGraphRoutes(app: Express) {
  // List versions
  app.get("/api/app-graph/versions", requireAuth, async (req, res, next) => {
    try {
      const limit = req.query.limit ? Math.min(Number(req.query.limit), 50) : 20;
      res.json(await storage.getAppGraphVersions(limit));
    } catch (e) { next(e); }
  });

  // Get latest
  app.get("/api/app-graph/latest", requireAuth, async (req, res, next) => {
    try {
      const v = await storage.getLatestAppGraph();
      if (!v) return res.json(null);
      res.json(v);
    } catch (e) { next(e); }
  });

  // Get specific version
  app.get("/api/app-graph/versions/:version", requireAuth, async (req, res, next) => {
    try {
      const v = await storage.getAppGraphVersion(Number(req.params.version));
      if (!v) return res.status(404).json({ message: "Version not found" });
      res.json(v);
    } catch (e) { next(e); }
  });

  // Create new version
  app.post("/api/app-graph/versions", requireAuth, requireRole("admin", "supervisor"),
    auditLog({ action: AUDIT_ACTIONS.CREATE, entityType: "app_graph_version" }),
    async (req, res, next) => {
      try {
        const user = req.user as Express.User;
        const bodySchema = z.object({
          graph: z.record(z.string(), z.unknown()),
          label: z.string().optional(),
          diff: z.record(z.string(), z.unknown()).optional(),
        }).strict();
        const body = bodySchema.parse(req.body);

        // Auto-increment version
        const latest = await storage.getLatestAppGraph();
        const nextVersion = latest ? latest.version + 1 : 1;

        const v = await storage.createAppGraphVersion({
          version: nextVersion,
          graph: body.graph,
          label: body.label,
          diff: body.diff,
          createdBy: user.id,
        });
        res.status(201).json(v);
      } catch (e) { next(e); }
    });

  // Apply a version
  app.post("/api/app-graph/versions/:version/apply", requireAuth, requireRole("admin"),
    auditLog({ action: AUDIT_ACTIONS.UPDATE, entityType: "app_graph_version" }),
    async (req, res, next) => {
      try {
        const v = await storage.applyAppGraphVersion(Number(req.params.version));
        if (!v) return res.status(404).json({ message: "Version not found" });
        res.json(v);
      } catch (e) { next(e); }
    });

  // Rollback a version
  app.post("/api/app-graph/versions/:version/rollback", requireAuth, requireRole("admin"),
    auditLog({ action: AUDIT_ACTIONS.UPDATE, entityType: "app_graph_version" }),
    async (req, res, next) => {
      try {
        const v = await storage.rollbackAppGraphVersion(Number(req.params.version));
        if (!v) return res.status(404).json({ message: "Version not found" });
        res.json(v);
      } catch (e) { next(e); }
    });
}
