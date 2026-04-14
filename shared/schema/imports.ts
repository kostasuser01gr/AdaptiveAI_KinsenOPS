/**
 * Imports domain: data imports, export requests, file attachments.
 */
import { pgTable, text, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspaces, users } from "./core.js";

// ─── DATA IMPORTS ───
export const imports = pgTable("imports", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  filename: text("filename").notNull(),
  status: text("status").notNull().default("uploading"),
  uploadedBy: integer("uploaded_by").notNull().references(() => users.id),
  records: integer("records").notNull().default(0),
  columns: integer("columns").notNull().default(0),
  mappings: jsonb("mappings").$type<Array<{ source: string; target: string; confidence: number }>>(),
  diffs: jsonb("diffs").$type<{ added: number; updated: number; deleted: number; conflicts: number }>(),
  rawData: jsonb("raw_data").$type<Array<Record<string, unknown>>>(),
  targetTable: text("target_table").notNull().default("vehicles"),
  appliedCount: integer("applied_count"),
  fileType: text("file_type").notNull().default("csv"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
}, (t) => [
  index("imports_status_idx").on(t.status),
  index("imports_uploaded_by_idx").on(t.uploadedBy),
  index("imports_created_idx").on(t.createdAt),
]);
export const insertImportSchema = createInsertSchema(imports).omit({ createdAt: true, completedAt: true });
export type InsertImport = z.infer<typeof insertImportSchema>;
export type Import = typeof imports.$inferSelect;

// ─── EXPORT REQUESTS ───
export const exportRequests = pgTable("export_requests", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  exportType: text("export_type").notNull(),
  format: text("format").notNull().default("csv"),
  scope: text("scope"),
  filters: jsonb("filters").$type<Record<string, unknown>>(),
  status: text("status").notNull().default("requested"),
  requestedBy: integer("requested_by").notNull().references(() => users.id),
  approvedBy: integer("approved_by").references(() => users.id),
  approvalNote: text("approval_note"),
  storageKey: text("storage_key"),
  filename: text("filename"),
  mimeType: text("mime_type"),
  rowCount: integer("row_count"),
  error: text("error"),
  expiresAt: timestamp("expires_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("export_req_status_idx").on(t.status),
  index("export_req_requested_by_idx").on(t.requestedBy),
  index("export_req_type_idx").on(t.exportType),
  index("export_req_expires_idx").on(t.expiresAt),
]);
export const insertExportRequestSchema = createInsertSchema(exportRequests).omit({ createdAt: true, updatedAt: true, completedAt: true, approvedBy: true, approvalNote: true, storageKey: true, filename: true, mimeType: true, rowCount: true, error: true, expiresAt: true });
export type InsertExportRequest = z.infer<typeof insertExportRequestSchema>;
export type ExportRequest = typeof exportRequests.$inferSelect;

// ─── FILE ATTACHMENTS ───
export const fileAttachments = pgTable("file_attachments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  url: text("url"),
  uploadedBy: integer("uploaded_by").references(() => users.id),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("file_attachments_entity_idx").on(t.entityType, t.entityId),
  index("file_attachments_created_idx").on(t.createdAt),
]);
export const insertFileAttachmentSchema = createInsertSchema(fileAttachments).omit({ createdAt: true });
export type InsertFileAttachment = z.infer<typeof insertFileAttachmentSchema>;
export type FileAttachment = typeof fileAttachments.$inferSelect;
