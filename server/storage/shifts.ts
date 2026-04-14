import { db, eq, desc, and , wsFilter, wsInsert} from "./base.js";
import {
  shifts, type InsertShift,
  shiftRequests, type InsertShiftRequest,
} from "../../shared/schema.js";

export class ShiftStorage {
  async getShifts(weekStart?: string) {
    if (weekStart) return db.select().from(shifts).where(and(eq(shifts.weekStart, weekStart), wsFilter(shifts)));
    return db.select().from(shifts).where(wsFilter(shifts));
  }
  async getPublishedShifts(weekStart?: string) {
    if (weekStart) return db.select().from(shifts).where(and(eq(shifts.status, 'published'), eq(shifts.weekStart, weekStart), wsFilter(shifts)));
    return db.select().from(shifts).where(and(eq(shifts.status, 'published'), wsFilter(shifts)));
  }
  async createShift(data: InsertShift) {
    const [s] = await db.insert(shifts).values(wsInsert(data)).returning();
    return s;
  }
  async updateShift(id: number, data: Partial<InsertShift>) {
    const [s] = await db.update(shifts).set(data).where(and(eq(shifts.id, id), wsFilter(shifts))).returning();
    return s;
  }
  async publishShift(id: number, publishedBy: number) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- publishedAt/publishedBy absent from insert schema
    const [s] = await db.update(shifts).set({ status: 'published', publishedBy, publishedAt: new Date() } as any).where(and(eq(shifts.id, id), wsFilter(shifts))).returning();
    return s;
  }
  async deleteShift(id: number) { await db.delete(shifts).where(and(eq(shifts.id, id), wsFilter(shifts))); }

  async getShiftRequests(userId?: number) {
    if (userId) return db.select().from(shiftRequests).where(and(eq(shiftRequests.userId, userId), wsFilter(shiftRequests))).orderBy(desc(shiftRequests.createdAt));
    return db.select().from(shiftRequests).where(wsFilter(shiftRequests)).orderBy(desc(shiftRequests.createdAt));
  }
  async createShiftRequest(data: InsertShiftRequest) {
    const [req] = await db.insert(shiftRequests).values(wsInsert(data)).returning();
    return req;
  }
  async reviewShiftRequest(id: number, reviewedBy: number, status: string, note?: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- reviewedAt/reviewNote absent from insert schema
    const [req] = await db.update(shiftRequests).set({ status, reviewedBy, reviewNote: note || null, reviewedAt: new Date() } as any).where(and(eq(shiftRequests.id, id), eq(shiftRequests.status, 'pending'), wsFilter(shiftRequests))).returning();
    return req;
  }
}
