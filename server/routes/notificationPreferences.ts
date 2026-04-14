/**
 * Notification preference routes.
 * Allows users to configure per-category notification settings.
 */
import type { Express, Request, Response } from "express";
import { requireAuth } from "../auth.js";
import { db } from "../db.js";
import { notificationPreferences } from "../../shared/schema.js";
import { eq, and } from "drizzle-orm";

const CATEGORIES = ["critical", "queue", "shift", "incident", "system", "chat"] as const;

export function registerNotificationPreferenceRoutes(app: Express) {
  // ─── GET notification preferences for current user ───────────────────
  app.get("/api/user/notification-preferences", requireAuth, async (req: Request, res: Response) => {
    const userId = (req.user as Express.User).id;
    try {
      const prefs = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId));
      // Fill in defaults for missing categories
      const mapped = CATEGORIES.map(cat => {
        const existing = prefs.find(p => p.category === cat);
        return existing ?? { category: cat, inApp: true, email: false, push: false, sound: true };
      });
      res.json(mapped);
    } catch {
      res.json(CATEGORIES.map(cat => ({ category: cat, inApp: true, email: false, push: false, sound: true })));
    }
  });

  // ─── PUT update a notification preference ────────────────────────────
  app.put("/api/user/notification-preferences/:category", requireAuth, async (req: Request, res: Response) => {
    const userId = (req.user as Express.User).id;
    const category = req.params.category as string;
    if (!CATEGORIES.includes(category as any)) {
      return res.status(400).json({ message: `Invalid category: ${category}` });
    }
    const { inApp, email, push, sound } = req.body;
    try {
      const existing = await db.select().from(notificationPreferences)
        .where(and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.category, category)));
      if (existing.length > 0) {
        await db.update(notificationPreferences)
          .set({ inApp: inApp ?? true, email: email ?? false, push: push ?? false, sound: sound ?? true, updatedAt: new Date() })
          .where(and(eq(notificationPreferences.userId, userId), eq(notificationPreferences.category, category)));
      } else {
        await db.insert(notificationPreferences).values({
          userId,
          category: category as string,
          inApp: inApp ?? true,
          email: email ?? false,
          push: push ?? false,
          sound: sound ?? true,
        });
      }
      res.json({ message: "Preference updated" });
    } catch {
      res.status(500).json({ message: "Failed to update preference" });
    }
  });
}
