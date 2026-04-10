import { db, eq, desc, and, isNull, wsFilter, wsInsert } from "./base.js";
import {
  stationPositions, type InsertStationPosition,
  positionAssignments, type InsertPositionAssignment,
  vehicleTransfers, type InsertVehicleTransfer,
} from "../../shared/schema.js";

export class PositionStorage {
  // ─── Station Positions ───
  async getStationPositions(stationId?: number) {
    const conditions = [wsFilter(stationPositions)];
    if (stationId !== undefined) conditions.push(eq(stationPositions.stationId, stationId));
    return db.select().from(stationPositions).where(and(...conditions));
  }
  async getStationPosition(id: number) {
    const [p] = await db.select().from(stationPositions).where(and(eq(stationPositions.id, id), wsFilter(stationPositions)));
    return p;
  }
  async createStationPosition(data: InsertStationPosition) {
    const [p] = await db.insert(stationPositions).values(wsInsert(data)).returning();
    return p;
  }
  async updateStationPosition(id: number, data: Partial<InsertStationPosition>) {
    const [p] = await db.update(stationPositions).set(data).where(and(eq(stationPositions.id, id), wsFilter(stationPositions))).returning();
    return p;
  }
  async deleteStationPosition(id: number) {
    await db.delete(stationPositions).where(and(eq(stationPositions.id, id), wsFilter(stationPositions)));
  }

  // ─── Position Assignments ───
  async getPositionAssignments(positionId?: number) {
    const conditions = [wsFilter(positionAssignments)];
    if (positionId !== undefined) conditions.push(eq(positionAssignments.positionId, positionId));
    return db.select().from(positionAssignments).where(and(...conditions)).orderBy(desc(positionAssignments.assignedAt));
  }
  async getActiveAssignments(positionId: number) {
    return db.select().from(positionAssignments).where(and(
      eq(positionAssignments.positionId, positionId),
      isNull(positionAssignments.releasedAt),
      wsFilter(positionAssignments),
    ));
  }
  async getVehicleAssignment(vehicleId: number) {
    const [a] = await db.select().from(positionAssignments).where(and(
      eq(positionAssignments.vehicleId, vehicleId),
      isNull(positionAssignments.releasedAt),
      wsFilter(positionAssignments),
    ));
    return a;
  }
  async createPositionAssignment(data: InsertPositionAssignment) {
    const [a] = await db.insert(positionAssignments).values(wsInsert(data)).returning();
    return a;
  }
  async releasePositionAssignment(id: number) {
    const [a] = await db.update(positionAssignments)
      .set({ releasedAt: new Date() })
      .where(and(eq(positionAssignments.id, id), wsFilter(positionAssignments)))
      .returning();
    return a;
  }

  // ─── Vehicle Transfers ───
  async getVehicleTransfers(filters?: { vehicleId?: number; fromStationId?: number; toStationId?: number; status?: string }) {
    const conditions = [wsFilter(vehicleTransfers)];
    if (filters?.vehicleId) conditions.push(eq(vehicleTransfers.vehicleId, filters.vehicleId));
    if (filters?.fromStationId) conditions.push(eq(vehicleTransfers.fromStationId, filters.fromStationId));
    if (filters?.toStationId) conditions.push(eq(vehicleTransfers.toStationId, filters.toStationId));
    if (filters?.status) conditions.push(eq(vehicleTransfers.status, filters.status));
    return db.select().from(vehicleTransfers).where(and(...conditions)).orderBy(desc(vehicleTransfers.createdAt));
  }
  async getVehicleTransfer(id: number) {
    const [t] = await db.select().from(vehicleTransfers).where(and(eq(vehicleTransfers.id, id), wsFilter(vehicleTransfers)));
    return t;
  }
  async createVehicleTransfer(data: InsertVehicleTransfer) {
    const [t] = await db.insert(vehicleTransfers).values(wsInsert(data)).returning();
    return t;
  }
  async updateVehicleTransfer(id: number, data: Partial<InsertVehicleTransfer>) {
    const [t] = await db.update(vehicleTransfers).set({ ...data, updatedAt: new Date() }).where(and(eq(vehicleTransfers.id, id), wsFilter(vehicleTransfers))).returning();
    return t;
  }
}
