/**
 * Usage metering storage domain module (Phase 4.2A).
 * Append-only event recording + daily rollup management.
 */
import { db, eq, and, sql, gte, lt, desc } from "./base.js";
import {
  usageEvents,
  usageDailyRollups,
  type UsageEvent,
  type InsertUsageEvent,
  type UsageDailyRollup,
  type InsertUsageDailyRollup,
} from "../../shared/schema.js";

export class MeteringStorage {
  /**
   * Record a usage event. If idempotencyKey is provided and already exists, returns existing row.
   */
  async recordUsageEvent(data: InsertUsageEvent): Promise<UsageEvent> {
    if (data.idempotencyKey) {
      const [existing] = await db
        .select()
        .from(usageEvents)
        .where(eq(usageEvents.idempotencyKey, data.idempotencyKey));
      if (existing) return existing;
    }
    const [row] = await db.insert(usageEvents).values(data).returning();
    return row;
  }

  /**
   * Get usage events with optional filters.
   */
  async getUsageEvents(filters?: {
    workspaceId?: string;
    feature?: string;
    userId?: number;
    from?: Date;
    to?: Date;
    limit?: number;
  }): Promise<UsageEvent[]> {
    const conditions = [];
    if (filters?.workspaceId) conditions.push(eq(usageEvents.workspaceId, filters.workspaceId));
    if (filters?.feature) conditions.push(eq(usageEvents.feature, filters.feature));
    if (filters?.userId) conditions.push(eq(usageEvents.userId, filters.userId));
    if (filters?.from) conditions.push(gte(usageEvents.createdAt, filters.from));
    if (filters?.to) conditions.push(lt(usageEvents.createdAt, filters.to));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const query = db.select().from(usageEvents);
    const limited = where
      ? query.where(where).orderBy(desc(usageEvents.createdAt)).limit(filters?.limit ?? 1000)
      : query.orderBy(desc(usageEvents.createdAt)).limit(filters?.limit ?? 1000);
    return limited;
  }

  /**
   * Increment a daily rollup counter (upsert).
   */
  async incrementDailyRollup(workspaceId: string, feature: string, date: string, increment = 1): Promise<UsageDailyRollup> {
    const [row] = await db
      .insert(usageDailyRollups)
      .values({ workspaceId, feature, date, count: increment })
      .onConflictDoUpdate({
        target: [usageDailyRollups.workspaceId, usageDailyRollups.feature, usageDailyRollups.date],
        set: {
          count: sql`${usageDailyRollups.count} + ${increment}`,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  /**
   * Get daily rollup data for reporting.
   */
  async getDailyRollups(filters?: {
    workspaceId?: string;
    feature?: string;
    from?: string;
    to?: string;
  }): Promise<UsageDailyRollup[]> {
    const conditions = [];
    if (filters?.workspaceId) conditions.push(eq(usageDailyRollups.workspaceId, filters.workspaceId));
    if (filters?.feature) conditions.push(eq(usageDailyRollups.feature, filters.feature));
    if (filters?.from) conditions.push(gte(usageDailyRollups.date, filters.from));
    if (filters?.to) conditions.push(lt(usageDailyRollups.date, filters.to));

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const query = db.select().from(usageDailyRollups);
    return where
      ? query.where(where).orderBy(desc(usageDailyRollups.date))
      : query.orderBy(desc(usageDailyRollups.date));
  }

  /**
   * Get total usage count for a feature in a workspace within a date range.
   */
  async getUsageTotal(workspaceId: string, feature: string, from?: string, to?: string): Promise<number> {
    const conditions = [
      eq(usageDailyRollups.workspaceId, workspaceId),
      eq(usageDailyRollups.feature, feature),
    ];
    if (from) conditions.push(gte(usageDailyRollups.date, from));
    if (to) conditions.push(lt(usageDailyRollups.date, to));

    const [result] = await db
      .select({ total: sql<number>`COALESCE(SUM(${usageDailyRollups.count}), 0)` })
      .from(usageDailyRollups)
      .where(and(...conditions));
    return Number(result?.total ?? 0);
  }
}
