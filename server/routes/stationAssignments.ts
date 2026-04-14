/**
 * Station assignment admin routes — multi-station management (Phase 4.2A).
 */
import type { Express } from "express";
import { z } from "zod/v4";
import { storage } from "../storage.js";
import { requireAuth, requireRole } from "../auth.js";
import { resolveStationScope } from "../middleware/stationScope.js";
import { validateIdParam, validateRequest } from "../middleware/validation.js";

export function registerStationAssignmentRoutes(app: Express) {
  // ─── GET USER'S STATION ASSIGNMENTS ───
  app.get("/api/station-assignments/users/:id", requireAuth, requireRole("admin", "supervisor"), validateIdParam(), async (req, res, next) => {
    try {
      const userId = Number(req.params.id);
      const assignments = await storage.getUserStationAssignments(userId);
      res.json(assignments);
    } catch (e) { next(e); }
  });

  // ─── GET STATION'S USER ASSIGNMENTS ───
  app.get("/api/station-assignments/stations/:id", requireAuth, requireRole("admin", "supervisor"), validateIdParam(), async (req, res, next) => {
    try {
      const stationId = Number(req.params.id);
      const assignments = await storage.getStationUsers(stationId);
      res.json(assignments);
    } catch (e) { next(e); }
  });

  // ─── SET USER'S STATIONS (REPLACE ALL) ───
  app.put("/api/station-assignments/users/:id", requireAuth, requireRole("admin"), validateIdParam(), async (req, res, next) => {
    try {
      const userId = Number(req.params.id);
      const schema = z.object({
        stationIds: z.array(z.number().int().positive()),
      });
      const { stationIds } = schema.parse(req.body);
      const admin = req.user as Express.User;
      const assignments = await storage.setUserStations(userId, stationIds, admin.id);
      res.json(assignments);
    } catch (e) { next(e); }
  });

  // ─── ADD SINGLE ASSIGNMENT ───
  app.post("/api/station-assignments", requireAuth, requireRole("admin"), async (req, res, next) => {
    try {
      const schema = z.object({
        userId: z.number().int().positive(),
        stationId: z.number().int().positive(),
        isPrimary: z.boolean().optional(),
      });
      const data = schema.parse(req.body);
      const admin = req.user as Express.User;
      const assignment = await storage.assignUserToStation({
        ...data,
        assignedBy: admin.id,
      });
      res.status(201).json(assignment);
    } catch (e) { next(e); }
  });

  // ─── REMOVE SINGLE ASSIGNMENT ───
  app.delete("/api/station-assignments/users/:userId/stations/:stationId", requireAuth, requireRole("admin"),
    validateRequest({ params: z.object({ userId: z.coerce.number().int().positive(), stationId: z.coerce.number().int().positive() }) }),
    async (req, res, next) => {
    try {
      const userId = Number(req.params.userId);
      const stationId = Number(req.params.stationId);
      await storage.removeUserFromStation(userId, stationId);
      res.status(204).end();
    } catch (e) { next(e); }
  });

  // ─── RESOLVE MY STATION SCOPE ───
  app.get("/api/station-assignments/me", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const scope = await resolveStationScope(user);
      const assignments = await storage.getUserStationAssignments(user.id);
      res.json({
        userId: user.id,
        role: user.role,
        scope: scope === null ? "unrestricted" : scope === "none" ? "none" : "restricted",
        stationIds: scope === null ? null : scope === "none" ? [] : scope,
        assignments,
      });
    } catch (e) { next(e); }
  });
}
