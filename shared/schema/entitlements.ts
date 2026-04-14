/**
 * Entitlements domain: plans, overrides, usage metering, station assignments, capabilities.
 */
import { pgTable, text, integer, boolean, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspaces, users, stations } from "./core.js";

// ─── WORKSPACE PLANS ───
export const workspacePlans = pgTable("workspace_plans", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().unique().default("default").references(() => workspaces.id),
  plan: text("plan").notNull().default("core"),
  label: text("label"),
  activatedAt: timestamp("activated_at").notNull().defaultNow(),
  activatedBy: integer("activated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const insertWorkspacePlanSchema = createInsertSchema(workspacePlans).omit({ activatedAt: true, updatedAt: true });
export type InsertWorkspacePlan = z.infer<typeof insertWorkspacePlanSchema>;
export type WorkspacePlan = typeof workspacePlans.$inferSelect;

// ─── ENTITLEMENT OVERRIDES ───
export const entitlementOverrides = pgTable("entitlement_overrides", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  feature: text("feature").notNull(),
  enabled: boolean("enabled").notNull(),
  reason: text("reason"),
  updatedBy: integer("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("ent_override_ws_feature_idx").on(t.workspaceId, t.feature),
]);
export const insertEntitlementOverrideSchema = createInsertSchema(entitlementOverrides).omit({ updatedAt: true });
export type InsertEntitlementOverride = z.infer<typeof insertEntitlementOverrideSchema>;
export type EntitlementOverride = typeof entitlementOverrides.$inferSelect;

// ─── USAGE EVENTS (append-only raw metered actions) ───
export const usageEvents = pgTable("usage_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  feature: text("feature").notNull(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  idempotencyKey: text("idempotency_key"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("usage_evt_ws_feature_idx").on(t.workspaceId, t.feature),
  index("usage_evt_created_idx").on(t.createdAt),
  index("usage_evt_user_idx").on(t.userId),
  uniqueIndex("usage_evt_idempotency_idx").on(t.idempotencyKey),
]);
export const insertUsageEventSchema = createInsertSchema(usageEvents).omit({ createdAt: true });
export type InsertUsageEvent = z.infer<typeof insertUsageEventSchema>;
export type UsageEvent = typeof usageEvents.$inferSelect;

// ─── USAGE DAILY ROLLUPS (materialized for fast reporting) ───
export const usageDailyRollups = pgTable("usage_daily_rollups", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  feature: text("feature").notNull(),
  date: text("date").notNull(),
  count: integer("count").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("usage_rollup_ws_feature_date_idx").on(t.workspaceId, t.feature, t.date),
  index("usage_rollup_date_idx").on(t.date),
]);
export const insertUsageDailyRollupSchema = createInsertSchema(usageDailyRollups).omit({ updatedAt: true });
export type InsertUsageDailyRollup = z.infer<typeof insertUsageDailyRollupSchema>;
export type UsageDailyRollup = typeof usageDailyRollups.$inferSelect;

// ─── USER STATION ASSIGNMENTS (multi-station) ───
export const userStationAssignments = pgTable("user_station_assignments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  userId: integer("user_id").notNull().references(() => users.id),
  stationId: integer("station_id").notNull().references(() => stations.id),
  isPrimary: boolean("is_primary").notNull().default(false),
  assignedBy: integer("assigned_by").references(() => users.id),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("user_station_assign_idx").on(t.userId, t.stationId),
  index("user_station_user_idx").on(t.userId),
  index("user_station_station_idx").on(t.stationId),
]);
export const insertUserStationAssignmentSchema = createInsertSchema(userStationAssignments).omit({ assignedAt: true });
export type InsertUserStationAssignment = z.infer<typeof insertUserStationAssignmentSchema>;
export type UserStationAssignment = typeof userStationAssignments.$inferSelect;

// ─── ROLE CAPABILITIES (per-role default capabilities) ───
export const roleCapabilities = pgTable("role_capabilities", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  role: text("role").notNull(),
  capability: text("capability").notNull(),
  granted: boolean("granted").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("role_cap_role_cap_idx").on(t.role, t.capability),
]);
export const insertRoleCapabilitySchema = createInsertSchema(roleCapabilities).omit({ updatedAt: true });
export type InsertRoleCapability = z.infer<typeof insertRoleCapabilitySchema>;
export type RoleCapability = typeof roleCapabilities.$inferSelect;

// ─── USER CAPABILITY OVERRIDES (per-user, sparse) ───
export const userCapabilityOverrides = pgTable("user_capability_overrides", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  userId: integer("user_id").notNull().references(() => users.id),
  capability: text("capability").notNull(),
  granted: boolean("granted").notNull(),
  reason: text("reason"),
  grantedBy: integer("granted_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("user_cap_user_cap_idx").on(t.userId, t.capability),
  index("user_cap_user_idx").on(t.userId),
]);
export const insertUserCapabilityOverrideSchema = createInsertSchema(userCapabilityOverrides).omit({ updatedAt: true });
export type InsertUserCapabilityOverride = z.infer<typeof insertUserCapabilityOverrideSchema>;
export type UserCapabilityOverride = typeof userCapabilityOverrides.$inferSelect;
