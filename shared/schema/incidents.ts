/**
 * Incidents domain: incidents, summaries, repair orders.
 *
 * NOTE: vehicleId columns use plain integer() without .references() to avoid
 * a circular import with fleet.ts. The actual FK constraint is enforced by the
 * DB migration SQL; Drizzle only needs the column for queries.
 */
import { pgTable, text, integer, timestamp, jsonb, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspaces, users, stations } from "./core.js";

// ─── INCIDENTS (operational incident lifecycle) ───
export const incidents = pgTable("incidents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity").notNull().default("medium"),
  status: text("status").notNull().default("open"),
  category: text("category").notNull().default("general"),
  reportedBy: integer("reported_by").notNull().references(() => users.id),
  assignedTo: integer("assigned_to").references(() => users.id),
  vehicleId: integer("vehicle_id"),
  stationId: integer("station_id").references(() => stations.id),
  roomId: integer("room_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  resolvedAt: timestamp("resolved_at"),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("incidents_status_idx").on(t.status),
  index("incidents_severity_idx").on(t.severity),
  index("incidents_vehicle_idx").on(t.vehicleId),
  index("incidents_station_idx").on(t.stationId),
  index("incidents_assigned_idx").on(t.assignedTo),
  index("incidents_created_idx").on(t.createdAt),
]);
export const insertIncidentSchema = createInsertSchema(incidents).omit({ createdAt: true, updatedAt: true, resolvedAt: true, closedAt: true, roomId: true });
export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type Incident = typeof incidents.$inferSelect;

// ─── INCIDENT SUMMARIES ───
export const incidentSummaries = pgTable("incident_summaries", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  incidentId: integer("incident_id").notNull().references(() => incidents.id),
  summary: text("summary").notNull(),
  dataSourcesUsed: jsonb("data_sources_used").$type<string[]>().notNull(),
  kpiImpact: jsonb("kpi_impact").$type<Record<string, unknown>>(),
  generatedBy: text("generated_by").notNull().default("system"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("incident_summaries_incident_idx").on(t.incidentId),
]);
export const insertIncidentSummarySchema = createInsertSchema(incidentSummaries).omit({ createdAt: true });
export type InsertIncidentSummary = z.infer<typeof insertIncidentSummarySchema>;
export type IncidentSummary = typeof incidentSummaries.$inferSelect;

// ─── REPAIR ORDERS ───
export const repairOrders = pgTable("repair_orders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  vehicleId: integer("vehicle_id").notNull(),
  incidentId: integer("incident_id").references(() => incidents.id),
  stationId: integer("station_id").references(() => stations.id),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("open"),
  priority: text("priority").notNull().default("normal"),
  assignedTo: integer("assigned_to").references(() => users.id),
  estimatedCost: real("estimated_cost"),
  actualCost: real("actual_cost"),
  estimatedCompletion: timestamp("estimated_completion"),
  completedAt: timestamp("completed_at"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("repair_orders_vehicle_idx").on(t.vehicleId),
  index("repair_orders_incident_idx").on(t.incidentId),
  index("repair_orders_status_idx").on(t.status),
  index("repair_orders_station_idx").on(t.stationId),
]);
export const insertRepairOrderSchema = createInsertSchema(repairOrders).omit({ createdAt: true, updatedAt: true, completedAt: true, actualCost: true });
export type InsertRepairOrder = z.infer<typeof insertRepairOrderSchema>;
export type RepairOrder = typeof repairOrders.$inferSelect;
