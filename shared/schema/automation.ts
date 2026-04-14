/**
 * Automation domain: rules, executions.
 */
import { pgTable, text, integer, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspaces, users } from "./core.js";

// ─── AUTOMATION RULES ───
export const automationRules = pgTable("automation_rules", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  name: text("name").notNull(),
  description: text("description"),
  trigger: text("trigger").notNull(),
  conditions: jsonb("conditions").$type<Record<string, unknown>>(),
  actions: jsonb("actions").$type<Record<string, unknown>[]>(),
  createdBy: integer("created_by").notNull().references(() => users.id),
  scope: text("scope").notNull().default("shared"),
  active: boolean("active").notNull().default(true),
  version: integer("version").notNull().default(1),
  lastTriggered: timestamp("last_triggered"),
  triggerCount: integer("trigger_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("automation_rules_active_idx").on(t.active),
  index("automation_rules_trigger_idx").on(t.trigger),
]);
export const insertAutomationRuleSchema = createInsertSchema(automationRules).omit({ createdAt: true, lastTriggered: true, triggerCount: true });
export type InsertAutomationRule = z.infer<typeof insertAutomationRuleSchema>;
export type AutomationRule = typeof automationRules.$inferSelect;

// ─── AUTOMATION EXECUTIONS ───
export const automationExecutions = pgTable("automation_executions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  ruleId: integer("rule_id").notNull().references(() => automationRules.id),
  triggerEvent: text("trigger_event").notNull(),
  triggerEntityType: text("trigger_entity_type"),
  triggerEntityId: text("trigger_entity_id"),
  status: text("status").notNull().default("running"),
  result: jsonb("result").$type<Record<string, unknown>>(),
  error: text("error"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("automation_exec_rule_idx").on(t.ruleId),
  index("automation_exec_status_idx").on(t.status),
  index("automation_exec_created_idx").on(t.createdAt),
]);
export const insertAutomationExecutionSchema = createInsertSchema(automationExecutions).omit({ createdAt: true });
export type InsertAutomationExecution = z.infer<typeof insertAutomationExecutionSchema>;
export type AutomationExecution = typeof automationExecutions.$inferSelect;
