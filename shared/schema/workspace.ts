/**
 * Workspace domain: rooms, messages, memory, digital twin, policies, activity, modules, config, proposals, app graph, feedback.
 */
import { pgTable, text, integer, boolean, timestamp, jsonb, real, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspaces, users, stations } from "./core.js";

// ─── ENTITY ROOMS (collaboration) ───
export const entityRooms = pgTable("entity_rooms", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("open"),
  priority: text("priority").notNull().default("normal"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("entity_rooms_entity_idx").on(t.entityType, t.entityId),
  index("entity_rooms_status_idx").on(t.status),
]);
export const insertEntityRoomSchema = createInsertSchema(entityRooms).omit({ createdAt: true });
export type InsertEntityRoom = z.infer<typeof insertEntityRoomSchema>;
export type EntityRoom = typeof entityRooms.$inferSelect;

export const roomMessages = pgTable("room_messages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  roomId: integer("room_id").notNull().references(() => entityRooms.id),
  userId: integer("user_id").references(() => users.id),
  role: text("role").notNull().default("user"),
  content: text("content").notNull(),
  type: text("type").notNull().default("message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("room_messages_room_idx").on(t.roomId, t.createdAt),
]);
export const insertRoomMessageSchema = createInsertSchema(roomMessages).omit({ createdAt: true });
export type InsertRoomMessage = z.infer<typeof insertRoomMessageSchema>;
export type RoomMessage = typeof roomMessages.$inferSelect;

// ─── WORKSPACE MEMORY (AI organizational learning) ───
export const workspaceMemory = pgTable("workspace_memory", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  category: text("category").notNull(),
  key: text("key").notNull(),
  value: text("value").notNull(),
  source: text("source").notNull().default("system"),
  confidence: real("confidence").notNull().default(1.0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("workspace_memory_category_idx").on(t.workspaceId, t.category),
  index("workspace_memory_key_idx").on(t.workspaceId, t.key),
]);
export const insertWorkspaceMemorySchema = createInsertSchema(workspaceMemory).omit({ createdAt: true, updatedAt: true });
export type InsertWorkspaceMemory = z.infer<typeof insertWorkspaceMemorySchema>;
export type WorkspaceMemory = typeof workspaceMemory.$inferSelect;

// ─── DIGITAL TWIN SNAPSHOTS ───
export const digitalTwinSnapshots = pgTable("digital_twin_snapshots", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  stationId: integer("station_id").references(() => stations.id),
  snapshotType: text("snapshot_type").notNull().default("hourly"),
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("dt_snapshots_station_idx").on(t.stationId),
  index("dt_snapshots_created_idx").on(t.createdAt),
  index("dt_snapshots_type_idx").on(t.snapshotType),
]);
export const insertDigitalTwinSnapshotSchema = createInsertSchema(digitalTwinSnapshots).omit({ createdAt: true });
export type InsertDigitalTwinSnapshot = z.infer<typeof insertDigitalTwinSnapshotSchema>;
export type DigitalTwinSnapshot = typeof digitalTwinSnapshots.$inferSelect;

// ─── SYSTEM POLICIES (governance engine) ───
export const systemPolicies = pgTable("system_policies", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  name: text("name").notNull(),
  category: text("category").notNull(),
  rule: jsonb("rule").$type<Record<string, unknown>>().notNull(),
  enforcement: text("enforcement").notNull().default("warn"),
  scope: text("scope").notNull().default("global"),
  active: boolean("active").notNull().default(true),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const insertSystemPolicySchema = createInsertSchema(systemPolicies).omit({ createdAt: true, updatedAt: true });
export type InsertSystemPolicy = z.infer<typeof insertSystemPolicySchema>;
export type SystemPolicy = typeof systemPolicies.$inferSelect;

// ─── ACTIVITY FEED (realtime event distribution) ───
export const activityFeed = pgTable("activity_feed", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  userId: integer("user_id").references(() => users.id),
  actorName: text("actor_name").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  entityLabel: text("entity_label"),
  stationId: integer("station_id").references(() => stations.id),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("activity_feed_created_idx").on(t.createdAt),
  index("activity_feed_entity_idx").on(t.entityType, t.entityId),
  index("activity_feed_station_idx").on(t.stationId),
]);
export const insertActivityFeedSchema = createInsertSchema(activityFeed).omit({ createdAt: true });
export type InsertActivityFeed = z.infer<typeof insertActivityFeedSchema>;
export type ActivityFeedEntry = typeof activityFeed.$inferSelect;

