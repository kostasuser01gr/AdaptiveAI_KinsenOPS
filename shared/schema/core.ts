/**
 * Core domain: workspaces, users, stations, preferences, auth trails, setup.
 */
import { pgTable, text, integer, boolean, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";


// ─── WORKSPACES (Phase 4.3) ───
export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(), // e.g. "default", "acme-corp"
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  active: boolean("active").notNull().default(true),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const insertWorkspaceSchema = createInsertSchema(workspaces).omit({ createdAt: true, updatedAt: true });
export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;
export type Workspace = typeof workspaces.$inferSelect;

// ─── USERS & AUTH ───
export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  username: text("username").notNull(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("agent"),
  station: text("station"),
  language: text("language").notNull().default("en"),
  theme: text("theme").notNull().default("dark"),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until"),
}, (t) => [
  uniqueIndex("users_ws_username_idx").on(t.workspaceId, t.username),
]);
export const insertUserSchema = createInsertSchema(users);
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ─── USER PREFERENCES (personal workspace isolation) ───
export const userPreferences = pgTable("user_preferences", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  userId: integer("user_id").notNull().references(() => users.id),
  scope: text("scope").notNull().default("personal"),
  category: text("category").notNull(),
  key: text("key").notNull(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const insertUserPreferenceSchema = createInsertSchema(userPreferences).omit({ updatedAt: true });
export type InsertUserPreference = z.infer<typeof insertUserPreferenceSchema>;
export type UserPreference = typeof userPreferences.$inferSelect;

// ─── STATIONS ───
export const stations = pgTable("stations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  name: text("name").notNull(),
  code: text("code").notNull(),
  address: text("address"),
  timezone: text("timezone").notNull().default("Europe/Athens"),
  active: boolean("active").notNull().default(true),
}, (t) => [
  uniqueIndex("stations_ws_code_idx").on(t.workspaceId, t.code),
]);
export const insertStationSchema = createInsertSchema(stations);
export type InsertStation = z.infer<typeof insertStationSchema>;
export type Station = typeof stations.$inferSelect;

// ─── CUSTOM ACTIONS (Builder) ───
export const customActions = pgTable("custom_actions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  userId: integer("user_id").notNull().references(() => users.id),
  label: text("label").notNull(),
  icon: text("icon").notNull().default("Zap"),
  target: text("target").notNull(),
  placement: text("placement").notNull().default("header"),
  version: integer("version").notNull().default(1),
  active: boolean("active").notNull().default(true),
  config: jsonb("config").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("custom_actions_user_idx").on(t.userId),
  index("custom_actions_active_idx").on(t.active),
]);
export const insertCustomActionSchema = createInsertSchema(customActions).omit({ createdAt: true });
export type InsertCustomAction = z.infer<typeof insertCustomActionSchema>;
export type CustomAction = typeof customActions.$inferSelect;

// ─── SETUP STATE (pre-login onboarding wizard) ───
export const setupState = pgTable("setup_state", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  step: text("step").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("setup_state_ws_step_idx").on(t.workspaceId, t.step),
]);

// ─── LOGIN HISTORY (security audit trail for authentication events) ───
export const loginHistory = pgTable("login_history", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),
  action: text("action").notNull().default("login"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  sessionId: text("session_id"),
  success: boolean("success").notNull().default(true),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("login_history_user_idx").on(t.userId),
  index("login_history_created_idx").on(t.createdAt),
  index("login_history_action_idx").on(t.action),
]);
export const insertLoginHistorySchema = createInsertSchema(loginHistory).omit({ createdAt: true });
export type InsertLoginHistory = z.infer<typeof insertLoginHistorySchema>;
export type LoginHistory = typeof loginHistory.$inferSelect;

// ─── INVITE TOKENS (invite-only registration) ───
export const inviteTokens = pgTable("invite_tokens", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  token: text("token").notNull().unique(),
  email: text("email"),
  role: text("role").notNull().default("agent"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  usedBy: integer("used_by").references(() => users.id),
  usedAt: timestamp("used_at"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("invite_tokens_token_idx").on(t.token),
  index("invite_tokens_created_by_idx").on(t.createdBy),
]);
export const insertInviteTokenSchema = createInsertSchema(inviteTokens).omit({ createdAt: true, usedAt: true, usedBy: true });
export type InsertInviteToken = z.infer<typeof insertInviteTokenSchema>;
export type InviteToken = typeof inviteTokens.$inferSelect;
