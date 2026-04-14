/**
 * Workshop domain: external workshop job linkage.
 */
import { pgTable, text, integer, timestamp, jsonb, real, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspaces } from "./core.js";
import { repairOrders } from "./incidents.js";
import { integrationConnectors } from "./integrations.js";

// ─── WORKSHOP JOBS ───
export const workshopJobs = pgTable("workshop_jobs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  repairOrderId: integer("repair_order_id").references(() => repairOrders.id),
  connectorId: integer("connector_id").references(() => integrationConnectors.id),
  externalJobId: text("external_job_id"),
  workshopName: text("workshop_name").notNull(),
  externalStatus: text("external_status"),
  normalizedStatus: text("normalized_status").notNull().default("pending"),
  estimateAmount: real("estimate_amount"),
  invoiceRef: text("invoice_ref"),
  notes: text("notes"),
  metadata: jsonb("metadata"),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("wj_repair_order_idx").on(t.repairOrderId),
  index("wj_connector_idx").on(t.connectorId),
  uniqueIndex("wj_external_dedup_idx").on(t.connectorId, t.externalJobId),
  index("wj_normalized_status_idx").on(t.normalizedStatus),
]);
export const insertWorkshopJobSchema = createInsertSchema(workshopJobs).omit({ createdAt: true, updatedAt: true, lastSyncAt: true });
export type InsertWorkshopJob = z.infer<typeof insertWorkshopJobSchema>;
export type WorkshopJob = typeof workshopJobs.$inferSelect;
