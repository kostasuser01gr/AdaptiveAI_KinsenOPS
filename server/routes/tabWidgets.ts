import type { Express } from "express";
import { z } from "zod/v4";
import { storage } from "../storage.js";
import { requireAuth } from "../auth.js";
import { insertUserTabSchema, insertTabWidgetSchema } from "../../shared/schema.js";

export function registerTabWidgetRoutes(app: Express) {
  // ─── USER TABS ───
  app.get("/api/tabs", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      res.json(await storage.getUserTabs(userId));
    } catch (e) { next(e); }
  });

  app.post("/api/tabs", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const data = insertUserTabSchema.parse({ ...req.body, userId });
      res.status(201).json(await storage.createUserTab(data));
    } catch (e) { next(e); }
  });

  app.patch("/api/tabs/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const tab = await storage.getUserTab(Number(req.params.id));
      if (!tab) return res.status(404).json({ message: "Not found" });
      if (tab.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      const tabPatchSchema = z.object({
        label: z.string().max(100).optional(),
        icon: z.string().max(50).optional(),
        order: z.number().int().min(0).optional(),
        isDefault: z.boolean().optional(),
        template: z.string().max(50).nullable().optional(),
        config: z.record(z.string(), z.unknown()).nullable().optional(),
      }).strict();
      const parsed = tabPatchSchema.parse(req.body);
      const updated = await storage.updateUserTab(Number(req.params.id), parsed);
      res.json(updated);
    } catch (e) { next(e); }
  });

  app.delete("/api/tabs/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const tab = await storage.getUserTab(Number(req.params.id));
      if (!tab) return res.status(404).json({ message: "Not found" });
      if (tab.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      await storage.deleteUserTab(Number(req.params.id));
      res.status(204).end();
    } catch (e) { next(e); }
  });

  app.post("/api/tabs/reorder", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const schema = z.object({ tabIds: z.array(z.number()) });
      const { tabIds } = schema.parse(req.body);
      await storage.reorderUserTabs(userId, tabIds);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });

  // ─── WIDGET DEFINITIONS (catalog) ───
  app.get("/api/widgets/catalog", requireAuth, async (req, res, next) => {
    try {
      const category = req.query.category as string | undefined;
      res.json(await storage.getWidgetDefinitions(category));
    } catch (e) { next(e); }
  });

  app.get("/api/widgets/catalog/:slug", requireAuth, async (req, res, next) => {
    try {
      const def = await storage.getWidgetDefinition(req.params.slug as string);
      if (!def) return res.status(404).json({ message: "Widget not found" });
      res.json(def);
    } catch (e) { next(e); }
  });

  // ─── TAB WIDGETS ───
  app.get("/api/tabs/:tabId/widgets", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const tab = await storage.getUserTab(Number(req.params.tabId));
      if (!tab) return res.status(404).json({ message: "Tab not found" });
      if (tab.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      res.json(await storage.getTabWidgets(Number(req.params.tabId)));
    } catch (e) { next(e); }
  });

  app.post("/api/tabs/:tabId/widgets", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const tab = await storage.getUserTab(Number(req.params.tabId));
      if (!tab) return res.status(404).json({ message: "Tab not found" });
      if (tab.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      const data = insertTabWidgetSchema.parse({ ...req.body, tabId: Number(req.params.tabId) });
      res.status(201).json(await storage.createTabWidget(data));
    } catch (e) { next(e); }
  });

  app.patch("/api/tabs/:tabId/widgets/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const tab = await storage.getUserTab(Number(req.params.tabId));
      if (!tab) return res.status(404).json({ message: "Tab not found" });
      if (tab.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      const widgetPatchSchema = z.object({
        widgetSlug: z.string().max(100).optional(),
        x: z.number().int().min(0).optional(),
        y: z.number().int().min(0).optional(),
        w: z.number().int().min(1).optional(),
        h: z.number().int().min(1).optional(),
        config: z.record(z.string(), z.unknown()).nullable().optional(),
      }).strict();
      const parsed = widgetPatchSchema.parse(req.body);
      const widget = await storage.updateTabWidget(Number(req.params.id), parsed);
      if (!widget) return res.status(404).json({ message: "Widget not found" });
      res.json(widget);
    } catch (e) { next(e); }
  });

  app.delete("/api/tabs/:tabId/widgets/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const tab = await storage.getUserTab(Number(req.params.tabId));
      if (!tab) return res.status(404).json({ message: "Tab not found" });
      if (tab.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      await storage.deleteTabWidget(Number(req.params.id));
      res.status(204).end();
    } catch (e) { next(e); }
  });

  app.put("/api/tabs/:tabId/layout", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const tab = await storage.getUserTab(Number(req.params.tabId));
      if (!tab) return res.status(404).json({ message: "Tab not found" });
      if (tab.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      const schema = z.object({
        layouts: z.array(z.object({
          id: z.number(),
          x: z.number(),
          y: z.number(),
          w: z.number(),
          h: z.number(),
        })),
      });
      const { layouts } = schema.parse(req.body);
      const tabId = Number(req.params.tabId);
      if (!Number.isInteger(tabId) || tabId <= 0) return res.status(400).json({ message: "Invalid tab ID" });
      await storage.bulkUpdateTabWidgetLayout(tabId, layouts);
      res.json({ ok: true });
    } catch (e) { next(e); }
  });
}
