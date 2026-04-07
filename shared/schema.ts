import { pgTable, text, integer, boolean, timestamp, jsonb, real, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── USERS & AUTH ───
export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("agent"),
  station: text("station"),
  language: text("language").notNull().default("en"),
  theme: text("theme").notNull().default("dark"),
});
export const insertUserSchema = createInsertSchema(users);
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ─── USER PREFERENCES (personal workspace isolation) ───
export const userPreferences = pgTable("user_preferences", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
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
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  address: text("address"),
  timezone: text("timezone").notNull().default("Europe/Athens"),
  active: boolean("active").notNull().default(true),
});
export const insertStationSchema = createInsertSchema(stations);
export type InsertStation = z.infer<typeof insertStationSchema>;
export type Station = typeof stations.$inferSelect;

// ─── CHAT ───
export const chatConversations = pgTable("chat_conversations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
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
  plate: text("plate").notNull().unique(),
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
]);
export const insertVehicleSchema = createInsertSchema(vehicles).omit({ deletedAt: true });
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehicles.$inferSelect;

// ─── VEHICLE EVIDENCE (photos, notes, damage) ───
export const vehicleEvidence = pgTable("vehicle_evidence", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
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
  vehiclePlate: text("vehicle_plate").notNull(),
  washType: text("wash_type").notNull().default("Quick Wash"),
  priority: text("priority").notNull().default("Normal"),
  assignedTo: text("assigned_to"),
  status: text("status").notNull().default("pending"),
  slaInfo: text("sla_info"),
  stationId: integer("station_id"),
  proofPhotoUrl: text("proof_photo_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});
export const insertWashQueueSchema = createInsertSchema(washQueue).omit({ createdAt: true, completedAt: true });
export type InsertWashQueue = z.infer<typeof insertWashQueueSchema>;
export type WashQueueItem = typeof washQueue.$inferSelect;

// ─── SHIFTS ───
export const shifts = pgTable("shifts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
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
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("operations"),
  icon: text("icon").notNull().default("Box"),
  route: text("route").notNull(),
  requiredRole: text("required_role").notNull().default("agent"),
  enabled: boolean("enabled").notNull().default(true),
  order: integer("order").notNull().default(0),
  config: jsonb("config").$type<Record<string, unknown>>(),
});
export const insertModuleRegistrySchema = createInsertSchema(moduleRegistry);
export type InsertModuleRegistry = z.infer<typeof insertModuleRegistrySchema>;
export type ModuleRegistryEntry = typeof moduleRegistry.$inferSelect;

// ─── WORKSPACE CONFIG (tenant-level configuration) ───
export const workspaceConfig = pgTable("workspace_config", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  key: text("key").notNull().unique(),
  value: jsonb("value").$type<unknown>().notNull(),
  category: text("category").notNull().default("general"),
  description: text("description"),
  updatedBy: integer("updated_by"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const insertWorkspaceConfigSchema = createInsertSchema(workspaceConfig).omit({ updatedAt: true });
export type InsertWorkspaceConfig = z.infer<typeof insertWorkspaceConfigSchema>;
export type WorkspaceConfigEntry = typeof workspaceConfig.$inferSelect;

// ─── WORKSPACE PROPOSALS (adaptive workspace review pipeline) ───
export const workspaceProposals = pgTable("workspace_proposals", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
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
  filename: text("filename").notNull(),
  status: text("status").notNull().default("uploading"),
  uploadedBy: integer("uploaded_by").notNull(),
  records: integer("records").notNull().default(0),
  columns: integer("columns").notNull().default(0),
  mappings: jsonb("mappings").$type<Array<{ source: string; target: string; confidence: number }>>(),
  diffs: jsonb("diffs").$type<{ added: number; updated: number; deleted: number; conflicts: number }>(),
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