// ─── MODULE REGISTRY (plug-and-unplug architecture) ───
export const moduleRegistry = pgTable("module_registry", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("operations"),
  icon: text("icon").notNull().default("Box"),
  route: text("route").notNull(),
  requiredRole: text("required_role").notNull().default("agent"),
  enabled: boolean("enabled").notNull().default(true),
  order: integer("order").notNull().default(0),
  config: jsonb("config").$type<Record<string, unknown>>(),
}, (t) => [
  uniqueIndex("module_registry_ws_slug_idx").on(t.workspaceId, t.slug),
]);
export const insertModuleRegistrySchema = createInsertSchema(moduleRegistry);
export type InsertModuleRegistry = z.infer<typeof insertModuleRegistrySchema>;
export type ModuleRegistryEntry = typeof moduleRegistry.$inferSelect;

// ─── WORKSPACE CONFIG (tenant-level configuration) ───
export const workspaceConfig = pgTable("workspace_config", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  key: text("key").notNull(),
  value: jsonb("value").$type<unknown>().notNull(),
  category: text("category").notNull().default("general"),
  description: text("description"),
  updatedBy: integer("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("workspace_config_ws_key_idx").on(t.workspaceId, t.key),
]);
export const insertWorkspaceConfigSchema = createInsertSchema(workspaceConfig).omit({ updatedAt: true });
export type InsertWorkspaceConfig = z.infer<typeof insertWorkspaceConfigSchema>;
export type WorkspaceConfigEntry = typeof workspaceConfig.$inferSelect;

// ─── WORKSPACE PROPOSALS (adaptive workspace review pipeline) ───
export const workspaceProposals = pgTable("workspace_proposals", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type").notNull(),
  label: text("label").notNull(),
  description: text("description"),
  category: text("category").notNull().default("general"),
  impact: text("impact").notNull().default("low"),
  scope: text("scope").notNull().default("personal"),
  status: text("status").notNull().default("proposed"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  previousValue: jsonb("previous_value").$type<Record<string, unknown>>(),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewNote: text("review_note"),
  appliedAt: timestamp("applied_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("proposals_user_idx").on(t.userId),
  index("proposals_status_idx").on(t.status),
]);
export const insertWorkspaceProposalSchema = createInsertSchema(workspaceProposals).omit({ createdAt: true, updatedAt: true, reviewedBy: true, reviewNote: true, appliedAt: true, previousValue: true });
export type InsertWorkspaceProposal = z.infer<typeof insertWorkspaceProposalSchema>;
export type WorkspaceProposal = typeof workspaceProposals.$inferSelect;

// ─── APP GRAPH VERSIONS (versioned application configuration) ───
export const appGraphVersions = pgTable("app_graph_versions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  version: integer("version").notNull(),
  label: text("label"),
  graph: jsonb("graph").$type<Record<string, unknown>>().notNull(),
  diff: jsonb("diff").$type<Record<string, unknown>>(),
  createdBy: integer("created_by").notNull().references(() => users.id),
  appliedAt: timestamp("applied_at"),
  rolledBackAt: timestamp("rolled_back_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("app_graph_ws_version_idx").on(t.workspaceId, t.version),
  index("app_graph_created_idx").on(t.createdAt),
]);
export const insertAppGraphVersionSchema = createInsertSchema(appGraphVersions).omit({ createdAt: true, appliedAt: true, rolledBackAt: true });
export type InsertAppGraphVersion = z.infer<typeof insertAppGraphVersionSchema>;
export type AppGraphVersion = typeof appGraphVersions.$inferSelect;

// ─── IN-APP FEEDBACK ───
export const feedback = pgTable("feedback", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  userId: integer("user_id").references(() => users.id),
  role: text("role"),
  page: text("page").notNull(),
  category: text("category").notNull(),
  message: text("message").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("feedback_user_idx").on(t.userId),
  index("feedback_page_idx").on(t.page),
  index("feedback_created_idx").on(t.createdAt),
]);
export const insertFeedbackSchema = createInsertSchema(feedback).omit({ createdAt: true }).extend({
  category: z.enum(["bug", "usability", "data", "other"]),
  message: z.string().min(5).max(2000),
  page: z.string().min(1).max(200),
});
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedback.$inferSelect;
