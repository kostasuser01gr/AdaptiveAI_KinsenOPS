import { pgTable, text, integer, boolean, timestamp, jsonb, real, index, uniqueIndex } from "drizzle-orm/pg-core";
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
  workspaceId: text("workspace_id").notNull().default("default"),
  username: text("username").notNull(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("agent"),
  station: text("station"),
  language: text("language").notNull().default("en"),
  theme: text("theme").notNull().default("dark"),
}, (t) => [
  uniqueIndex("users_ws_username_idx").on(t.workspaceId, t.username),
]);
export const insertUserSchema = createInsertSchema(users);
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ─── USER PREFERENCES (personal workspace isolation) ───
export const userPreferences = pgTable("user_preferences", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  userId: integer("user_id").notNull(),
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
  workspaceId: text("workspace_id").notNull().default("default"),
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

// ─── CHAT ───
export const chatConversations = pgTable("chat_conversations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  userId: integer("user_id").notNull(),
  title: text("title").notNull().default("New Chat"),
  pinned: boolean("pinned").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertConversationSchema = createInsertSchema(chatConversations).omit({ createdAt: true });
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type ChatConversation = typeof chatConversations.$inferSelect;

export const chatMessages = pgTable("chat_messages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  conversationId: integer("conversation_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("messages_conv_idx").on(t.conversationId),
]);
export const insertMessageSchema = createInsertSchema(chatMessages).omit({ createdAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

// ─── VEHICLES ───
export const vehicles = pgTable("vehicles", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  plate: text("plate").notNull(),
  model: text("model").notNull(),
  category: text("category").notNull().default("B"),
  stationId: integer("station_id"),
  status: text("status").notNull().default("ready"),
  sla: text("sla").notNull().default("normal"),
  mileage: integer("mileage"),
  fuelLevel: integer("fuel_level"),
  nextBooking: text("next_booking"),
  timerInfo: text("timer_info"),
  deletedAt: timestamp("deleted_at"),
}, (t) => [
  index("vehicles_status_idx").on(t.status, t.deletedAt),
  index("vehicles_station_idx").on(t.stationId),
  uniqueIndex("vehicles_ws_plate_idx").on(t.workspaceId, t.plate),
]);
export const insertVehicleSchema = createInsertSchema(vehicles).omit({ deletedAt: true });
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehicles.$inferSelect;

// ─── VEHICLE EVIDENCE (photos, notes, damage) ───
export const vehicleEvidence = pgTable("vehicle_evidence", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  vehicleId: integer("vehicle_id"),
  type: text("type").notNull(),
  url: text("url"),
  caption: text("caption"),
  severity: text("severity"),
  source: text("source").notNull().default("staff"),
  reservationId: text("reservation_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertVehicleEvidenceSchema = createInsertSchema(vehicleEvidence).omit({ createdAt: true });
export type InsertVehicleEvidence = z.infer<typeof insertVehicleEvidenceSchema>;
export type VehicleEvidence = typeof vehicleEvidence.$inferSelect;

// ─── WASH QUEUE ───
export const washQueue = pgTable("wash_queue", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  vehiclePlate: text("vehicle_plate").notNull(),
  washType: text("wash_type").notNull().default("Quick Wash"),
  priority: text("priority").notNull().default("Normal"),
  assignedTo: text("assigned_to"),
  status: text("status").notNull().default("pending"),
  slaInfo: text("sla_info"),
  stationId: integer("station_id"),
  proofPhotoUrl: text("proof_photo_url"),
  slaDeadline: timestamp("sla_deadline"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});
export const insertWashQueueSchema = createInsertSchema(washQueue).omit({ createdAt: true, completedAt: true, slaDeadline: true });
export type InsertWashQueue = z.infer<typeof insertWashQueueSchema>;
export type WashQueueItem = typeof washQueue.$inferSelect;

// ─── SHIFTS ───
export const shifts = pgTable("shifts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  employeeName: text("employee_name").notNull(),
  employeeRole: text("employee_role").notNull(),
  weekStart: text("week_start").notNull(),
  schedule: jsonb("schedule").notNull().$type<string[]>(),
  status: text("status").notNull().default("draft"),
  stationId: integer("station_id"),
  fairnessScore: real("fairness_score"),
  fatigueScore: real("fatigue_score"),
  publishedBy: integer("published_by"),
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
  workspaceId: text("workspace_id").notNull().default("default"),
  userId: integer("user_id").notNull(),
  shiftId: integer("shift_id"),
  requestType: text("request_type").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>(),
  status: text("status").notNull().default("pending"),
  reviewedBy: integer("reviewed_by"),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});
export const insertShiftRequestSchema = createInsertSchema(shiftRequests).omit({ createdAt: true, reviewedBy: true, reviewedAt: true, reviewNote: true });
export type InsertShiftRequest = z.infer<typeof insertShiftRequestSchema>;
export type ShiftRequest = typeof shiftRequests.$inferSelect;

// ─── NOTIFICATIONS ───
export const notifications = pgTable("notifications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  type: text("type").notNull().default("system"),
  severity: text("severity").notNull().default("info"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  read: boolean("read").notNull().default(false),
  audience: text("audience").notNull().default("broadcast"),
  recipientUserId: integer("recipient_user_id"),
  recipientRole: text("recipient_role"),
  recipientStationId: integer("recipient_station_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  assignedTo: integer("assigned_to"),
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
  notificationId: integer("notification_id").notNull(),
  userId: integer("user_id").notNull(),
  readAt: timestamp("read_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("notification_reads_uniq").on(t.notificationId, t.userId),
  index("notification_reads_user_idx").on(t.userId),
]);
export const insertNotificationReadSchema = createInsertSchema(notificationReads).omit({ readAt: true });
export type InsertNotificationRead = z.infer<typeof insertNotificationReadSchema>;
export type NotificationRead = typeof notificationReads.$inferSelect;

// ─── CUSTOM ACTIONS (Builder) ───
export const customActions = pgTable("custom_actions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  userId: integer("user_id").notNull(),
  label: text("label").notNull(),
  icon: text("icon").notNull().default("Zap"),
  target: text("target").notNull(),
  placement: text("placement").notNull().default("header"),
  version: integer("version").notNull().default(1),
  active: boolean("active").notNull().default(true),
  config: jsonb("config").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertCustomActionSchema = createInsertSchema(customActions).omit({ createdAt: true });
export type InsertCustomAction = z.infer<typeof insertCustomActionSchema>;
export type CustomAction = typeof customActions.$inferSelect;

// ─── AUTOMATION RULES ───
export const automationRules = pgTable("automation_rules", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  name: text("name").notNull(),
  description: text("description"),
  trigger: text("trigger").notNull(),
  conditions: jsonb("conditions").$type<Record<string, unknown>>(),
  actions: jsonb("actions").$type<Record<string, unknown>[]>(),
  createdBy: integer("created_by").notNull(),
  scope: text("scope").notNull().default("shared"),
  active: boolean("active").notNull().default(true),
  version: integer("version").notNull().default(1),
  lastTriggered: timestamp("last_triggered"),
  triggerCount: integer("trigger_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertAutomationRuleSchema = createInsertSchema(automationRules).omit({ createdAt: true, lastTriggered: true, triggerCount: true });
export type InsertAutomationRule = z.infer<typeof insertAutomationRuleSchema>;
export type AutomationRule = typeof automationRules.$inferSelect;

// ─── AUDIT LOG ───
export const auditLog = pgTable("audit_log", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  userId: integer("user_id"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  details: jsonb("details").$type<Record<string, unknown>>(),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("audit_log_created_idx").on(t.createdAt),
  index("audit_log_user_idx").on(t.userId),
]);
export const insertAuditLogSchema = createInsertSchema(auditLog).omit({ createdAt: true });
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLog.$inferSelect;

// ─── ENTITY ROOMS (collaboration) ───
export const entityRooms = pgTable("entity_rooms", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("open"),
  priority: text("priority").notNull().default("normal"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertEntityRoomSchema = createInsertSchema(entityRooms).omit({ createdAt: true });
export type InsertEntityRoom = z.infer<typeof insertEntityRoomSchema>;
export type EntityRoom = typeof entityRooms.$inferSelect;

export const roomMessages = pgTable("room_messages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  roomId: integer("room_id").notNull(),
  userId: integer("user_id"),
  role: text("role").notNull().default("user"),
  content: text("content").notNull(),
  type: text("type").notNull().default("message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertRoomMessageSchema = createInsertSchema(roomMessages).omit({ createdAt: true });
export type InsertRoomMessage = z.infer<typeof insertRoomMessageSchema>;
export type RoomMessage = typeof roomMessages.$inferSelect;

// ─── WORKSPACE MEMORY (AI organizational learning) ───
export const workspaceMemory = pgTable("workspace_memory", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  category: text("category").notNull(),
  key: text("key").notNull(),
  value: text("value").notNull(),
  source: text("source").notNull().default("system"),
  confidence: real("confidence").notNull().default(1.0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const insertWorkspaceMemorySchema = createInsertSchema(workspaceMemory).omit({ createdAt: true, updatedAt: true });
export type InsertWorkspaceMemory = z.infer<typeof insertWorkspaceMemorySchema>;
export type WorkspaceMemory = typeof workspaceMemory.$inferSelect;

// ─── DIGITAL TWIN SNAPSHOTS ───
export const digitalTwinSnapshots = pgTable("digital_twin_snapshots", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  stationId: integer("station_id"),
  snapshotType: text("snapshot_type").notNull().default("hourly"),
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertDigitalTwinSnapshotSchema = createInsertSchema(digitalTwinSnapshots).omit({ createdAt: true });
export type InsertDigitalTwinSnapshot = z.infer<typeof insertDigitalTwinSnapshotSchema>;
export type DigitalTwinSnapshot = typeof digitalTwinSnapshots.$inferSelect;

// ─── SYSTEM POLICIES (governance engine) ───
export const systemPolicies = pgTable("system_policies", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  name: text("name").notNull(),
  category: text("category").notNull(),
  rule: jsonb("rule").$type<Record<string, unknown>>().notNull(),
  enforcement: text("enforcement").notNull().default("warn"),
  scope: text("scope").notNull().default("global"),
  active: boolean("active").notNull().default(true),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const insertSystemPolicySchema = createInsertSchema(systemPolicies).omit({ createdAt: true, updatedAt: true });
export type InsertSystemPolicy = z.infer<typeof insertSystemPolicySchema>;
export type SystemPolicy = typeof systemPolicies.$inferSelect;

// ─── ACTIVITY FEED (realtime event distribution) ───
export const activityFeed = pgTable("activity_feed", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  userId: integer("user_id"),
  actorName: text("actor_name").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  entityLabel: text("entity_label"),
  stationId: integer("station_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertActivityFeedSchema = createInsertSchema(activityFeed).omit({ createdAt: true });
export type InsertActivityFeed = z.infer<typeof insertActivityFeedSchema>;
export type ActivityFeedEntry = typeof activityFeed.$inferSelect;

// ─── MODULE REGISTRY (plug-and-unplug architecture) ───
export const moduleRegistry = pgTable("module_registry", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("operations"),
  icon: text("icon").notNull().default("Box"),
  route: text("route").notNull(),
  requiredRole: text("required_role").notNull().default("agent"),
  enabled: boolean("enabled").notNull().default(true),
  order: integer("order").notNull().default(0),
  config: jsonb("config").$type<Record<string, unknown>>(),
}, (t) => [
  uniqueIndex("module_registry_ws_slug_idx").on(t.workspaceId, t.slug),
]);
export const insertModuleRegistrySchema = createInsertSchema(moduleRegistry);
export type InsertModuleRegistry = z.infer<typeof insertModuleRegistrySchema>;
export type ModuleRegistryEntry = typeof moduleRegistry.$inferSelect;

// ─── WORKSPACE CONFIG (tenant-level configuration) ───
export const workspaceConfig = pgTable("workspace_config", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  key: text("key").notNull(),
  value: jsonb("value").$type<unknown>().notNull(),
  category: text("category").notNull().default("general"),
  description: text("description"),
  updatedBy: integer("updated_by"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("workspace_config_ws_key_idx").on(t.workspaceId, t.key),
]);
export const insertWorkspaceConfigSchema = createInsertSchema(workspaceConfig).omit({ updatedAt: true });
export type InsertWorkspaceConfig = z.infer<typeof insertWorkspaceConfigSchema>;
export type WorkspaceConfigEntry = typeof workspaceConfig.$inferSelect;

// ─── WORKSPACE PROPOSALS (adaptive workspace review pipeline) ───
export const workspaceProposals = pgTable("workspace_proposals", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(), // 'button' | 'view' | 'workflow' | 'config' | 'macro'
  label: text("label").notNull(),
  description: text("description"),
  impact: text("impact").notNull().default("low"), // 'low' | 'medium' | 'high'
  scope: text("scope").notNull().default("personal"), // 'personal' | 'shared'
  status: text("status").notNull().default("proposed"), // 'proposed' | 'approved' | 'rejected' | 'applied' | 'reverted'
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(), // the actual change data
  previousValue: jsonb("previous_value").$type<Record<string, unknown>>(), // for revert
  reviewedBy: integer("reviewed_by"),
  reviewNote: text("review_note"),
  appliedAt: timestamp("applied_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("proposals_user_idx").on(t.userId),
  index("proposals_status_idx").on(t.status),
]);
export const insertWorkspaceProposalSchema = createInsertSchema(workspaceProposals).omit({ createdAt: true, updatedAt: true, reviewedBy: true, reviewNote: true, appliedAt: true, previousValue: true });
export type InsertWorkspaceProposal = z.infer<typeof insertWorkspaceProposalSchema>;
export type WorkspaceProposal = typeof workspaceProposals.$inferSelect;

// ─── DATA IMPORTS (import job pipeline) ───
export const imports = pgTable("imports", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  filename: text("filename").notNull(),
  status: text("status").notNull().default("uploading"),
  uploadedBy: integer("uploaded_by").notNull(),
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
});
export const insertImportSchema = createInsertSchema(imports).omit({ createdAt: true, completedAt: true });
export type InsertImport = z.infer<typeof insertImportSchema>;
export type Import = typeof imports.$inferSelect;

// ─── FILE ATTACHMENTS (evidence & file pipeline) ───
export const fileAttachments = pgTable("file_attachments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  url: text("url"),
  uploadedBy: integer("uploaded_by"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertFileAttachmentSchema = createInsertSchema(fileAttachments).omit({ createdAt: true });
export type InsertFileAttachment = z.infer<typeof insertFileAttachmentSchema>;
export type FileAttachment = typeof fileAttachments.$inferSelect;

// ─── IN-APP FEEDBACK (week-1 stabilization) ───
export const feedback = pgTable("feedback", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  userId: integer("user_id"),
  role: text("role"),
  page: text("page").notNull(),
  category: text("category").notNull(),
  message: text("message").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertFeedbackSchema = createInsertSchema(feedback).omit({ createdAt: true }).extend({
  category: z.enum(["bug", "usability", "data", "other"]),
  message: z.string().min(5).max(2000),
  page: z.string().min(1).max(200),
});
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedback.$inferSelect;

// ─── INCIDENTS (operational incident lifecycle) ───
export const incidents = pgTable("incidents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity").notNull().default("medium"), // low | medium | high | critical
  status: text("status").notNull().default("open"), // open | investigating | mitigating | resolved | closed
  category: text("category").notNull().default("general"), // general | vehicle_damage | customer_complaint | equipment_failure | safety | sla_breach
  reportedBy: integer("reported_by").notNull(),
  assignedTo: integer("assigned_to"),
  vehicleId: integer("vehicle_id"),
  stationId: integer("station_id"),
  roomId: integer("room_id"), // linked War Room
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

// ─── AUTOMATION EXECUTIONS (execution log for automation rules) ───
export const automationExecutions = pgTable("automation_executions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  ruleId: integer("rule_id").notNull(),
  triggerEvent: text("trigger_event").notNull(),
  triggerEntityType: text("trigger_entity_type"),
  triggerEntityId: text("trigger_entity_id"),
  status: text("status").notNull().default("running"), // running | success | failure | skipped
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

// ─── RESERVATIONS (Phase 2) ───
export const reservations = pgTable("reservations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  vehicleId: integer("vehicle_id"),
  stationId: integer("station_id"),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  status: text("status").notNull().default("confirmed"), // confirmed | checked_out | returned | cancelled | no_show
  source: text("source").notNull().default("manual"), // manual | import | api | website
  pickupDate: timestamp("pickup_date").notNull(),
  returnDate: timestamp("return_date").notNull(),
  actualPickup: timestamp("actual_pickup"),
  actualReturn: timestamp("actual_return"),
  notes: text("notes"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("reservations_vehicle_idx").on(t.vehicleId),
  index("reservations_station_idx").on(t.stationId),
  index("reservations_status_idx").on(t.status),
  index("reservations_pickup_idx").on(t.pickupDate),
  index("reservations_return_idx").on(t.returnDate),
]);
export const insertReservationSchema = createInsertSchema(reservations).omit({ createdAt: true, updatedAt: true, actualPickup: true, actualReturn: true });
export type InsertReservation = z.infer<typeof insertReservationSchema>;
export type Reservation = typeof reservations.$inferSelect;

// ─── REPAIR ORDERS (Phase 2) ───
export const repairOrders = pgTable("repair_orders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  vehicleId: integer("vehicle_id").notNull(),
  incidentId: integer("incident_id"),
  stationId: integer("station_id"),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("open"), // open | in_progress | awaiting_parts | completed | cancelled
  priority: text("priority").notNull().default("normal"), // low | normal | high | urgent
  assignedTo: integer("assigned_to"),
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

// ─── DOWNTIME EVENTS (Phase 2) ───
export const downtimeEvents = pgTable("downtime_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  vehicleId: integer("vehicle_id").notNull(),
  reason: text("reason").notNull(), // maintenance | repair | incident | reservation_gap | other
  incidentId: integer("incident_id"),
  repairOrderId: integer("repair_order_id"),
  stationId: integer("station_id"),
  startedAt: timestamp("started_at").notNull(),
  endedAt: timestamp("ended_at"),
  notes: text("notes"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("downtime_vehicle_idx").on(t.vehicleId),
  index("downtime_reason_idx").on(t.reason),
  index("downtime_started_idx").on(t.startedAt),
]);
export const insertDowntimeEventSchema = createInsertSchema(downtimeEvents).omit({ createdAt: true });
export type InsertDowntimeEvent = z.infer<typeof insertDowntimeEventSchema>;
export type DowntimeEvent = typeof downtimeEvents.$inferSelect;

// ─── KPI DEFINITIONS (Phase 2) ───
export const kpiDefinitions = pgTable("kpi_definitions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("operations"), // operations | fleet | quality | finance
  unit: text("unit").notNull().default("count"), // count | percent | minutes | currency
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

// ─── KPI SNAPSHOTS (Phase 2) ───
export const kpiSnapshots = pgTable("kpi_snapshots", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  kpiSlug: text("kpi_slug").notNull(),
  value: real("value").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  stationId: integer("station_id"),
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

// ─── ANOMALIES (Phase 2) ───
export const anomalies = pgTable("anomalies", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  type: text("type").notNull(), // wash_stagnation | repeated_damage | notification_spike | sla_pattern | fleet_idle
  severity: text("severity").notNull().default("warning"), // info | warning | critical
  title: text("title").notNull(),
  description: text("description").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  stationId: integer("station_id"),
  status: text("status").notNull().default("open"), // open | acknowledged | resolved | dismissed
  detectedAt: timestamp("detected_at").notNull().defaultNow(),
  acknowledgedBy: integer("acknowledged_by"),
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

// ─── EXECUTIVE BRIEFINGS (Phase 2) ───
export const executiveBriefings = pgTable("executive_briefings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  kpiSummary: jsonb("kpi_summary").$type<Record<string, unknown>>().notNull(),
  anomalySummary: jsonb("anomaly_summary").$type<Record<string, unknown>>(),
  recommendations: jsonb("recommendations").$type<string[]>(),
  generatedBy: text("generated_by").notNull().default("system"), // system | ai
  stationId: integer("station_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertExecutiveBriefingSchema = createInsertSchema(executiveBriefings).omit({ createdAt: true });
export type InsertExecutiveBriefing = z.infer<typeof insertExecutiveBriefingSchema>;
export type ExecutiveBriefing = typeof executiveBriefings.$inferSelect;

// ═══════════════════════════════════════════════════════════
// PHASE 3 TABLES
// ═══════════════════════════════════════════════════════════

// ─── INTEGRATION CONNECTORS (Phase 3) ───
export const integrationConnectors = pgTable("integration_connectors", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  name: text("name").notNull(),
  type: text("type").notNull(), // pms | webhook | api | csv_import
  direction: text("direction").notNull().default("inbound"), // inbound | outbound | bidirectional
  config: jsonb("config").$type<Record<string, unknown>>().notNull(),
  status: text("status").notNull().default("active"), // active | paused | error | disabled
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncStatus: text("last_sync_status"), // success | partial | failed
  lastSyncMessage: text("last_sync_message"),
  createdBy: integer("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("connectors_type_idx").on(t.type),
  index("connectors_status_idx").on(t.status),
]);
export const insertIntegrationConnectorSchema = createInsertSchema(integrationConnectors).omit({ createdAt: true, updatedAt: true, lastSyncAt: true, lastSyncStatus: true, lastSyncMessage: true });
export type InsertIntegrationConnector = z.infer<typeof insertIntegrationConnectorSchema>;
export type IntegrationConnector = typeof integrationConnectors.$inferSelect;

// ─── SYNC JOBS (Phase 3) ───
export const syncJobs = pgTable("sync_jobs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  connectorId: integer("connector_id").notNull(),
  status: text("status").notNull().default("pending"), // pending | running | success | failed | partial
  direction: text("direction").notNull().default("inbound"),
  entityType: text("entity_type").notNull().default("reservation"),
  recordsProcessed: integer("records_processed").notNull().default(0),
  recordsFailed: integer("records_failed").notNull().default(0),
  recordsSkipped: integer("records_skipped").notNull().default(0),
  errorLog: jsonb("error_log").$type<string[]>(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  triggeredBy: integer("triggered_by"),
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

// ─── KNOWLEDGE DOCUMENTS (Phase 3) ───
export const knowledgeDocuments = pgTable("knowledge_documents", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  title: text("title").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  storageKey: text("storage_key").notNull(),
  category: text("category").notNull().default("general"), // sop | manual | policy | spec | other | general
  tags: jsonb("tags").$type<string[]>(),
  uploadedBy: integer("uploaded_by").notNull(),
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

// ─── INCIDENT SUMMARIES (Phase 3) ───
export const incidentSummaries = pgTable("incident_summaries", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  incidentId: integer("incident_id").notNull(),
  summary: text("summary").notNull(),
  dataSourcesUsed: jsonb("data_sources_used").$type<string[]>().notNull(),
  kpiImpact: jsonb("kpi_impact").$type<Record<string, unknown>>(),
  generatedBy: text("generated_by").notNull().default("system"), // system | user
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("incident_summaries_incident_idx").on(t.incidentId),
]);
export const insertIncidentSummarySchema = createInsertSchema(incidentSummaries).omit({ createdAt: true });
export type InsertIncidentSummary = z.infer<typeof insertIncidentSummarySchema>;
export type IncidentSummary = typeof incidentSummaries.$inferSelect;

// ─── EXPORT REQUESTS (Phase 4.1A) ───
export const exportRequests = pgTable("export_requests", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  exportType: text("export_type").notNull(), // audit_log | incidents | reservations | repair_orders | downtime_events | kpi_snapshots | executive_summaries | vehicles
  format: text("format").notNull().default("csv"), // csv | json
  scope: text("scope"), // e.g. station id, date range label
  filters: jsonb("filters").$type<Record<string, unknown>>(),
  status: text("status").notNull().default("requested"), // requested | pending_approval | approved | rejected | processing | completed | failed | expired
  requestedBy: integer("requested_by").notNull(),
  approvedBy: integer("approved_by"),
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

// ─── WORKSPACE PLANS & ENTITLEMENTS (Phase 4.1B) ───
export const workspacePlans = pgTable("workspace_plans", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().unique().default("default"),
  plan: text("plan").notNull().default("core"), // core | ops_plus | intelligence | enterprise
  label: text("label"),
  activatedAt: timestamp("activated_at").notNull().defaultNow(),
  activatedBy: integer("activated_by"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const insertWorkspacePlanSchema = createInsertSchema(workspacePlans).omit({ activatedAt: true, updatedAt: true });
export type InsertWorkspacePlan = z.infer<typeof insertWorkspacePlanSchema>;
export type WorkspacePlan = typeof workspacePlans.$inferSelect;

export const entitlementOverrides = pgTable("entitlement_overrides", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  feature: text("feature").notNull(),
  enabled: boolean("enabled").notNull(),
  reason: text("reason"),
  updatedBy: integer("updated_by"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("ent_override_ws_feature_idx").on(t.workspaceId, t.feature),
]);
export const insertEntitlementOverrideSchema = createInsertSchema(entitlementOverrides).omit({ updatedAt: true });
export type InsertEntitlementOverride = z.infer<typeof insertEntitlementOverrideSchema>;
export type EntitlementOverride = typeof entitlementOverrides.$inferSelect;

// ─── USAGE METERING (Phase 4.2A) ───

/** Append-only raw usage events — one row per billable/metered action. */
export const usageEvents = pgTable("usage_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  feature: text("feature").notNull(), // FeatureKey
  userId: integer("user_id"),
  action: text("action").notNull(), // e.g. "export_created", "briefing_generated"
  entityType: text("entity_type"), // optional context: "export_request", "automation_rule", etc.
  entityId: text("entity_id"), // optional reference
  idempotencyKey: text("idempotency_key"), // prevents double-counting
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("usage_evt_ws_feature_idx").on(t.workspaceId, t.feature),
  index("usage_evt_created_idx").on(t.createdAt),
  index("usage_evt_user_idx").on(t.userId),
  uniqueIndex("usage_evt_idempotency_idx").on(t.idempotencyKey),
]);
export const insertUsageEventSchema = createInsertSchema(usageEvents).omit({ createdAt: true });
export type InsertUsageEvent = z.infer<typeof insertUsageEventSchema>;
export type UsageEvent = typeof usageEvents.$inferSelect;

/** Daily rollup of usage per workspace per feature — materialized for fast reporting. */
export const usageDailyRollups = pgTable("usage_daily_rollups", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  feature: text("feature").notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  count: integer("count").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("usage_rollup_ws_feature_date_idx").on(t.workspaceId, t.feature, t.date),
  index("usage_rollup_date_idx").on(t.date),
]);
export const insertUsageDailyRollupSchema = createInsertSchema(usageDailyRollups).omit({ updatedAt: true });
export type InsertUsageDailyRollup = z.infer<typeof insertUsageDailyRollupSchema>;
export type UsageDailyRollup = typeof usageDailyRollups.$inferSelect;

// ─── USER STATION ASSIGNMENTS (Phase 4.2A) ───

/** Multi-station assignment — allows a user to operate at multiple stations. */
export const userStationAssignments = pgTable("user_station_assignments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  userId: integer("user_id").notNull(),
  stationId: integer("station_id").notNull(),
  isPrimary: boolean("is_primary").notNull().default(false),
  assignedBy: integer("assigned_by"),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("user_station_assign_idx").on(t.userId, t.stationId),
  index("user_station_user_idx").on(t.userId),
  index("user_station_station_idx").on(t.stationId),
]);
export const insertUserStationAssignmentSchema = createInsertSchema(userStationAssignments).omit({ assignedAt: true });
export type InsertUserStationAssignment = z.infer<typeof insertUserStationAssignmentSchema>;
export type UserStationAssignment = typeof userStationAssignments.$inferSelect;

// ─── CAPABILITY PERMISSIONS (Phase 4.2A) ───

/** Per-role default capabilities — maps role → set of capability slugs. */
export const roleCapabilities = pgTable("role_capabilities", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  role: text("role").notNull(),
  capability: text("capability").notNull(),
  granted: boolean("granted").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("role_cap_role_cap_idx").on(t.role, t.capability),
]);
export const insertRoleCapabilitySchema = createInsertSchema(roleCapabilities).omit({ updatedAt: true });
export type InsertRoleCapability = z.infer<typeof insertRoleCapabilitySchema>;
export type RoleCapability = typeof roleCapabilities.$inferSelect;

/** Per-user capability overrides — sparse, layered on top of role defaults. */
export const userCapabilityOverrides = pgTable("user_capability_overrides", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  userId: integer("user_id").notNull(),
  capability: text("capability").notNull(),
  granted: boolean("granted").notNull(),
  reason: text("reason"),
  grantedBy: integer("granted_by"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("user_cap_user_cap_idx").on(t.userId, t.capability),
  index("user_cap_user_idx").on(t.userId),
]);
export const insertUserCapabilityOverrideSchema = createInsertSchema(userCapabilityOverrides).omit({ updatedAt: true });
export type InsertUserCapabilityOverride = z.infer<typeof insertUserCapabilityOverrideSchema>;
export type UserCapabilityOverride = typeof userCapabilityOverrides.$inferSelect;

// ─── VEHICLE EVENTS (Phase 4.2B) ───

/** Append-only normalized vehicle event log — telematics, alerts, fleet signals. */
export const vehicleEvents = pgTable("vehicle_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  vehicleId: integer("vehicle_id").notNull(),
  connectorId: integer("connector_id"),
  source: text("source").notNull().default("manual"),
  externalEventId: text("external_event_id"),
  eventType: text("event_type").notNull(),
  severity: text("severity").notNull().default("info"),
  occurredAt: timestamp("occurred_at").notNull(),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  payload: jsonb("payload"),
  processed: boolean("processed").notNull().default(false),
  processedAt: timestamp("processed_at"),
  derivedAction: text("derived_action"),
  derivedEntityType: text("derived_entity_type"),
  derivedEntityId: text("derived_entity_id"),
}, (t) => [
  index("ve_vehicle_time_idx").on(t.vehicleId, t.occurredAt),
  index("ve_vehicle_type_idx").on(t.vehicleId, t.eventType),
  index("ve_type_idx").on(t.eventType),
  index("ve_connector_idx").on(t.connectorId),
  index("ve_received_idx").on(t.receivedAt),
  uniqueIndex("ve_external_dedup_idx").on(t.workspaceId, t.source, t.externalEventId),
]);
export const insertVehicleEventSchema = createInsertSchema(vehicleEvents).omit({
  receivedAt: true, processed: true, processedAt: true, derivedAction: true, derivedEntityType: true, derivedEntityId: true,
});
export type InsertVehicleEvent = z.infer<typeof insertVehicleEventSchema>;
export type VehicleEvent = typeof vehicleEvents.$inferSelect;

// ─── WORKSHOP JOBS (Phase 4.2B) ───

/** External workshop job linkage — bridges repair orders to external workshop systems. */
export const workshopJobs = pgTable("workshop_jobs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  repairOrderId: integer("repair_order_id"),
  connectorId: integer("connector_id"),
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

// ═══════════════════════════════════════════════════════════
// PHASE 5 TABLES — Fleet Positions, Transfers, Channels, App Graph, Extensions
// ═══════════════════════════════════════════════════════════

// ─── STATION POSITIONS (Fleet expansion — typed parking/staging positions) ───
export const stationPositions = pgTable("station_positions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  stationId: integer("station_id").notNull(),
  code: text("code").notNull(),
  label: text("label").notNull(),
  type: text("type").notNull().default("parking"), // parking | staging | wash_bay | pickup | dropoff | overflow
  capacity: integer("capacity").notNull().default(1),
  active: boolean("active").notNull().default(true),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("station_pos_ws_station_code_idx").on(t.workspaceId, t.stationId, t.code),
  index("station_pos_station_idx").on(t.stationId),
  index("station_pos_type_idx").on(t.type),
]);
export const insertStationPositionSchema = createInsertSchema(stationPositions).omit({ createdAt: true });
export type InsertStationPosition = z.infer<typeof insertStationPositionSchema>;
export type StationPosition = typeof stationPositions.$inferSelect;

// ─── POSITION ASSIGNMENTS (vehicle-to-position mapping) ───
export const positionAssignments = pgTable("position_assignments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  positionId: integer("position_id").notNull(),
  vehicleId: integer("vehicle_id").notNull(),
  assignedBy: integer("assigned_by"),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
  releasedAt: timestamp("released_at"),
}, (t) => [
  index("pos_assign_position_idx").on(t.positionId),
  index("pos_assign_vehicle_idx").on(t.vehicleId),
  index("pos_assign_active_idx").on(t.positionId, t.releasedAt),
]);
export const insertPositionAssignmentSchema = createInsertSchema(positionAssignments).omit({ assignedAt: true, releasedAt: true });
export type InsertPositionAssignment = z.infer<typeof insertPositionAssignmentSchema>;
export type PositionAssignment = typeof positionAssignments.$inferSelect;

// ─── VEHICLE TRANSFERS (inter-station transfer tracking) ───
export const vehicleTransfers = pgTable("vehicle_transfers", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  vehicleId: integer("vehicle_id").notNull(),
  fromStationId: integer("from_station_id").notNull(),
  toStationId: integer("to_station_id").notNull(),
  status: text("status").notNull().default("requested"), // requested | in_transit | delivered | cancelled
  requestedBy: integer("requested_by").notNull(),
  driverName: text("driver_name"),
  reason: text("reason"),
  notes: text("notes"),
  estimatedArrival: timestamp("estimated_arrival"),
  departedAt: timestamp("departed_at"),
  arrivedAt: timestamp("arrived_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("transfers_vehicle_idx").on(t.vehicleId),
  index("transfers_from_idx").on(t.fromStationId),
  index("transfers_to_idx").on(t.toStationId),
  index("transfers_status_idx").on(t.status),
  index("transfers_created_idx").on(t.createdAt),
]);
export const insertVehicleTransferSchema = createInsertSchema(vehicleTransfers).omit({ createdAt: true, updatedAt: true, departedAt: true, arrivedAt: true });
export type InsertVehicleTransfer = z.infer<typeof insertVehicleTransferSchema>;
export type VehicleTransfer = typeof vehicleTransfers.$inferSelect;

// ─── CHAT CHANNELS (Discord-style team messaging) ───
export const chatChannels = pgTable("chat_channels", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  type: text("type").notNull().default("public"), // public | private | station | washer_bridge
  stationId: integer("station_id"),
  createdBy: integer("created_by").notNull(),
  archived: boolean("archived").notNull().default(false),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("channels_ws_slug_idx").on(t.workspaceId, t.slug),
  index("channels_type_idx").on(t.type),
  index("channels_station_idx").on(t.stationId),
]);
export const insertChatChannelSchema = createInsertSchema(chatChannels).omit({ createdAt: true, updatedAt: true, archived: true });
export type InsertChatChannel = z.infer<typeof insertChatChannelSchema>;
export type ChatChannel = typeof chatChannels.$inferSelect;

// ─── CHANNEL MEMBERS (membership + read state) ───
export const channelMembers = pgTable("channel_members", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  channelId: integer("channel_id").notNull(),
  userId: integer("user_id").notNull(),
  role: text("role").notNull().default("member"), // owner | admin | member
  lastReadAt: timestamp("last_read_at"),
  muted: boolean("muted").notNull().default(false),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("channel_member_uniq_idx").on(t.channelId, t.userId),
  index("channel_member_user_idx").on(t.userId),
]);
export const insertChannelMemberSchema = createInsertSchema(channelMembers).omit({ joinedAt: true, lastReadAt: true });
export type InsertChannelMember = z.infer<typeof insertChannelMemberSchema>;
export type ChannelMember = typeof channelMembers.$inferSelect;

// ─── CHANNEL MESSAGES (Discord-style with replies, edits) ───
export const channelMessages = pgTable("channel_messages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  channelId: integer("channel_id").notNull(),
  userId: integer("user_id").notNull(),
  content: text("content").notNull(),
  replyToId: integer("reply_to_id"),
  edited: boolean("edited").notNull().default(false),
  editedAt: timestamp("edited_at"),
  pinned: boolean("pinned").notNull().default(false),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("ch_msg_channel_idx").on(t.channelId, t.createdAt),
  index("ch_msg_user_idx").on(t.userId),
  index("ch_msg_reply_idx").on(t.replyToId),
  index("ch_msg_pinned_idx").on(t.channelId, t.pinned),
]);
export const insertChannelMessageSchema = createInsertSchema(channelMessages).omit({ createdAt: true, edited: true, editedAt: true, pinned: true });
export type InsertChannelMessage = z.infer<typeof insertChannelMessageSchema>;
export type ChannelMessage = typeof channelMessages.$inferSelect;

// ─── CHANNEL REACTIONS (emoji reactions on messages) ───
export const channelReactions = pgTable("channel_reactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  messageId: integer("message_id").notNull(),
  userId: integer("user_id").notNull(),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("ch_reaction_uniq_idx").on(t.messageId, t.userId, t.emoji),
  index("ch_reaction_message_idx").on(t.messageId),
]);
export const insertChannelReactionSchema = createInsertSchema(channelReactions).omit({ createdAt: true });
export type InsertChannelReaction = z.infer<typeof insertChannelReactionSchema>;
export type ChannelReaction = typeof channelReactions.$inferSelect;

// ─── APP GRAPH VERSIONS (versioned application configuration) ───
export const appGraphVersions = pgTable("app_graph_versions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  version: integer("version").notNull(),
  label: text("label"),
  graph: jsonb("graph").$type<Record<string, unknown>>().notNull(),
  diff: jsonb("diff").$type<Record<string, unknown>>(),
  createdBy: integer("created_by").notNull(),
  appliedAt: timestamp("applied_at"),
  rolledBackAt: timestamp("rolled_back_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("app_graph_ws_version_idx").on(t.workspaceId, t.version),
  index("app_graph_created_idx").on(t.createdAt),
]);
export const insertAppGraphVersionSchema = createInsertSchema(appGraphVersions).omit({ createdAt: true, appliedAt: true, rolledBackAt: true });
export type InsertAppGraphVersion = z.infer<typeof insertAppGraphVersionSchema>;
export type AppGraphVersion = typeof appGraphVersions.$inferSelect;

// ─── AI MODEL USAGE (gateway token/cost tracking) ───
export const aiModelUsage = pgTable("ai_model_usage", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  provider: text("provider").notNull(), // anthropic | openai | local
  model: text("model").notNull(),
  userId: integer("user_id"),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  costCents: real("cost_cents"),
  latencyMs: integer("latency_ms"),
  feature: text("feature").notNull().default("chat"), // chat | summary | ocr | automation
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

// ─── INSTALLED EXTENSIONS (extension/plugin registry) ───
export const installedExtensions = pgTable("installed_extensions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default"),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  version: text("version").notNull(),
  description: text("description"),
  author: text("author"),
  manifest: jsonb("manifest").$type<Record<string, unknown>>().notNull(),
  permissions: jsonb("permissions").$type<string[]>().notNull(),
  enabled: boolean("enabled").notNull().default(true),
  config: jsonb("config").$type<Record<string, unknown>>(),
  installedBy: integer("installed_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("ext_ws_slug_idx").on(t.workspaceId, t.slug),
  index("ext_enabled_idx").on(t.enabled),
]);
export const insertInstalledExtensionSchema = createInsertSchema(installedExtensions).omit({ createdAt: true, updatedAt: true });
export type InsertInstalledExtension = z.infer<typeof insertInstalledExtensionSchema>;
export type InstalledExtension = typeof installedExtensions.$inferSelect;
