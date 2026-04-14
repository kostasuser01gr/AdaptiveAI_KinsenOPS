import { db, eq, desc, and, isNull , wsFilter, wsInsert, inArray} from "./base.js";
import {
  repairOrders, type RepairOrder, type InsertRepairOrder,
  downtimeEvents, type DowntimeEvent, type InsertDowntimeEvent,
} from "../../shared/schema.js";

export class RepairStorage {
  // ── Repair orders ──
  async getRepairOrders(filters?: { vehicleId?: number; incidentId?: number; status?: string; stationId?: number; stationIds?: number[] }) {
    const conditions = [];
    if (filters?.vehicleId) conditions.push(eq(repairOrders.vehicleId, filters.vehicleId));
    if (filters?.incidentId) conditions.push(eq(repairOrders.incidentId, filters.incidentId));
    if (filters?.status) conditions.push(eq(repairOrders.status, filters.status));
    if (filters?.stationIds?.length) conditions.push(inArray(repairOrders.stationId, filters.stationIds));
    else if (filters?.stationId) conditions.push(eq(repairOrders.stationId, filters.stationId));
    if (conditions.length === 0) return db.select().from(repairOrders).where(wsFilter(repairOrders)).orderBy(desc(repairOrders.createdAt));
    if (conditions.length === 1) return db.select().from(repairOrders).where(and(conditions[0], wsFilter(repairOrders))).orderBy(desc(repairOrders.createdAt));
    return db.select().from(repairOrders).where(and(...conditions, wsFilter(repairOrders))).orderBy(desc(repairOrders.createdAt));
  }
  async getRepairOrder(id: number) {
    const [r] = await db.select().from(repairOrders).where(and(eq(repairOrders.id, id), wsFilter(repairOrders)));
    return r;
  }
  async createRepairOrder(data: InsertRepairOrder) {
    const [r] = await db.insert(repairOrders).values(wsInsert(data)).returning();
    return r;
  }
  async updateRepairOrder(id: number, data: Partial<RepairOrder>) {
    const { id: _id, ...rest } = data;
    const [r] = await db.update(repairOrders).set({ ...rest, updatedAt: new Date() }).where(and(eq(repairOrders.id, id), wsFilter(repairOrders))).returning();
    return r;
  }

  // ── Downtime events ──
  async getDowntimeEvents(filters?: { vehicleId?: number; reason?: string; open?: boolean }) {
    const conditions = [];
    if (filters?.vehicleId) conditions.push(eq(downtimeEvents.vehicleId, filters.vehicleId));
    if (filters?.reason) conditions.push(eq(downtimeEvents.reason, filters.reason));
    if (filters?.open) conditions.push(isNull(downtimeEvents.endedAt));
    if (conditions.length === 0) return db.select().from(downtimeEvents).where(wsFilter(downtimeEvents)).orderBy(desc(downtimeEvents.startedAt));
    if (conditions.length === 1) return db.select().from(downtimeEvents).where(and(conditions[0], wsFilter(downtimeEvents))).orderBy(desc(downtimeEvents.startedAt));
    return db.select().from(downtimeEvents).where(and(...conditions, wsFilter(downtimeEvents))).orderBy(desc(downtimeEvents.startedAt));
  }
  async getDowntimeEvent(id: number) {
    const [d] = await db.select().from(downtimeEvents).where(and(eq(downtimeEvents.id, id), wsFilter(downtimeEvents)));
    return d;
  }
  async createDowntimeEvent(data: InsertDowntimeEvent) {
    const [d] = await db.insert(downtimeEvents).values(wsInsert(data)).returning();
    return d;
  }
  async updateDowntimeEvent(id: number, data: Partial<DowntimeEvent>) {
    const { id: _id, ...rest } = data;
    const [d] = await db.update(downtimeEvents).set(rest).where(and(eq(downtimeEvents.id, id), wsFilter(downtimeEvents))).returning();
    return d;
  }
}
