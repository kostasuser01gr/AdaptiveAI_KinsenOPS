import { db, eq, desc, and , wsFilter, wsInsert, inArray} from "./base.js";
import {
  reservations, type Reservation, type InsertReservation,
} from "../../shared/schema.js";

export class ReservationStorage {
  async getReservations(filters?: { vehicleId?: number; stationId?: number; stationIds?: number[]; status?: string }) {
    const conditions = [];
    if (filters?.vehicleId) conditions.push(eq(reservations.vehicleId, filters.vehicleId));
    if (filters?.stationIds?.length) conditions.push(inArray(reservations.stationId, filters.stationIds));
    else if (filters?.stationId) conditions.push(eq(reservations.stationId, filters.stationId));
    if (filters?.status) conditions.push(eq(reservations.status, filters.status));
    if (conditions.length === 0) return db.select().from(reservations).where(wsFilter(reservations)).orderBy(desc(reservations.pickupDate));
    if (conditions.length === 1) return db.select().from(reservations).where(and(conditions[0], wsFilter(reservations))).orderBy(desc(reservations.pickupDate));
    return db.select().from(reservations).where(and(...conditions, wsFilter(reservations))).orderBy(desc(reservations.pickupDate));
  }
  async getReservation(id: number) {
    const [r] = await db.select().from(reservations).where(and(eq(reservations.id, id), wsFilter(reservations)));
    return r;
  }
  async createReservation(data: InsertReservation) {
    const [r] = await db.insert(reservations).values(wsInsert(data)).returning();
    return r;
  }
  async updateReservation(id: number, data: Partial<Reservation>) {
    const { id: _id, ...rest } = data;
    const [r] = await db.update(reservations).set({ ...rest, updatedAt: new Date() }).where(and(eq(reservations.id, id), wsFilter(reservations))).returning();
    return r;
  }
}
