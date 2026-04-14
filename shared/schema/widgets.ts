/**
 * Widgets domain: user tabs, widget definitions, tab widgets.
 */
import { pgTable, text, integer, boolean, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspaces, users } from "./core.js";

// ─── USER TABS (personal workspace tabs) ───
export const userTabs = pgTable("user_tabs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  userId: integer("user_id").notNull().references(() => users.id),
  label: text("label").notNull(),
  icon: text("icon").notNull().default("LayoutGrid"),
  order: integer("order").notNull().default(0),
  isDefault: boolean("is_default").notNull().default(false),
  template: text("template"),
  config: jsonb("config").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("user_tabs_user_idx").on(t.userId),
  index("user_tabs_order_idx").on(t.userId, t.order),
]);
export const insertUserTabSchema = createInsertSchema(userTabs).omit({ createdAt: true, updatedAt: true });
export type InsertUserTab = z.infer<typeof insertUserTabSchema>;
export type UserTab = typeof userTabs.$inferSelect;

// ─── WIDGET DEFINITIONS (global widget catalog) ───
export const widgetDefinitions = pgTable("widget_definitions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"),
  icon: text("icon").notNull().default("Box"),
  component: text("component").notNull(),
  defaultW: integer("default_w").notNull().default(4),
  defaultH: integer("default_h").notNull().default(3),
  minW: integer("min_w").notNull().default(2),
  minH: integer("min_h").notNull().default(2),
  maxW: integer("max_w"),
  maxH: integer("max_h"),
  defaultConfig: jsonb("default_config").$type<Record<string, unknown>>(),
  builtIn: boolean("built_in").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("widget_defs_ws_slug_idx").on(t.workspaceId, t.slug),
  index("widget_defs_category_idx").on(t.category),
]);
export const insertWidgetDefinitionSchema = createInsertSchema(widgetDefinitions).omit({ createdAt: true });
export type InsertWidgetDefinition = z.infer<typeof insertWidgetDefinitionSchema>;
export type WidgetDefinition = typeof widgetDefinitions.$inferSelect;

// ─── TAB WIDGETS (widget instances placed on tabs) ───
export const tabWidgets = pgTable("tab_widgets", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  tabId: integer("tab_id").notNull().references(() => userTabs.id, { onDelete: "cascade" }),
  widgetSlug: text("widget_slug").notNull(),
  x: integer("x").notNull().default(0),
  y: integer("y").notNull().default(0),
  w: integer("w").notNull().default(4),
  h: integer("h").notNull().default(3),
  config: jsonb("config").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("tab_widgets_tab_idx").on(t.tabId),
]);
export const insertTabWidgetSchema = createInsertSchema(tabWidgets).omit({ createdAt: true });
export type InsertTabWidget = z.infer<typeof insertTabWidgetSchema>;
export type TabWidget = typeof tabWidgets.$inferSelect;
