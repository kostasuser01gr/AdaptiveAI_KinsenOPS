import { db, eq, desc, and , wsFilter, wsInsert} from "./base.js";
import {
  entityRooms, type InsertEntityRoom,
  roomMessages, type InsertRoomMessage,
  workspaceMemory, type InsertWorkspaceMemory,
  digitalTwinSnapshots, type InsertDigitalTwinSnapshot,
  systemPolicies, type InsertSystemPolicy,
  activityFeed, type InsertActivityFeed,
  moduleRegistry, type InsertModuleRegistry,
  workspaceConfig, type InsertWorkspaceConfig,
  workspaceProposals, type WorkspaceProposal, type InsertWorkspaceProposal,
  feedback, type InsertFeedback,
} from "../../shared/schema.js";
import { gte, sql } from "drizzle-orm";

export class WorkspaceStorage {
  // ── Entity rooms ──
  async getEntityRooms(entityType?: string) {
    if (entityType) return db.select().from(entityRooms).where(and(eq(entityRooms.entityType, entityType), wsFilter(entityRooms))).orderBy(desc(entityRooms.createdAt));
    return db.select().from(entityRooms).where(wsFilter(entityRooms)).orderBy(desc(entityRooms.createdAt));
  }
  async getEntityRoom(id: number) {
    const [room] = await db.select().from(entityRooms).where(and(eq(entityRooms.id, id), wsFilter(entityRooms)));
    return room;
  }
  async getEntityRoomByEntity(entityType: string, entityId: string) {
    const [room] = await db.select().from(entityRooms)
      .where(and(eq(entityRooms.entityType, entityType), eq(entityRooms.entityId, entityId), wsFilter(entityRooms)));
    return room;
  }
  async createEntityRoom(data: InsertEntityRoom) {
    const [room] = await db.insert(entityRooms).values(wsInsert(data)).returning();
    return room;
  }
  async updateEntityRoom(id: number, data: Partial<InsertEntityRoom>) {
    const [room] = await db.update(entityRooms).set(data).where(and(eq(entityRooms.id, id), wsFilter(entityRooms))).returning();
    return room;
  }

  // ── Room messages ──
  async getRoomMessages(roomId: number) {
    return db.select().from(roomMessages).where(eq(roomMessages.roomId, roomId)).orderBy(roomMessages.createdAt);
  }
  async createRoomMessage(data: InsertRoomMessage) {
    const [msg] = await db.insert(roomMessages).values(data).returning();
    return msg;
  }

  // ── Workspace memory ──
  async getWorkspaceMemory(category?: string) {
    if (category) return db.select().from(workspaceMemory).where(and(eq(workspaceMemory.category, category), wsFilter(workspaceMemory))).orderBy(desc(workspaceMemory.updatedAt));
    return db.select().from(workspaceMemory).where(wsFilter(workspaceMemory)).orderBy(desc(workspaceMemory.updatedAt));
  }
  async createWorkspaceMemory(data: InsertWorkspaceMemory) {
    const [m] = await db.insert(workspaceMemory).values(wsInsert(data)).returning();
    return m;
  }
  async updateWorkspaceMemory(id: number, data: Partial<InsertWorkspaceMemory>) {
    const [m] = await db.update(workspaceMemory).set({ ...data, updatedAt: new Date() }).where(and(eq(workspaceMemory.id, id), wsFilter(workspaceMemory))).returning();
    return m;
  }

  // ── Digital twin ──
  async getDigitalTwinSnapshots(stationId?: number) {
    if (stationId) return db.select().from(digitalTwinSnapshots).where(and(eq(digitalTwinSnapshots.stationId, stationId), wsFilter(digitalTwinSnapshots))).orderBy(desc(digitalTwinSnapshots.createdAt)).limit(50);
    return db.select().from(digitalTwinSnapshots).where(wsFilter(digitalTwinSnapshots)).orderBy(desc(digitalTwinSnapshots.createdAt)).limit(50);
  }
  async createDigitalTwinSnapshot(data: InsertDigitalTwinSnapshot) {
    const [s] = await db.insert(digitalTwinSnapshots).values(wsInsert(data)).returning();
    return s;
  }
  async getDigitalTwinTimeline(stationId?: number, from?: string, to?: string) {
    const conditions = [];
    if (stationId) conditions.push(eq(digitalTwinSnapshots.stationId, stationId));
    if (from) conditions.push(gte(digitalTwinSnapshots.createdAt, new Date(from)));
    if (to) conditions.push(sql`${digitalTwinSnapshots.createdAt} <= ${new Date(to)}`);
    conditions.push(wsFilter(digitalTwinSnapshots));
    const where = and(...conditions);
    return db.select().from(digitalTwinSnapshots).where(where).orderBy(desc(digitalTwinSnapshots.createdAt)).limit(200);
  }

