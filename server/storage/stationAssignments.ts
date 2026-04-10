/**
 * User station assignment storage domain module (Phase 4.2A).
 * Multi-station assignment management + backward-compatible scope resolution.
 */
import { db, eq, and, wsFilter, wsInsert} from "./base.js";
import {
  userStationAssignments,
  users,
  type UserStationAssignment,
  type InsertUserStationAssignment,
} from "../../shared/schema.js";

export class StationAssignmentStorage {
  /**
   * Get all station assignments for a user.
   */
  async getUserStationAssignments(userId: number): Promise<UserStationAssignment[]> {
    return db
      .select()
      .from(userStationAssignments)
      .where(and(eq(userStationAssignments.userId, userId), wsFilter(userStationAssignments)));
  }

  /**
   * Get all users assigned to a station.
   */
  async getStationUsers(stationId: number): Promise<UserStationAssignment[]> {
    return db
      .select()
      .from(userStationAssignments)
      .where(and(eq(userStationAssignments.stationId, stationId), wsFilter(userStationAssignments)));
  }

  /**
   * Assign a user to a station (idempotent via unique constraint).
   */
  async assignUserToStation(data: InsertUserStationAssignment): Promise<UserStationAssignment> {
    const [existing] = await db
      .select()
      .from(userStationAssignments)
      .where(and(
        eq(userStationAssignments.userId, data.userId),
        eq(userStationAssignments.stationId, data.stationId),
        wsFilter(userStationAssignments)));
    if (existing) {
      // Update isPrimary if it changed
      if (existing.isPrimary !== (data.isPrimary ?? false)) {
        const [row] = await db
          .update(userStationAssignments)
          .set({ isPrimary: data.isPrimary ?? false })
          .where(and(eq(userStationAssignments.id, existing.id), wsFilter(userStationAssignments)))
          .returning();
        return row;
      }
      return existing;
    }
    const [row] = await db.insert(userStationAssignments).values(wsInsert(data)).returning();
    return row;
  }

  /**
   * Remove a user from a station.
   */
  async removeUserFromStation(userId: number, stationId: number): Promise<void> {
    await db
      .delete(userStationAssignments)
      .where(and(
        eq(userStationAssignments.userId, userId),
        eq(userStationAssignments.stationId, stationId),
        wsFilter(userStationAssignments),
      ));
  }

  /**
   * Replace all station assignments for a user with a new set.
   */
  async setUserStations(userId: number, stationIds: number[], assignedBy?: number): Promise<UserStationAssignment[]> {
    // Remove all existing
    await db.delete(userStationAssignments).where(and(eq(userStationAssignments.userId, userId), wsFilter(userStationAssignments)));
    if (stationIds.length === 0) return [];
    // Insert new — first is primary
    const values = stationIds.map((stationId, i) => ({
      userId,
      stationId,
      isPrimary: i === 0,
      assignedBy,
    }));
    return db.insert(userStationAssignments).values(values.map(v => wsInsert(v))).returning();
  }

  /**
   * Resolve effective station IDs for a user.
   * Priority: explicit assignments > legacy users.station > empty set.
   */
  async resolveUserStationIds(userId: number): Promise<number[]> {
    // 1. Check explicit assignments
    const assignments = await this.getUserStationAssignments(userId);
    if (assignments.length > 0) {
      return assignments.map((a) => a.stationId);
    }
    // 2. Fallback to legacy users.station
    const [user] = await db.select({ station: users.station }).from(users).where(and(eq(users.id, userId), wsFilter(users)));
    if (user?.station) {
      const parsed = parseInt(user.station, 10);
      if (!isNaN(parsed)) return [parsed];
    }
    // 3. No station scope
    return [];
  }
}
