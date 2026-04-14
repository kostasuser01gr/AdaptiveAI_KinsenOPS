/**
 * Analytics domain: KPI definitions, snapshots, anomalies, executive briefings.
 */
import { pgTable, text, integer, boolean, timestamp, jsonb, real, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspaces, users, stations } from "./core.js";

// ─── KPI DEFINITIONS ───
export const kpiDefinitions = pgTable("kpi_definitions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("operations"),
  unit: text("unit").notNull().default("count"),
  targetValue: real("target_value"),
  warningThreshold: real("warning_threshold"),
  criticalThreshold: real("critical_threshold"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("kpi_definitions_ws_slug_idx").on(t.workspaceId, t.slug),
]);
export const insertKpiDefinitionSchema = createInsertSchema(kpiDefinitions).omit({ createdAt: true });
export type InsertKpiDefinition = z.infer<typeof insertKpiDefinitionSchema>;
export type KpiDefinition = typeof kpiDefinitions.$inferSelect;

// ─── KPI SNAPSHOTS ───
export const kpiSnapshots = pgTable("kpi_snapshots", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  kpiSlug: text("kpi_slug").notNull(),
  value: real("value").notNull(),
  date: text("date").notNull(),
  stationId: integer("station_id").references(() => stations.id),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("kpi_snapshots_slug_idx").on(t.kpiSlug),
  index("kpi_snapshots_date_idx").on(t.date),
  index("kpi_snapshots_station_idx").on(t.stationId),
]);
export const insertKpiSnapshotSchema = createInsertSchema(kpiSnapshots).omit({ createdAt: true });
export type InsertKpiSnapshot = z.infer<typeof insertKpiSnapshotSchema>;
export type KpiSnapshot = typeof kpiSnapshots.$inferSelect;

// ─── ANOMALIES ───
export const anomalies = pgTable("anomalies", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  type: text("type").notNull(),
  severity: text("severity").notNull().default("warning"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  stationId: integer("station_id").references(() => stations.id),
  status: text("status").notNull().default("open"),
  detectedAt: timestamp("detected_at").notNull().defaultNow(),
  acknowledgedBy: integer("acknowledged_by").references(() => users.id),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("anomalies_type_idx").on(t.type),
  index("anomalies_status_idx").on(t.status),
  index("anomalies_detected_idx").on(t.detectedAt),
]);
export const insertAnomalySchema = createInsertSchema(anomalies).omit({ createdAt: true, detectedAt: true });
export type InsertAnomaly = z.infer<typeof insertAnomalySchema>;
export type Anomaly = typeof anomalies.$inferSelect;

// ─── EXECUTIVE BRIEFINGS ───
export const executiveBriefings = pgTable("executive_briefings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  date: text("date").notNull(),
  kpiSummary: jsonb("kpi_summary").$type<Record<string, unknown>>().notNull(),
  anomalySummary: jsonb("anomaly_summary").$type<Record<string, unknown>>(),
  recommendations: jsonb("recommendations").$type<string[]>(),
  generatedBy: text("generated_by").notNull().default("system"),
  stationId: integer("station_id").references(() => stations.id),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("exec_briefings_date_idx").on(t.date),
  index("exec_briefings_station_idx").on(t.stationId),
]);
export const insertExecutiveBriefingSchema = createInsertSchema(executiveBriefings).omit({ createdAt: true });
export type InsertExecutiveBriefing = z.infer<typeof insertExecutiveBriefingSchema>;
export type ExecutiveBriefing = typeof executiveBriefings.$inferSelect;
