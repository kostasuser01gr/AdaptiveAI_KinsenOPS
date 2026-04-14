/**
 * AI domain: model usage tracking, training data, installed extensions, user API keys.
 */
import { pgTable, text, integer, boolean, timestamp, jsonb, real, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspaces, users } from "./core.js";

// ─── AI MODEL USAGE (gateway token/cost tracking) ───
export const aiModelUsage = pgTable("ai_model_usage", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  userId: integer("user_id").references(() => users.id),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  costCents: real("cost_cents"),
  latencyMs: integer("latency_ms"),
  feature: text("feature").notNull().default("chat"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("ai_usage_ws_provider_idx").on(t.workspaceId, t.provider),
  index("ai_usage_created_idx").on(t.createdAt),
  index("ai_usage_user_idx").on(t.userId),
  index("ai_usage_feature_idx").on(t.feature),
]);
export const insertAiModelUsageSchema = createInsertSchema(aiModelUsage).omit({ createdAt: true });
export type InsertAiModelUsage = z.infer<typeof insertAiModelUsageSchema>;
export type AiModelUsage = typeof aiModelUsage.$inferSelect;

// ─── AI TRAINING DATA (fusion model self-learning) ───
export const aiTrainingData = pgTable("ai_training_data", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  userId: integer("user_id").references(() => users.id),
  category: text("category").notNull(),
  input: text("input").notNull(),
  expectedOutput: text("expected_output").notNull(),
  source: text("source").notNull().default("user"),
  quality: real("quality").notNull().default(1.0),
  usedCount: integer("used_count").notNull().default(0),
  active: boolean("active").notNull().default(true),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("ai_training_category_idx").on(t.category),
  index("ai_training_ws_idx").on(t.workspaceId),
  index("ai_training_quality_idx").on(t.quality),
]);
export const insertAiTrainingDataSchema = createInsertSchema(aiTrainingData).omit({ createdAt: true, usedCount: true });
export type InsertAiTrainingData = z.infer<typeof insertAiTrainingDataSchema>;
export type AiTrainingData = typeof aiTrainingData.$inferSelect;

// ─── INSTALLED EXTENSIONS (plugin registry) ───
export const installedExtensions = pgTable("installed_extensions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  version: text("version").notNull(),
  description: text("description"),
  author: text("author"),
  manifest: jsonb("manifest").$type<Record<string, unknown>>().notNull(),
  permissions: jsonb("permissions").$type<string[]>().notNull(),
  enabled: boolean("enabled").notNull().default(true),
  config: jsonb("config").$type<Record<string, unknown>>(),
  installedBy: integer("installed_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("ext_ws_slug_idx").on(t.workspaceId, t.slug),
  index("ext_enabled_idx").on(t.enabled),
]);
export const insertInstalledExtensionSchema = createInsertSchema(installedExtensions).omit({ createdAt: true, updatedAt: true });
export type InsertInstalledExtension = z.infer<typeof insertInstalledExtensionSchema>;
export type InstalledExtension = typeof installedExtensions.$inferSelect;

// ─── USER API KEYS (bring-your-own-key per-user) ───
export const userApiKeys = pgTable("user_api_keys", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  userId: integer("user_id").notNull().references(() => users.id),
  provider: text("provider").notNull(),
  label: text("label").notNull(),
  encryptedKey: text("encrypted_key").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("user_api_keys_user_idx").on(t.userId),
  index("user_api_keys_provider_idx").on(t.provider),
]);
export const insertUserApiKeySchema = createInsertSchema(userApiKeys).omit({ createdAt: true, updatedAt: true, lastUsedAt: true, encryptedKey: true, keyPrefix: true });
export type InsertUserApiKey = z.infer<typeof insertUserApiKeySchema>;
export type UserApiKey = typeof userApiKeys.$inferSelect;