  // ── System policies ──
  async getSystemPolicies(category?: string) {
    if (category) return db.select().from(systemPolicies).where(and(eq(systemPolicies.category, category), wsFilter(systemPolicies))).orderBy(desc(systemPolicies.createdAt));
    return db.select().from(systemPolicies).where(wsFilter(systemPolicies)).orderBy(desc(systemPolicies.createdAt));
  }
  async createSystemPolicy(data: InsertSystemPolicy) {
    const [p] = await db.insert(systemPolicies).values(wsInsert(data)).returning();
    return p;
  }
  async updateSystemPolicy(id: number, data: Partial<InsertSystemPolicy>) {
    const [p] = await db.update(systemPolicies).set({ ...data, updatedAt: new Date() }).where(and(eq(systemPolicies.id, id), wsFilter(systemPolicies))).returning();
    return p;
  }
  async deleteSystemPolicy(id: number) {
    await db.delete(systemPolicies).where(and(eq(systemPolicies.id, id), wsFilter(systemPolicies)));
  }

  // ── Activity feed ──
  async getActivityFeed(limit = 50) {
    return db.select().from(activityFeed).where(wsFilter(activityFeed)).orderBy(desc(activityFeed.createdAt)).limit(limit);
  }
  async createActivityEntry(data: InsertActivityFeed) {
    const [entry] = await db.insert(activityFeed).values(wsInsert(data)).returning();
    return entry;
  }

  // ── Module registry ──
  async getModuleRegistry() {
    return db.select().from(moduleRegistry).where(wsFilter(moduleRegistry)).orderBy(moduleRegistry.order);
  }
  async createModuleEntry(data: InsertModuleRegistry) {
    const [m] = await db.insert(moduleRegistry).values(wsInsert(data)).returning();
    return m;
  }
  async updateModuleEntry(id: number, data: Partial<InsertModuleRegistry>) {
    const [m] = await db.update(moduleRegistry).set(data).where(and(eq(moduleRegistry.id, id), wsFilter(moduleRegistry))).returning();
    return m;
  }

  // ── Workspace config ──
  async getWorkspaceConfig(category?: string) {
    if (category) return db.select().from(workspaceConfig).where(and(eq(workspaceConfig.category, category), wsFilter(workspaceConfig)));
    return db.select().from(workspaceConfig).where(wsFilter(workspaceConfig));
  }
  async getWorkspaceConfigByKey(key: string) {
    const [c] = await db.select().from(workspaceConfig).where(and(eq(workspaceConfig.key, key), wsFilter(workspaceConfig)));
    return c;
  }
  async setWorkspaceConfig(data: InsertWorkspaceConfig) {
    const existing = await db.select().from(workspaceConfig).where(and(eq(workspaceConfig.key, data.key), wsFilter(workspaceConfig)));
    if (existing.length > 0) {
      const [c] = await db.update(workspaceConfig).set({ value: data.value, updatedBy: data.updatedBy, updatedAt: new Date() }).where(and(eq(workspaceConfig.id, existing[0].id), wsFilter(workspaceConfig))).returning();
      return c;
    }
    const [c] = await db.insert(workspaceConfig).values(wsInsert(data)).returning();
    return c;
  }
  async deleteWorkspaceConfigByKey(key: string) {
    await db.delete(workspaceConfig).where(and(eq(workspaceConfig.key, key), wsFilter(workspaceConfig)));
  }

  // ── Proposals ──
  async getProposals(userId?: number, status?: string) {
    const conditions = [];
    if (userId) conditions.push(eq(workspaceProposals.userId, userId));
    if (status) conditions.push(eq(workspaceProposals.status, status));
    if (conditions.length === 0) return db.select().from(workspaceProposals).where(wsFilter(workspaceProposals)).orderBy(desc(workspaceProposals.createdAt));
    if (conditions.length === 1) return db.select().from(workspaceProposals).where(and(conditions[0], wsFilter(workspaceProposals))).orderBy(desc(workspaceProposals.createdAt));
    return db.select().from(workspaceProposals).where(and(...conditions, wsFilter(workspaceProposals))).orderBy(desc(workspaceProposals.createdAt));
  }
  async getProposal(id: number) {
    const [p] = await db.select().from(workspaceProposals).where(and(eq(workspaceProposals.id, id), wsFilter(workspaceProposals)));
    return p;
  }
  async createProposal(data: InsertWorkspaceProposal) {
    const [p] = await db.insert(workspaceProposals).values(wsInsert(data)).returning();
    return p;
  }
  async updateProposal(id: number, data: Partial<WorkspaceProposal>) {
    const { id: _id, ...rest } = data;
    const [p] = await db.update(workspaceProposals).set({ ...rest, updatedAt: new Date() }).where(and(eq(workspaceProposals.id, id), wsFilter(workspaceProposals))).returning();
    return p;
  }

  // ── Feedback ──
  async createFeedback(data: InsertFeedback) {
    const [f] = await db.insert(feedback).values(wsInsert(data)).returning();
    return f;
  }
  async getFeedback() {
    return db.select().from(feedback).where(wsFilter(feedback)).orderBy(desc(feedback.createdAt));
  }
}
