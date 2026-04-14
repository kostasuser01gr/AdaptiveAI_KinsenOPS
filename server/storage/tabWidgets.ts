import { db, eq, and, wsFilter, wsInsert } from "./base.js";
import {
  userTabs, type InsertUserTab,
  widgetDefinitions, type InsertWidgetDefinition,
  tabWidgets, type InsertTabWidget,
} from "../../shared/schema.js";
import { withTransaction } from "../db.js";

export class TabWidgetStorage {
  // ─── USER TABS ───
  async getUserTabs(userId: number) {
    return db.select().from(userTabs)
      .where(and(eq(userTabs.userId, userId), wsFilter(userTabs)))
      .orderBy(userTabs.order);
  }
  async getUserTab(id: number) {
    const [tab] = await db.select().from(userTabs)
      .where(and(eq(userTabs.id, id), wsFilter(userTabs)));
    return tab;
  }
  async createUserTab(data: InsertUserTab) {
    const [tab] = await db.insert(userTabs).values(wsInsert(data)).returning();
    return tab;
  }
  async updateUserTab(id: number, data: Partial<InsertUserTab>) {
    const [tab] = await db.update(userTabs)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(userTabs.id, id), wsFilter(userTabs)))
      .returning();
    return tab;
  }
  async deleteUserTab(id: number) {
    await db.delete(userTabs).where(and(eq(userTabs.id, id), wsFilter(userTabs)));
  }
  async reorderUserTabs(userId: number, tabIds: number[]) {
    await withTransaction(async (tx) => {
      for (let i = 0; i < tabIds.length; i++) {
        await tx.update(userTabs).set({ order: i, updatedAt: new Date() })
          .where(and(eq(userTabs.id, tabIds[i]), eq(userTabs.userId, userId), wsFilter(userTabs)));
      }
    });
  }

  // ─── WIDGET DEFINITIONS ───
  async getWidgetDefinitions(category?: string) {
    if (category) {
      return db.select().from(widgetDefinitions)
        .where(and(eq(widgetDefinitions.category, category), eq(widgetDefinitions.active, true), wsFilter(widgetDefinitions)));
    }
    return db.select().from(widgetDefinitions)
      .where(and(eq(widgetDefinitions.active, true), wsFilter(widgetDefinitions)));
  }
  async getWidgetDefinition(slug: string) {
    const [def] = await db.select().from(widgetDefinitions)
      .where(and(eq(widgetDefinitions.slug, slug), wsFilter(widgetDefinitions)));
    return def;
  }
  async createWidgetDefinition(data: InsertWidgetDefinition) {
    const [def] = await db.insert(widgetDefinitions).values(wsInsert(data)).returning();
    return def;
  }
  async updateWidgetDefinition(id: number, data: Partial<InsertWidgetDefinition>) {
    const [def] = await db.update(widgetDefinitions).set(data)
      .where(and(eq(widgetDefinitions.id, id), wsFilter(widgetDefinitions)))
      .returning();
    return def;
  }

  // ─── TAB WIDGETS ───
  async getTabWidgets(tabId: number) {
    return db.select().from(tabWidgets).where(eq(tabWidgets.tabId, tabId));
  }
  async createTabWidget(data: InsertTabWidget) {
    const [widget] = await db.insert(tabWidgets).values(data).returning();
    return widget;
  }
  async updateTabWidget(id: number, data: Partial<InsertTabWidget>) {
    const [widget] = await db.update(tabWidgets).set(data)
      .where(eq(tabWidgets.id, id)).returning();
    return widget;
  }
  async deleteTabWidget(id: number) {
    await db.delete(tabWidgets).where(eq(tabWidgets.id, id));
  }
  async bulkUpdateTabWidgetLayout(tabId: number, layouts: Array<{ id: number; x: number; y: number; w: number; h: number }>) {
    await withTransaction(async (tx) => {
      for (const l of layouts) {
        await tx.update(tabWidgets)
          .set({ x: l.x, y: l.y, w: l.w, h: l.h })
          .where(and(eq(tabWidgets.id, l.id), eq(tabWidgets.tabId, tabId)));
      }
    });
  }
}
