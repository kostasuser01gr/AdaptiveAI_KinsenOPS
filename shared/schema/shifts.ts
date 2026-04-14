/**
 * Shifts domain: shift scheduling, requests, reviews.
 */
import { pgTable, text, integer, timestamp, jsonb, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspaces, users, stations } from "./core.js";

// ─── SHIFTS ───
export const shifts = pgTable("shifts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  employeeName: text("employee_name").notNull(),
  employeeRole: text("employee_role").notNull(),
  weekStart: text("week_start").notNull(),
  schedule: jsonb("schedule").notNull().$type<string[]>(),
  status: text("status").notNull().default("draft"),
  stationId: integer("station_id").references(() => stations.id),
  fairnessScore: real("fairness_score"),
  fatigueScore: real("fatigue_score"),
  publishedBy: integer("published_by").references(() => users.id),
  publishedAt: timestamp("published_at"),
}, (t) => [
  index("shifts_week_idx").on(t.weekStart),
  index("shifts_status_idx").on(t.status),
]);
export const insertShiftSchema = createInsertSchema(shifts).omit({ publishedBy: true, publishedAt: true });
export type InsertShift = z.infer<typeof insertShiftSchema>;
export type Shift = typeof shifts.$inferSelect;

// ─── SHIFT REQUESTS ───
export const shiftRequests = pgTable("shift_requests", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  userId: integer("user_id").notNull().references(() => users.id),
  shiftId: integer("shift_id").references(() => shifts.id),
  requestType: text("request_type").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>(),
  status: text("status").notNull().default("pending"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
}, (t) => [
  index("shift_requests_user_idx").on(t.userId),
  index("shift_requests_shift_idx").on(t.shiftId),
  index("shift_requests_status_idx").on(t.status),
]);
export const insertShiftRequestSchema = createInsertSchema(shiftRequests).omit({ createdAt: true, reviewedBy: true, reviewedAt: true, reviewNote: true });
export type InsertShiftRequest = z.infer<typeof insertShiftRequestSchema>;
export type ShiftRequest = typeof shiftRequests.$inferSelect;
