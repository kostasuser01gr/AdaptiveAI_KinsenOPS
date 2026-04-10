/**
 * Capability admin routes — inspect, override, and manage permissions (Phase 4.2A).
 */
import type { Express } from "express";
import { storage } from "../storage.js";
import { requireAuth, requireRole } from "../auth.js";
import {
  CAPABILITY_CATALOG,
  isValidCapability,
  resolveAllCapabilities,
  invalidateCapabilityCache,
} from "../capabilities/engine.js";

export function registerCapabilityRoutes(app: Express) {
  // ─── CATALOG ───
  app.get("/api/capabilities", requireAuth, async (_req, res) => {
    res.json({ capabilities: CAPABILITY_CATALOG });
  });

  // ─── RESOLVE MY CAPABILITIES ───
  app.get("/api/capabilities/me", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const resolved = await resolveAllCapabilities(user.id, user.role);
      res.json({ userId: user.id, role: user.role, capabilities: resolved });
    } catch (e) { next(e); }
  });

  // ─── RESOLVE FOR ANY USER (ADMIN) ───
  app.get("/api/capabilities/users/:id", requireAuth, requireRole("admin"), async (req, res, next) => {
    try {
      const target = await storage.getUser(Number(req.params.id));
      if (!target) return res.status(404).json({ message: "User not found" });
      const resolved = await resolveAllCapabilities(target.id, target.role);
      res.json({ userId: target.id, role: target.role, capabilities: resolved });
    } catch (e) { next(e); }
  });

  // ─── LIST ROLE DEFAULTS ───
  app.get("/api/capabilities/roles", requireAuth, requireRole("admin"), async (_req, res, next) => {
    try {
      const all = await storage.getAllRoleCapabilities();
      res.json(all);
    } catch (e) { next(e); }
  });

  // ─── UPSERT ROLE DEFAULT ───
  app.put("/api/capabilities/roles/:role/:capability", requireAuth, requireRole("admin"), async (req, res, next) => {
    try {
      const role = String(req.params.role);
      const capability = String(req.params.capability);
      if (!isValidCapability(capability)) {
        return res.status(400).json({ message: `Unknown capability: ${capability}` });
      }
      const granted = req.body.granted !== false;
      const result = await storage.upsertRoleCapability({ role, capability, granted });
      invalidateCapabilityCache();
      res.json(result);
    } catch (e) { next(e); }
  });

  // ─── DELETE ROLE DEFAULT ───
  app.delete("/api/capabilities/roles/:role/:capability", requireAuth, requireRole("admin"), async (req, res, next) => {
    try {
      const role = String(req.params.role);
      const capability = String(req.params.capability);
      await storage.deleteRoleCapability(role, capability);
      invalidateCapabilityCache();
      res.status(204).end();
    } catch (e) { next(e); }
  });

  // ─── LIST USER OVERRIDES ───
  app.get("/api/capabilities/users/:id/overrides", requireAuth, requireRole("admin"), async (req, res, next) => {
    try {
      const overrides = await storage.getUserCapabilityOverrides(Number(req.params.id));
      res.json(overrides);
    } catch (e) { next(e); }
  });

  // ─── UPSERT USER OVERRIDE ───
  app.put("/api/capabilities/users/:id/overrides/:capability", requireAuth, requireRole("admin"), async (req, res, next) => {
    try {
      const userId = Number(req.params.id);
      const capability = String(req.params.capability);
      if (!isValidCapability(capability)) {
        return res.status(400).json({ message: `Unknown capability: ${capability}` });
      }
      const admin = req.user as Express.User;
      const granted = req.body.granted !== false;
      const reason = typeof req.body.reason === "string" ? req.body.reason : undefined;
      const result = await storage.upsertUserCapabilityOverride({
        userId,
        capability,
        granted,
        reason,
        grantedBy: admin.id,
      });
      invalidateCapabilityCache();
      res.json(result);
    } catch (e) { next(e); }
  });

  // ─── DELETE USER OVERRIDE ───
  app.delete("/api/capabilities/users/:id/overrides/:capability", requireAuth, requireRole("admin"), async (req, res, next) => {
    try {
      const userId = Number(req.params.id);
      const capability = String(req.params.capability);
      await storage.deleteUserCapabilityOverride(userId, capability);
      invalidateCapabilityCache();
      res.status(204).end();
    } catch (e) { next(e); }
  });
}
