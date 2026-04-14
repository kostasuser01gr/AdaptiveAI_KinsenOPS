/**
 * Integrations domain: connectors, sync jobs, knowledge docs, webhooks, webhook deliveries.
 */
import { pgTable, text, integer, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspaces, users } from "./core.js";

// ─── INTEGRATION CONNECTORS ───
export const integrationConnectors = pgTable("integration_connectors", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  name: text("name").notNull(),
  type: text("type").notNull(),
  direction: text("direction").notNull().default("inbound"),
  config: jsonb("config").$type<Record<string, unknown>>().notNull(),
  status: text("status").notNull().default("active"),
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncStatus: text("last_sync_status"),
  lastSyncMessage: text("last_sync_message"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("connectors_type_idx").on(t.type),
  index("connectors_status_idx").on(t.status),
]);
export const insertIntegrationConnectorSchema = createInsertSchema(integrationConnectors).omit({ createdAt: true, updatedAt: true, lastSyncAt: true, lastSyncStatus: true, lastSyncMessage: true });
export type InsertIntegrationConnector = z.infer<typeof insertIntegrationConnectorSchema>;
export type IntegrationConnector = typeof integrationConnectors.$inferSelect;

// ─── SYNC JOBS ───
export const syncJobs = pgTable("sync_jobs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  connectorId: integer("connector_id").notNull().references(() => integrationConnectors.id),
  status: text("status").notNull().default("pending"),
  direction: text("direction").notNull().default("inbound"),
  entityType: text("entity_type").notNull().default("reservation"),
  recordsProcessed: integer("records_processed").notNull().default(0),
  recordsFailed: integer("records_failed").notNull().default(0),
  recordsSkipped: integer("records_skipped").notNull().default(0),
  errorLog: jsonb("error_log").$type<string[]>(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  triggeredBy: integer("triggered_by").references(() => users.id),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("sync_jobs_connector_idx").on(t.connectorId),
  index("sync_jobs_status_idx").on(t.status),
  index("sync_jobs_created_idx").on(t.createdAt),
]);
export const insertSyncJobSchema = createInsertSchema(syncJobs).omit({ createdAt: true, startedAt: true, completedAt: true });
export type InsertSyncJob = z.infer<typeof insertSyncJobSchema>;
export type SyncJob = typeof syncJobs.$inferSelect;

// ─── KNOWLEDGE DOCUMENTS ───
export const knowledgeDocuments = pgTable("knowledge_documents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  title: text("title").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  storageKey: text("storage_key").notNull(),
  category: text("category").notNull().default("general"),
  tags: jsonb("tags").$type<string[]>(),
  uploadedBy: integer("uploaded_by").notNull().references(() => users.id),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("kb_docs_category_idx").on(t.category),
  index("kb_docs_uploaded_idx").on(t.uploadedBy),
]);
export const insertKnowledgeDocumentSchema = createInsertSchema(knowledgeDocuments).omit({ createdAt: true, updatedAt: true });
export type InsertKnowledgeDocument = z.infer<typeof insertKnowledgeDocumentSchema>;
export type KnowledgeDocument = typeof knowledgeDocuments.$inferSelect;

// ─── WEBHOOKS (outbound event subscriptions) ───
export const webhooks = pgTable("webhooks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  name: text("name").notNull(),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  events: jsonb("events").$type<string[]>().notNull(),
  active: boolean("active").notNull().default(true),
  retryPolicy: text("retry_policy").notNull().default("exponential"),
  maxRetries: integer("max_retries").notNull().default(3),
  createdBy: integer("created_by").notNull().references(() => users.id),
  lastDeliveredAt: timestamp("last_delivered_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("webhooks_active_idx").on(t.active),
  index("webhooks_ws_idx").on(t.workspaceId),
]);
export const insertWebhookSchema = createInsertSchema(webhooks).omit({ createdAt: true, updatedAt: true, lastDeliveredAt: true });
export type InsertWebhook = z.infer<typeof insertWebhookSchema>;
export type Webhook = typeof webhooks.$inferSelect;

// ─── WEBHOOK DELIVERIES (delivery log) ───
export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  webhookId: integer("webhook_id").notNull().references(() => webhooks.id),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  status: text("status").notNull().default("pending"),
  responseCode: integer("response_code"),
  responseBody: text("response_body"),
  attempt: integer("attempt").notNull().default(1),
  nextRetryAt: timestamp("next_retry_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("webhook_del_webhook_idx").on(t.webhookId),
  index("webhook_del_status_idx").on(t.status),
  index("webhook_del_created_idx").on(t.createdAt),
  index("webhook_del_retry_idx").on(t.nextRetryAt),
]);
export const insertWebhookDeliverySchema = createInsertSchema(webhookDeliveries).omit({ createdAt: true, deliveredAt: true, responseCode: true, responseBody: true, nextRetryAt: true });
export type InsertWebhookDelivery = z.infer<typeof insertWebhookDeliverySchema>;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
