import { db } from "./db.js";
import { eq, desc, and, sql, isNull, or, gte, lt } from "drizzle-orm";
import {
  users, type User, type InsertUser,
  userPreferences, type UserPreference, type InsertUserPreference,
  chatConversations, type ChatConversation, type InsertConversation,
  chatMessages, type ChatMessage, type InsertMessage,
  vehicles, type Vehicle, type InsertVehicle,
  vehicleEvidence, type VehicleEvidence, type InsertVehicleEvidence,
  washQueue, type WashQueueItem, type InsertWashQueue,
  shifts, type Shift, type InsertShift,
  shiftRequests, type ShiftRequest, type InsertShiftRequest,
  notifications, type Notification, type InsertNotification,
  notificationReads,
  customActions, type CustomAction, type InsertCustomAction,
  stations, type Station, type InsertStation,
  automationRules, type AutomationRule, type InsertAutomationRule,
  auditLog, type AuditLog, type InsertAuditLog,
  entityRooms, type EntityRoom, type InsertEntityRoom,
  roomMessages, type RoomMessage, type InsertRoomMessage,
  workspaceMemory, type WorkspaceMemory, type InsertWorkspaceMemory,
  digitalTwinSnapshots, type DigitalTwinSnapshot, type InsertDigitalTwinSnapshot,
  systemPolicies, type SystemPolicy, type InsertSystemPolicy,
  activityFeed, type ActivityFeedEntry, type InsertActivityFeed,
  moduleRegistry, type ModuleRegistryEntry, type InsertModuleRegistry,
  workspaceConfig, type WorkspaceConfigEntry, type InsertWorkspaceConfig,
  fileAttachments, type FileAttachment, type InsertFileAttachment,
  imports, type Import, type InsertImport,
  workspaceProposals, type WorkspaceProposal, type InsertWorkspaceProposal,
  feedback, type Feedback, type InsertFeedback,
} from "../shared/schema.js";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<void>;

  getUserPreferences(userId: number, category?: string): Promise<UserPreference[]>;
  setUserPreference(data: InsertUserPreference): Promise<UserPreference>;
  deleteUserPreference(id: number): Promise<void>;

  getConversations(userId: number): Promise<ChatConversation[]>;
  getConversation(id: number): Promise<ChatConversation | undefined>;
  createConversation(data: InsertConversation): Promise<ChatConversation>;
  updateConversation(id: number, data: Partial<InsertConversation>): Promise<ChatConversation | undefined>;
  deleteConversation(id: number): Promise<void>;

  getMessages(conversationId: number): Promise<ChatMessage[]>;
  createMessage(data: InsertMessage): Promise<ChatMessage>;

  getVehicles(): Promise<Vehicle[]>;
  getVehicle(id: number): Promise<Vehicle | undefined>;
  createVehicle(data: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: number, data: Partial<InsertVehicle>): Promise<Vehicle | undefined>;
  deleteVehicle(id: number): Promise<void>;
  restoreVehicle(id: number): Promise<Vehicle | undefined>;

  getVehicleEvidence(vehicleId: number): Promise<VehicleEvidence[]>;
  createVehicleEvidence(data: InsertVehicleEvidence): Promise<VehicleEvidence>;

  getWashQueue(): Promise<WashQueueItem[]>;
  createWashQueueItem(data: InsertWashQueue): Promise<WashQueueItem>;
  updateWashQueueItem(id: number, data: Partial<InsertWashQueue>): Promise<WashQueueItem | undefined>;
  deleteWashQueueItem(id: number): Promise<void>;

  getShifts(weekStart?: string): Promise<Shift[]>;
  getPublishedShifts(weekStart?: string): Promise<Shift[]>;
  createShift(data: InsertShift): Promise<Shift>;
  updateShift(id: number, data: Partial<InsertShift>): Promise<Shift | undefined>;
  publishShift(id: number, publishedBy: number): Promise<Shift | undefined>;
  deleteShift(id: number): Promise<void>;

  getShiftRequests(userId?: number): Promise<ShiftRequest[]>;
  createShiftRequest(data: InsertShiftRequest): Promise<ShiftRequest>;
  reviewShiftRequest(id: number, reviewedBy: number, status: string, note?: string): Promise<ShiftRequest | undefined>;

  getNotifications(userId: number, role: string, stationId?: number): Promise<(Notification & { read: boolean })[]>;
  createNotification(data: InsertNotification): Promise<Notification>;
  markNotificationRead(notificationId: number, userId: number): Promise<void>;
  markAllNotificationsRead(userId: number, role: string, stationId?: number): Promise<void>;

  getCustomActions(userId: number): Promise<CustomAction[]>;
  getCustomAction(id: number): Promise<CustomAction | undefined>;
  createCustomAction(data: InsertCustomAction): Promise<CustomAction>;
  deleteCustomAction(id: number): Promise<void>;

  getUserPreference(id: number): Promise<UserPreference | undefined>;

  getFileAttachment(id: number): Promise<FileAttachment | undefined>;

  getStations(): Promise<Station[]>;
  createStation(data: InsertStation): Promise<Station>;
  updateStation(id: number, data: Partial<InsertStation>): Promise<Station | undefined>;

  getAutomationRules(userId?: number): Promise<AutomationRule[]>;
  getAutomationRule(id: number): Promise<AutomationRule | undefined>;
  createAutomationRule(data: InsertAutomationRule): Promise<AutomationRule>;
  updateAutomationRule(id: number, data: Partial<InsertAutomationRule>): Promise<AutomationRule | undefined>;
  deleteAutomationRule(id: number): Promise<void>;

  getAuditLog(limit?: number): Promise<AuditLog[]>;
  createAuditEntry(data: InsertAuditLog): Promise<AuditLog>;
  deleteAuditEntriesBefore(cutoff: Date): Promise<number>;

  getEntityRooms(entityType?: string): Promise<EntityRoom[]>;
  getEntityRoom(id: number): Promise<EntityRoom | undefined>;
  createEntityRoom(data: InsertEntityRoom): Promise<EntityRoom>;
  updateEntityRoom(id: number, data: Partial<InsertEntityRoom>): Promise<EntityRoom | undefined>;

  getRoomMessages(roomId: number): Promise<RoomMessage[]>;
  createRoomMessage(data: InsertRoomMessage): Promise<RoomMessage>;

  getWorkspaceMemory(category?: string): Promise<WorkspaceMemory[]>;
  createWorkspaceMemory(data: InsertWorkspaceMemory): Promise<WorkspaceMemory>;
  updateWorkspaceMemory(id: number, data: Partial<InsertWorkspaceMemory>): Promise<WorkspaceMemory | undefined>;

  getDigitalTwinSnapshots(stationId?: number): Promise<DigitalTwinSnapshot[]>;
  createDigitalTwinSnapshot(data: InsertDigitalTwinSnapshot): Promise<DigitalTwinSnapshot>;

  getSystemPolicies(category?: string): Promise<SystemPolicy[]>;
  createSystemPolicy(data: InsertSystemPolicy): Promise<SystemPolicy>;
  updateSystemPolicy(id: number, data: Partial<InsertSystemPolicy>): Promise<SystemPolicy | undefined>;
  deleteSystemPolicy(id: number): Promise<void>;

  getActivityFeed(limit?: number): Promise<ActivityFeedEntry[]>;
  createActivityEntry(data: InsertActivityFeed): Promise<ActivityFeedEntry>;

  getModuleRegistry(): Promise<ModuleRegistryEntry[]>;
  createModuleEntry(data: InsertModuleRegistry): Promise<ModuleRegistryEntry>;
  updateModuleEntry(id: number, data: Partial<InsertModuleRegistry>): Promise<ModuleRegistryEntry | undefined>;

  getWorkspaceConfig(category?: string): Promise<WorkspaceConfigEntry[]>;
  getWorkspaceConfigByKey(key: string): Promise<WorkspaceConfigEntry | undefined>;
  setWorkspaceConfig(data: InsertWorkspaceConfig): Promise<WorkspaceConfigEntry>;
  deleteWorkspaceConfigByKey(key: string): Promise<void>;

  getFileAttachments(entityType: string, entityId: string): Promise<FileAttachment[]>;
  createFileAttachment(data: InsertFileAttachment): Promise<FileAttachment>;
  deleteFileAttachment(id: number): Promise<void>;

  getImports(uploadedBy?: number): Promise<Import[]>;
  getImport(id: number): Promise<Import | undefined>;
  createImport(data: InsertImport): Promise<Import>;
  updateImport(id: number, data: Partial<InsertImport> & { completedAt?: Date | null }): Promise<Import | undefined>;
  deleteImport(id: number): Promise<void>;

  getEntityRoomByEntity(entityType: string, entityId: string): Promise<EntityRoom | undefined>;

  getDashboardStats(): Promise<Record<string, unknown>>;
  getAnalyticsSummary(): Promise<Record<string, unknown>>;
  updateNotification(id: number, data: Partial<InsertNotification>): Promise<Notification | undefined>;
  searchEntities(query: string): Promise<Array<{ type: string; id: number | string; label: string; description?: string }>>;

  // Chunk 4: Operational deepening
  getNotificationStats(userId: number, role: string, stationId?: number): Promise<{ open: number; inProgress: number; resolved: number; escalated: number }>;
  getAnalyticsTrends(days: number): Promise<{ date: string; washes: number; evidence: number; notifications: number }[]>;
  getDigitalTwinTimeline(stationId?: number, from?: string, to?: string): Promise<DigitalTwinSnapshot[]>;
  getVehicleTrends(vehicleId: number): Promise<{ totalWashes: number; totalEvidence: number; recentWashes: { date: string; count: number }[]; recentEvidence: { date: string; count: number }[]; topZones: { zone: string; count: number }[] }>;
  testAutomationRule(id: number): Promise<{ valid: boolean; errors: string[]; matchingEntities: number }>;

  // Chunk 6: Workspace proposals
  getProposals(userId?: number, status?: string): Promise<WorkspaceProposal[]>;
  getProposal(id: number): Promise<WorkspaceProposal | undefined>;
  createProposal(data: InsertWorkspaceProposal): Promise<WorkspaceProposal>;
  updateProposal(id: number, data: Partial<WorkspaceProposal>): Promise<WorkspaceProposal | undefined>;

  // Week-1 stabilization: feedback
  createFeedback(data: InsertFeedback): Promise<Feedback>;
  getFeedback(): Promise<Feedback[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByUsername(username: string) {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  async getUsers() { return db.select().from(users); }
  async createUser(data: InsertUser) {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  }
  async updateUser(id: number, data: Partial<InsertUser>) {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }
  async deleteUser(id: number) {
    await db.delete(users).where(eq(users.id, id));
  }

  async getUserPreferences(userId: number, category?: string) {
    if (category) return db.select().from(userPreferences).where(and(eq(userPreferences.userId, userId), eq(userPreferences.category, category)));
    return db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
  }
  async setUserPreference(data: InsertUserPreference) {
    const existing = await db.select().from(userPreferences)
      .where(and(eq(userPreferences.userId, data.userId), eq(userPreferences.category, data.category), eq(userPreferences.key, data.key)));
    if (existing.length > 0) {
      const [pref] = await db.update(userPreferences).set({ value: data.value, updatedAt: new Date() }).where(eq(userPreferences.id, existing[0].id)).returning();
      return pref;
    }
    const [pref] = await db.insert(userPreferences).values(data).returning();
    return pref;
  }
  async deleteUserPreference(id: number) { await db.delete(userPreferences).where(eq(userPreferences.id, id)); }
  async getUserPreference(id: number) {
    const [p] = await db.select().from(userPreferences).where(eq(userPreferences.id, id));
    return p;
  }

  async getConversations(userId: number) {
    return db.select().from(chatConversations).where(eq(chatConversations.userId, userId)).orderBy(desc(chatConversations.createdAt));
  }
  async getConversation(id: number) {
    const [conv] = await db.select().from(chatConversations).where(eq(chatConversations.id, id));
    return conv;
  }
  async createConversation(data: InsertConversation) {
    const [conv] = await db.insert(chatConversations).values(data).returning();
    return conv;
  }
  async updateConversation(id: number, data: Partial<InsertConversation>) {
    const [conv] = await db.update(chatConversations).set(data).where(eq(chatConversations.id, id)).returning();
    return conv;
  }
  async deleteConversation(id: number) {
    await db.delete(chatMessages).where(eq(chatMessages.conversationId, id));
    await db.delete(chatConversations).where(eq(chatConversations.id, id));
  }

  async getMessages(conversationId: number) {
    return db.select().from(chatMessages).where(eq(chatMessages.conversationId, conversationId)).orderBy(chatMessages.createdAt);
  }
  async createMessage(data: InsertMessage) {
    const [msg] = await db.insert(chatMessages).values(data).returning();
    return msg;
  }

  async getVehicles() {
    return db.select().from(vehicles).where(isNull(vehicles.deletedAt));
  }
  async getVehicle(id: number) {
    const [v] = await db.select().from(vehicles).where(eq(vehicles.id, id));
    return v;
  }
  async createVehicle(data: InsertVehicle) {
    const [v] = await db.insert(vehicles).values(data).returning();
    return v;
  }
  async updateVehicle(id: number, data: Partial<InsertVehicle>) {
    const [v] = await db.update(vehicles).set(data).where(eq(vehicles.id, id)).returning();
    return v;
  }
  async deleteVehicle(id: number) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deletedAt is a table column absent from insert schema
    await db.update(vehicles).set({ deletedAt: new Date() } as any).where(eq(vehicles.id, id));
  }
  async restoreVehicle(id: number) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deletedAt is a table column absent from insert schema
    const [v] = await db.update(vehicles).set({ deletedAt: null } as any).where(eq(vehicles.id, id)).returning();
    return v;
  }

  async getVehicleEvidence(vehicleId: number) {
    return db.select().from(vehicleEvidence).where(eq(vehicleEvidence.vehicleId, vehicleId)).orderBy(desc(vehicleEvidence.createdAt));
  }
  async createVehicleEvidence(data: InsertVehicleEvidence) {
    const [e] = await db.insert(vehicleEvidence).values(data).returning();
    return e;
  }

  async getWashQueue() { return db.select().from(washQueue).orderBy(desc(washQueue.createdAt)); }
  async createWashQueueItem(data: InsertWashQueue) {
    const [item] = await db.insert(washQueue).values(data).returning();
    return item;
  }
  async updateWashQueueItem(id: number, data: Partial<InsertWashQueue>) {
    const [item] = await db.update(washQueue).set(data).where(eq(washQueue.id, id)).returning();
    return item;
  }
  async deleteWashQueueItem(id: number) { await db.delete(washQueue).where(eq(washQueue.id, id)); }

  async getShifts(weekStart?: string) {
    if (weekStart) return db.select().from(shifts).where(eq(shifts.weekStart, weekStart));
    return db.select().from(shifts);
  }
  async getPublishedShifts(weekStart?: string) {
    if (weekStart) return db.select().from(shifts).where(and(eq(shifts.status, 'published'), eq(shifts.weekStart, weekStart)));
    return db.select().from(shifts).where(eq(shifts.status, 'published'));
  }
  async createShift(data: InsertShift) {
    const [s] = await db.insert(shifts).values(data).returning();
    return s;
  }
  async updateShift(id: number, data: Partial<InsertShift>) {
    const [s] = await db.update(shifts).set(data).where(eq(shifts.id, id)).returning();
    return s;
  }
  async publishShift(id: number, publishedBy: number) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- publishedAt/publishedBy absent from insert schema
    const [s] = await db.update(shifts).set({ status: 'published', publishedBy, publishedAt: new Date() } as any).where(eq(shifts.id, id)).returning();
    return s;
  }
  async deleteShift(id: number) { await db.delete(shifts).where(eq(shifts.id, id)); }

  async getShiftRequests(userId?: number) {
    if (userId) return db.select().from(shiftRequests).where(eq(shiftRequests.userId, userId)).orderBy(desc(shiftRequests.createdAt));
    return db.select().from(shiftRequests).orderBy(desc(shiftRequests.createdAt));
  }
  async createShiftRequest(data: InsertShiftRequest) {
    const [req] = await db.insert(shiftRequests).values(data).returning();
    return req;
  }
  async reviewShiftRequest(id: number, reviewedBy: number, status: string, note?: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- reviewedAt/reviewNote absent from insert schema
    const [req] = await db.update(shiftRequests).set({ status, reviewedBy, reviewNote: note || null, reviewedAt: new Date() } as any).where(eq(shiftRequests.id, id)).returning();
    return req;
  }

  async getNotifications(userId: number, role: string, stationId?: number) {
    const readRows = await db.select({ notificationId: notificationReads.notificationId })
      .from(notificationReads)
      .where(eq(notificationReads.userId, userId));
    const readIdSet = new Set(readRows.map(r => r.notificationId));

    const conditions = [
      eq(notifications.audience, 'broadcast'),
      eq(notifications.recipientUserId, userId),
      eq(notifications.recipientRole, role),
    ];
    if (stationId) {
      conditions.push(eq(notifications.recipientStationId, stationId));
    }

    const results = await db.select().from(notifications)
      .where(or(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(200);

    return results.map(n => ({ ...n, read: readIdSet.has(n.id) }));
  }
  async createNotification(data: InsertNotification) {
    const [n] = await db.insert(notifications).values(data).returning();
    return n;
  }
  async markNotificationRead(notificationId: number, userId: number) {
    await db.insert(notificationReads)
      .values({ notificationId, userId })
      .onConflictDoNothing();
  }
  async markAllNotificationsRead(userId: number, role: string, stationId?: number) {
    const conditions = [
      eq(notifications.audience, 'broadcast'),
      eq(notifications.recipientUserId, userId),
      eq(notifications.recipientRole, role),
    ];
    if (stationId) {
      conditions.push(eq(notifications.recipientStationId, stationId));
    }
    const visible = await db.select({ id: notifications.id })
      .from(notifications)
      .where(or(...conditions));
    if (visible.length === 0) return;
    const values = visible.map(n => ({ notificationId: n.id, userId }));
    await db.insert(notificationReads).values(values).onConflictDoNothing();
  }

  async getCustomActions(userId: number) {
    return db.select().from(customActions).where(and(eq(customActions.userId, userId), eq(customActions.active, true)));
  }
  async getCustomAction(id: number) {
    const [a] = await db.select().from(customActions).where(eq(customActions.id, id));
    return a;
  }
  async createCustomAction(data: InsertCustomAction) {
    const [a] = await db.insert(customActions).values(data).returning();
    return a;
  }
  async deleteCustomAction(id: number) { await db.delete(customActions).where(eq(customActions.id, id)); }

  async getStations() { return db.select().from(stations); }
  async createStation(data: InsertStation) {
    const [s] = await db.insert(stations).values(data).returning();
    return s;
  }
  async updateStation(id: number, data: Partial<InsertStation>) {
    const [s] = await db.update(stations).set(data).where(eq(stations.id, id)).returning();
    return s;
  }

  async getAutomationRules(userId?: number) {
    if (userId) {
      return db.select().from(automationRules)
        .where(or(eq(automationRules.scope, 'shared'), eq(automationRules.createdBy, userId)))
        .orderBy(desc(automationRules.createdAt));
    }
    return db.select().from(automationRules).orderBy(desc(automationRules.createdAt));
  }
  async createAutomationRule(data: InsertAutomationRule) {
    const [r] = await db.insert(automationRules).values(data).returning();
    return r;
  }
  async getAutomationRule(id: number) {
    const [r] = await db.select().from(automationRules).where(eq(automationRules.id, id));
    return r;
  }
  async updateAutomationRule(id: number, data: Partial<InsertAutomationRule>) {
    const [r] = await db.update(automationRules).set(data).where(eq(automationRules.id, id)).returning();
    return r;
  }
  async deleteAutomationRule(id: number) { await db.delete(automationRules).where(eq(automationRules.id, id)); }

  async getAuditLog(limit = 100) {
    return db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(limit);
  }
  async createAuditEntry(data: InsertAuditLog) {
    const [entry] = await db.insert(auditLog).values(data).returning();
    return entry;
  }
  async deleteAuditEntriesBefore(cutoff: Date) {
    const deleted = await db.delete(auditLog).where(lt(auditLog.createdAt, cutoff)).returning();
    return deleted.length;
  }

  async getEntityRooms(entityType?: string) {
    if (entityType) return db.select().from(entityRooms).where(eq(entityRooms.entityType, entityType)).orderBy(desc(entityRooms.createdAt));
    return db.select().from(entityRooms).orderBy(desc(entityRooms.createdAt));
  }
  async getEntityRoom(id: number) {
    const [room] = await db.select().from(entityRooms).where(eq(entityRooms.id, id));
    return room;
  }
  async createEntityRoom(data: InsertEntityRoom) {
    const [room] = await db.insert(entityRooms).values(data).returning();
    return room;
  }
  async updateEntityRoom(id: number, data: Partial<InsertEntityRoom>) {
    const [room] = await db.update(entityRooms).set(data).where(eq(entityRooms.id, id)).returning();
    return room;
  }

  async getRoomMessages(roomId: number) {
    return db.select().from(roomMessages).where(eq(roomMessages.roomId, roomId)).orderBy(roomMessages.createdAt);
  }
  async createRoomMessage(data: InsertRoomMessage) {
    const [msg] = await db.insert(roomMessages).values(data).returning();
    return msg;
  }

  async getWorkspaceMemory(category?: string) {
    if (category) return db.select().from(workspaceMemory).where(eq(workspaceMemory.category, category)).orderBy(desc(workspaceMemory.updatedAt));
    return db.select().from(workspaceMemory).orderBy(desc(workspaceMemory.updatedAt));
  }
  async createWorkspaceMemory(data: InsertWorkspaceMemory) {
    const [m] = await db.insert(workspaceMemory).values(data).returning();
    return m;
  }
  async updateWorkspaceMemory(id: number, data: Partial<InsertWorkspaceMemory>) {
    const [m] = await db.update(workspaceMemory).set({ ...data, updatedAt: new Date() }).where(eq(workspaceMemory.id, id)).returning();
    return m;
  }

  async getDigitalTwinSnapshots(stationId?: number) {
    if (stationId) return db.select().from(digitalTwinSnapshots).where(eq(digitalTwinSnapshots.stationId, stationId)).orderBy(desc(digitalTwinSnapshots.createdAt)).limit(50);
    return db.select().from(digitalTwinSnapshots).orderBy(desc(digitalTwinSnapshots.createdAt)).limit(50);
  }
  async createDigitalTwinSnapshot(data: InsertDigitalTwinSnapshot) {
    const [s] = await db.insert(digitalTwinSnapshots).values(data).returning();
    return s;
  }

  async getSystemPolicies(category?: string) {
    if (category) return db.select().from(systemPolicies).where(eq(systemPolicies.category, category)).orderBy(desc(systemPolicies.createdAt));
    return db.select().from(systemPolicies).orderBy(desc(systemPolicies.createdAt));
  }
  async createSystemPolicy(data: InsertSystemPolicy) {
    const [p] = await db.insert(systemPolicies).values(data).returning();
    return p;
  }
  async updateSystemPolicy(id: number, data: Partial<InsertSystemPolicy>) {
    const [p] = await db.update(systemPolicies).set({ ...data, updatedAt: new Date() }).where(eq(systemPolicies.id, id)).returning();
    return p;
  }
  async deleteSystemPolicy(id: number) {
    await db.delete(systemPolicies).where(eq(systemPolicies.id, id));
  }

  async getActivityFeed(limit = 50) {
    return db.select().from(activityFeed).orderBy(desc(activityFeed.createdAt)).limit(limit);
  }
  async createActivityEntry(data: InsertActivityFeed) {
    const [entry] = await db.insert(activityFeed).values(data).returning();
    return entry;
  }

  async getModuleRegistry() {
    return db.select().from(moduleRegistry).orderBy(moduleRegistry.order);
  }
  async createModuleEntry(data: InsertModuleRegistry) {
    const [m] = await db.insert(moduleRegistry).values(data).returning();
    return m;
  }
  async updateModuleEntry(id: number, data: Partial<InsertModuleRegistry>) {
    const [m] = await db.update(moduleRegistry).set(data).where(eq(moduleRegistry.id, id)).returning();
    return m;
  }

  async getWorkspaceConfig(category?: string) {
    if (category) return db.select().from(workspaceConfig).where(eq(workspaceConfig.category, category));
    return db.select().from(workspaceConfig);
  }
  async getWorkspaceConfigByKey(key: string) {
    const [c] = await db.select().from(workspaceConfig).where(eq(workspaceConfig.key, key));
    return c;
  }
  async setWorkspaceConfig(data: InsertWorkspaceConfig) {
    const existing = await db.select().from(workspaceConfig).where(eq(workspaceConfig.key, data.key));
    if (existing.length > 0) {
      const [c] = await db.update(workspaceConfig).set({ value: data.value, updatedBy: data.updatedBy, updatedAt: new Date() }).where(eq(workspaceConfig.id, existing[0].id)).returning();
      return c;
    }
    const [c] = await db.insert(workspaceConfig).values(data).returning();
    return c;
  }
  async deleteWorkspaceConfigByKey(key: string) {
    await db.delete(workspaceConfig).where(eq(workspaceConfig.key, key));
  }

  async getFileAttachments(entityType: string, entityId: string) {
    return db.select().from(fileAttachments).where(and(eq(fileAttachments.entityType, entityType), eq(fileAttachments.entityId, entityId))).orderBy(desc(fileAttachments.createdAt));
  }
  async createFileAttachment(data: InsertFileAttachment) {
    const [f] = await db.insert(fileAttachments).values(data).returning();
    return f;
  }
  async deleteFileAttachment(id: number) {
    await db.delete(fileAttachments).where(eq(fileAttachments.id, id));
  }
  async getFileAttachment(id: number) {
    const [f] = await db.select().from(fileAttachments).where(eq(fileAttachments.id, id));
    return f;
  }

  async getImports(uploadedBy?: number) {
    if (uploadedBy) return db.select().from(imports).where(eq(imports.uploadedBy, uploadedBy)).orderBy(desc(imports.createdAt));
    return db.select().from(imports).orderBy(desc(imports.createdAt));
  }
  async getImport(id: number) {
    const [imp] = await db.select().from(imports).where(eq(imports.id, id));
    return imp;
  }
  async createImport(data: InsertImport) {
    const [imp] = await db.insert(imports).values(data).returning();
    return imp;
  }
  async updateImport(id: number, data: Partial<InsertImport> & { completedAt?: Date | null }) {
    const [imp] = await db.update(imports).set(data).where(eq(imports.id, id)).returning();
    return imp;
  }
  async deleteImport(id: number) {
    await db.delete(imports).where(eq(imports.id, id));
  }

  async getEntityRoomByEntity(entityType: string, entityId: string) {
    const [room] = await db.select().from(entityRooms)
      .where(and(eq(entityRooms.entityType, entityType), eq(entityRooms.entityId, entityId)));
    return room;
  }

  async getDashboardStats() {
    const [vehicleCount] = await db.select({ count: sql<number>`count(*)` }).from(vehicles).where(isNull(vehicles.deletedAt));
    const [washCount] = await db.select({ count: sql<number>`count(*)` }).from(washQueue);
    const [shiftCount] = await db.select({ count: sql<number>`count(*)` }).from(shifts);
    const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [stationCount] = await db.select({ count: sql<number>`count(*)` }).from(stations);
    const [automationCount] = await db.select({ count: sql<number>`count(*)` }).from(automationRules);
    const [roomCount] = await db.select({ count: sql<number>`count(*)` }).from(entityRooms);
    const [totalNotifs] = await db.select({ count: sql<number>`count(*)` }).from(notifications);
    const [pendingRequests] = await db.select({ count: sql<number>`count(*)` }).from(shiftRequests).where(eq(shiftRequests.status, 'pending'));
    return {
      vehicles: Number(vehicleCount.count),
      washQueue: Number(washCount.count),
      shifts: Number(shiftCount.count),
      users: Number(userCount.count),
      stations: Number(stationCount.count),
      automations: Number(automationCount.count),
      warRooms: Number(roomCount.count),
      notifications: Number(totalNotifs.count),
      pendingShiftRequests: Number(pendingRequests.count),
      timestamp: new Date().toISOString(),
    };
  }

  async getAnalyticsSummary() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const vehiclesByStatus = await db.select({
      status: vehicles.status,
      count: sql<number>`count(*)`,
    }).from(vehicles).where(isNull(vehicles.deletedAt)).groupBy(vehicles.status);

    const washesByStatus = await db.select({
      status: washQueue.status,
      count: sql<number>`count(*)`,
    }).from(washQueue).groupBy(washQueue.status);

    const [todayCompleted] = await db.select({ count: sql<number>`count(*)` })
      .from(washQueue)
      .where(and(eq(washQueue.status, 'completed'), gte(washQueue.completedAt, todayStart)));

    const [todayCreated] = await db.select({ count: sql<number>`count(*)` })
      .from(washQueue)
      .where(gte(washQueue.createdAt, todayStart));

    const notifsBySeverity = await db.select({
      severity: notifications.severity,
      count: sql<number>`count(*)`,
    }).from(notifications).groupBy(notifications.severity);

    const [automationStats] = await db.select({
      total: sql<number>`count(*)`,
      active: sql<number>`count(*) filter (where ${automationRules.active} = true)`,
      totalExecutions: sql<number>`coalesce(sum(${automationRules.triggerCount}), 0)`,
    }).from(automationRules);

    const roomsByStatus = await db.select({
      status: entityRooms.status,
      count: sql<number>`count(*)`,
    }).from(entityRooms).groupBy(entityRooms.status);

    const [evidenceStats] = await db.select({
      total: sql<number>`count(*)`,
      todayCount: sql<number>`count(*) filter (where ${vehicleEvidence.createdAt} >= ${todayStart})`,
    }).from(vehicleEvidence);

    const [shiftStats] = await db.select({ count: sql<number>`count(*)` }).from(shifts);
    const [stationStats] = await db.select({ count: sql<number>`count(*)` }).from(stations);
    const [userStats] = await db.select({ count: sql<number>`count(*)` }).from(users);

    const totalVehicles = vehiclesByStatus.reduce((s, r) => s + Number(r.count), 0);
    const readyCount = Number(vehiclesByStatus.find(r => r.status === 'ready')?.count ?? 0);

    return {
      vehiclesByStatus: Object.fromEntries(vehiclesByStatus.map(r => [r.status, Number(r.count)])),
      totalVehicles,
      readyCount,
      washesByStatus: Object.fromEntries(washesByStatus.map(r => [r.status, Number(r.count)])),
      washesCompletedToday: Number(todayCompleted.count),
      washesCreatedToday: Number(todayCreated.count),
      notifsBySeverity: Object.fromEntries(notifsBySeverity.map(r => [r.severity, Number(r.count)])),
      automations: {
        total: Number(automationStats.total),
        active: Number(automationStats.active),
        totalExecutions: Number(automationStats.totalExecutions),
      },
      roomsByStatus: Object.fromEntries(roomsByStatus.map(r => [r.status, Number(r.count)])),
      totalEvidence: Number(evidenceStats.total),
      evidenceToday: Number(evidenceStats.todayCount),
      totalShifts: Number(shiftStats.count),
      totalStations: Number(stationStats.count),
      totalUsers: Number(userStats.count),
      fleetUtilization: totalVehicles > 0 ? Math.round(((totalVehicles - readyCount) / totalVehicles) * 100) : 0,
      timestamp: new Date().toISOString(),
    };
  }

  async updateNotification(id: number, data: Partial<InsertNotification>) {
    const [n] = await db.update(notifications).set(data).where(eq(notifications.id, id)).returning();
    return n;
  }

  async searchEntities(query: string) {
    const searchPattern = `%${query.toLowerCase().replace(/[%_\\]/g, '\\$&')}%`;
    const results: Array<{ type: string; id: number | string; label: string; description?: string }> = [];

    const vRows = await db.select().from(vehicles)
      .where(and(
        isNull(vehicles.deletedAt),
        or(
          sql`lower(${vehicles.plate}) like ${searchPattern}`,
          sql`lower(${vehicles.model}) like ${searchPattern}`
        )
      ))
      .limit(5);
    for (const v of vRows) results.push({ type: 'vehicle', id: v.id, label: `${v.plate} - ${v.model}`, description: v.status });

    const uRows = await db.select().from(users)
      .where(or(
        sql`lower(${users.username}) like ${searchPattern}`,
        sql`lower(${users.displayName}) like ${searchPattern}`
      ))
      .limit(5);
    for (const u of uRows) results.push({ type: 'user', id: u.id, label: u.displayName, description: u.role });

    const sRows = await db.select().from(stations)
      .where(or(
        sql`lower(${stations.name}) like ${searchPattern}`,
        sql`lower(${stations.code}) like ${searchPattern}`
      ))
      .limit(5);
    for (const s of sRows) results.push({ type: 'station', id: s.id, label: `${s.code} - ${s.name}` });

    return results;
  }

  // ─── Chunk 4: Operational Deepening ───

  async getNotificationStats(userId: number, role: string, stationId?: number) {
    const baseFilter = role === 'admin'
      ? sql`true`
      : sql`(${notifications.audience} = 'broadcast' OR ${notifications.recipientUserId} = ${userId} OR ${notifications.recipientRole} = ${role}${stationId ? sql` OR ${notifications.recipientStationId} = ${stationId}` : sql``})`;

    const rows = await db.select({
      status: notifications.status,
      count: sql<number>`count(*)`,
    }).from(notifications).where(baseFilter).groupBy(notifications.status);

    const counts = Object.fromEntries(rows.map(r => [r.status, Number(r.count)]));
    return {
      open: counts['open'] ?? 0,
      inProgress: counts['in_progress'] ?? 0,
      resolved: counts['resolved'] ?? 0,
      escalated: counts['escalated'] ?? 0,
    };
  }

  async getAnalyticsTrends(days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const washTrends = await db.select({
      date: sql<string>`date(${washQueue.createdAt})`,
      count: sql<number>`count(*)`,
    }).from(washQueue).where(gte(washQueue.createdAt, since)).groupBy(sql`date(${washQueue.createdAt})`).orderBy(sql`date(${washQueue.createdAt})`);

    const evidenceTrends = await db.select({
      date: sql<string>`date(${vehicleEvidence.createdAt})`,
      count: sql<number>`count(*)`,
    }).from(vehicleEvidence).where(gte(vehicleEvidence.createdAt, since)).groupBy(sql`date(${vehicleEvidence.createdAt})`).orderBy(sql`date(${vehicleEvidence.createdAt})`);

    const notifTrends = await db.select({
      date: sql<string>`date(${notifications.createdAt})`,
      count: sql<number>`count(*)`,
    }).from(notifications).where(gte(notifications.createdAt, since)).groupBy(sql`date(${notifications.createdAt})`).orderBy(sql`date(${notifications.createdAt})`);

    // Merge into unified date series
    const dateMap = new Map<string, { washes: number; evidence: number; notifications: number }>();
    for (let d = new Date(since); d <= new Date(); d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      dateMap.set(key, { washes: 0, evidence: 0, notifications: 0 });
    }
    for (const r of washTrends) dateMap.set(r.date, { ...dateMap.get(r.date)!, washes: Number(r.count) });
    for (const r of evidenceTrends) dateMap.set(r.date, { ...dateMap.get(r.date)!, evidence: Number(r.count) });
    for (const r of notifTrends) dateMap.set(r.date, { ...dateMap.get(r.date)!, notifications: Number(r.count) });

    return Array.from(dateMap.entries()).map(([date, data]) => ({ date, ...data }));
  }

  async getDigitalTwinTimeline(stationId?: number, from?: string, to?: string) {
    const conditions = [];
    if (stationId) conditions.push(eq(digitalTwinSnapshots.stationId, stationId));
    if (from) conditions.push(gte(digitalTwinSnapshots.createdAt, new Date(from)));
    if (to) conditions.push(sql`${digitalTwinSnapshots.createdAt} <= ${new Date(to)}`);

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    return db.select().from(digitalTwinSnapshots).where(where).orderBy(desc(digitalTwinSnapshots.createdAt)).limit(200);
  }

  async getVehicleTrends(vehicleId: number) {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [washCount] = await db.select({ count: sql<number>`count(*)` }).from(washQueue)
      .where(and(eq(washQueue.vehiclePlate, sql`(SELECT plate FROM vehicles WHERE id = ${vehicleId})`)));

    const [evidenceCount] = await db.select({ count: sql<number>`count(*)` }).from(vehicleEvidence)
      .where(eq(vehicleEvidence.vehicleId, vehicleId));

    const recentWashes = await db.select({
      date: sql<string>`date(${washQueue.createdAt})`,
      count: sql<number>`count(*)`,
    }).from(washQueue)
      .where(and(
        eq(washQueue.vehiclePlate, sql`(SELECT plate FROM vehicles WHERE id = ${vehicleId})`),
        gte(washQueue.createdAt, since)
      ))
      .groupBy(sql`date(${washQueue.createdAt})`)
      .orderBy(sql`date(${washQueue.createdAt})`);

    const recentEvidence = await db.select({
      date: sql<string>`date(${vehicleEvidence.createdAt})`,
      count: sql<number>`count(*)`,
    }).from(vehicleEvidence)
      .where(and(eq(vehicleEvidence.vehicleId, vehicleId), gte(vehicleEvidence.createdAt, since)))
      .groupBy(sql`date(${vehicleEvidence.createdAt})`)
      .orderBy(sql`date(${vehicleEvidence.createdAt})`);

    const topZones = await db.select({
      zone: sql<string>`${vehicleEvidence.metadata}->>'zone'`,
      count: sql<number>`count(*)`,
    }).from(vehicleEvidence)
      .where(and(eq(vehicleEvidence.vehicleId, vehicleId), sql`${vehicleEvidence.metadata}->>'zone' IS NOT NULL`))
      .groupBy(sql`${vehicleEvidence.metadata}->>'zone'`)
      .orderBy(sql`count(*) desc`)
      .limit(5);

    return {
      totalWashes: Number(washCount.count),
      totalEvidence: Number(evidenceCount.count),
      recentWashes: recentWashes.map(r => ({ date: r.date, count: Number(r.count) })),
      recentEvidence: recentEvidence.map(r => ({ date: r.date, count: Number(r.count) })),
      topZones: topZones.map(r => ({ zone: r.zone ?? 'unknown', count: Number(r.count) })),
    };
  }

  async testAutomationRule(id: number) {
    const rule = await this.getAutomationRule(id);
    if (!rule) return { valid: false, errors: ['Rule not found'], matchingEntities: 0 };

    const errors: string[] = [];
    if (!rule.trigger) errors.push('Missing trigger type');
    if (!rule.name?.trim()) errors.push('Missing rule name');

    const validTriggers = ['wash_completed', 'vehicle_status_change', 'evidence_uploaded', 'shift_started', 'queue_threshold', 'timer', 'manual'];
    if (rule.trigger && !validTriggers.includes(rule.trigger)) {
      errors.push(`Unknown trigger type: ${rule.trigger}`);
    }

    if (rule.actions && Array.isArray(rule.actions)) {
      const validActions = ['send_notification', 'update_vehicle_status', 'assign_wash', 'create_room', 'log_event'];
      for (const action of rule.actions) {
        const actionType = (action as Record<string, unknown>).type as string | undefined;
        if (!actionType) errors.push('Action missing type');
        else if (!validActions.includes(actionType)) errors.push(`Unknown action type: ${actionType}`);
      }
    }

    // Count entities that match the trigger's scope
    let matchingEntities = 0;
    if (rule.trigger === 'wash_completed' || rule.trigger === 'queue_threshold') {
      const [r] = await db.select({ count: sql<number>`count(*)` }).from(washQueue);
      matchingEntities = Number(r.count);
    } else if (rule.trigger === 'vehicle_status_change') {
      const [r] = await db.select({ count: sql<number>`count(*)` }).from(vehicles).where(isNull(vehicles.deletedAt));
      matchingEntities = Number(r.count);
    } else if (rule.trigger === 'evidence_uploaded') {
      const [r] = await db.select({ count: sql<number>`count(*)` }).from(vehicleEvidence);
      matchingEntities = Number(r.count);
    }

    return { valid: errors.length === 0, errors, matchingEntities };
  }

  // ─── WORKSPACE PROPOSALS ───
  async getProposals(userId?: number, status?: string) {
    const conditions = [];
    if (userId) conditions.push(eq(workspaceProposals.userId, userId));
    if (status) conditions.push(eq(workspaceProposals.status, status));
    if (conditions.length === 0) return db.select().from(workspaceProposals).orderBy(desc(workspaceProposals.createdAt));
    if (conditions.length === 1) return db.select().from(workspaceProposals).where(conditions[0]).orderBy(desc(workspaceProposals.createdAt));
    return db.select().from(workspaceProposals).where(and(...conditions)).orderBy(desc(workspaceProposals.createdAt));
  }
  async getProposal(id: number) {
    const [p] = await db.select().from(workspaceProposals).where(eq(workspaceProposals.id, id));
    return p;
  }
  async createProposal(data: InsertWorkspaceProposal) {
    const [p] = await db.insert(workspaceProposals).values(data).returning();
    return p;
  }
  async updateProposal(id: number, data: Partial<WorkspaceProposal>) {
    const { id: _id, ...rest } = data;
    const [p] = await db.update(workspaceProposals).set({ ...rest, updatedAt: new Date() }).where(eq(workspaceProposals.id, id)).returning();
    return p;
  }

  // Week-1 stabilization: feedback
  async createFeedback(data: InsertFeedback) {
    const [f] = await db.insert(feedback).values(data).returning();
    return f;
  }
  async getFeedback() {
    return db.select().from(feedback).orderBy(desc(feedback.createdAt));
  }
}

export const storage = new DatabaseStorage();
