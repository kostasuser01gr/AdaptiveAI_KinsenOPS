import type { Express } from "express";
import { storage } from "../storage.js";
import { requireAuth, requireRole, hashPassword } from "../auth.js";
import { userPatchSchema, stationPatchSchema } from "./_helpers.js";
import { insertStationSchema, insertUserPreferenceSchema } from "../../shared/schema.js";

export function registerUserRoutes(app: Express) {
  // USERS
  app.get("/api/users", requireRole("admin", "supervisor"), async (_req, res, next) => {
    try {
      const allUsers = await storage.getUsers();
      res.json(allUsers.map(({ password: _, ...u }) => u));
    } catch (e) { next(e); }
  });

  app.patch("/api/users/:id", requireRole("admin"), async (req, res, next) => {
    try {
      const data = userPatchSchema.parse(req.body);
      const updateData: Record<string, unknown> = { ...data };
      if (data.password) {
        updateData.password = await hashPassword(data.password);
      }
      const u = await storage.updateUser(Number(req.params.id), updateData as Partial<import("../../shared/schema.js").InsertUser>);
      if (!u) return res.status(404).json({ message: "Not found" });
      const { password: _pw, ...safeUser } = u;
      res.json(safeUser);
    } catch (e) { next(e); }
  });

  app.delete("/api/users/:id", requireRole("admin"), async (req, res, next) => {
    try {
      const targetId = Number(req.params.id);
      const currentUserId = (req.user as Express.User).id;
      if (targetId === currentUserId) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      await storage.deleteUser(targetId);
      res.status(204).end();
    } catch (e) { next(e); }
  });

  // USER PREFERENCES
  app.get("/api/user-preferences", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const category = typeof req.query.category === 'string' ? req.query.category : undefined;
      res.json(await storage.getUserPreferences(userId, category));
    } catch (e) { next(e); }
  });

  app.post("/api/user-preferences", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      res.json(await storage.setUserPreference(insertUserPreferenceSchema.parse({ ...req.body, userId })));
    } catch (e) { next(e); }
  });

  // STATIONS
  app.get("/api/stations", requireAuth, async (_req, res, next) => {
    try { res.json(await storage.getStations()); } catch (e) { next(e); }
  });

  app.post("/api/stations", requireRole("admin"), async (req, res, next) => {
    try { res.status(201).json(await storage.createStation(insertStationSchema.parse(req.body))); } catch (e) { next(e); }
  });

  app.patch("/api/stations/:id", requireRole("admin"), async (req, res, next) => {
    try {
      const s = await storage.updateStation(Number(req.params.id), stationPatchSchema.parse(req.body));
      if (!s) return res.status(404).json({ message: "Not found" });
      res.json(s);
    } catch (e) { next(e); }
  });
}
