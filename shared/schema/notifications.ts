/**
 * Notifications domain: notifications, reads, preferences.
 */
import { pgTable, text, integer, boolean, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspaces, users, stations } from "./core.js";

// ─── NOTIFICATIONS ───
export const notifications = pgTable("notifications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  type: text("type").notNull().default("system"),
  severity: text("severity").notNull().default("info"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  read: boolean("read").notNull().default(false),
  audience: text("audience").notNull().default("broadcast"),
  recipientUserId: integer("recipient_user_id").references(() => users.id),
  recipientRole: text("recipient_role"),
  recipientStationId: integer("recipient_station_id").references(() => stations.id),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  assignedTo: integer("assigned_to").references(() => users.id),
  status: text("status").notNull().default("open"),
  sourceEntityType: text("source_entity_type"),
  sourceEntityId: text("source_entity_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("notifications_read_idx").on(t.read),
  index("notifications_created_idx").on(t.createdAt),
  index("notifications_audience_idx").on(t.audience),
  index("notifications_recipient_user_idx").on(t.recipientUserId),
  index("notifications_status_idx").on(t.status),
  index("notifications_assigned_idx").on(t.assignedTo),
]);
export const insertNotificationSchema = createInsertSchema(notifications).omit({ createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// ─── NOTIFICATION READS (per-user read tracking) ───
export const notificationReads = pgTable("notification_reads", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  notificationId: integer("notification_id").notNull().references(() => notifications.id),
  userId: integer("user_id").notNull().references(() => users.id),
  readAt: timestamp("read_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("notification_reads_uniq").on(t.notificationId, t.userId),
  index("notification_reads_user_idx").on(t.userId),
]);
export const insertNotificationReadSchema = createInsertSchema(notificationReads).omit({ readAt: true });
export type InsertNotificationRead = z.infer<typeof insertNotificationReadSchema>;
export type NotificationRead = typeof notificationReads.$inferSelect;

// ─── NOTIFICATION PREFERENCES (per-user per-category opt-in/out) ───
export const notificationPreferences = pgTable("notification_preferences", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  category: text("category").notNull(),
  inApp: boolean("in_app").notNull().default(true),
  email: boolean("email").notNull().default(false),
  push: boolean("push").notNull().default(false),
  sound: boolean("sound").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("notif_pref_user_cat_idx").on(t.userId, t.category),
  index("notif_pref_user_idx").on(t.userId),
]);
export const insertNotificationPreferenceSchema = createInsertSchema(notificationPreferences).omit({ updatedAt: true });
export type InsertNotificationPreference = z.infer<typeof insertNotificationPreferenceSchema>;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;
