import { db, eq, desc, or, sql , wsFilter, wsInsert, and} from "./base.js";
import {
  notifications, type InsertNotification,
  notificationReads,
} from "../../shared/schema.js";

export class NotificationStorage {
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
      .where(and(or(...conditions), wsFilter(notifications)))
      .orderBy(desc(notifications.createdAt))
      .limit(200);

    return results.map(n => ({ ...n, read: readIdSet.has(n.id) }));
  }

  async createNotification(data: InsertNotification) {
    const [n] = await db.insert(notifications).values(wsInsert(data)).returning();
    return n;
  }

  async updateNotification(id: number, data: Partial<InsertNotification>) {
    const [n] = await db.update(notifications).set(data).where(and(eq(notifications.id, id), wsFilter(notifications))).returning();
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
      .where(and(or(...conditions), wsFilter(notifications)));
    if (visible.length === 0) return;
    const values = visible.map(n => ({ notificationId: n.id, userId }));
    await db.insert(notificationReads).values(values).onConflictDoNothing();
  }

  async getNotificationStats(userId: number, role: string, stationId?: number) {
    const baseFilter = role === 'admin'
      ? sql`true`
      : sql`(${notifications.audience} = 'broadcast' OR ${notifications.recipientUserId} = ${userId} OR ${notifications.recipientRole} = ${role}${stationId ? sql` OR ${notifications.recipientStationId} = ${stationId}` : sql``})`;

    const rows = await db.select({
      status: notifications.status,
      count: sql<number>`count(*)`,
    }).from(notifications).where(and(baseFilter, wsFilter(notifications))).groupBy(notifications.status);

    const counts = Object.fromEntries(rows.map(r => [r.status, Number(r.count)]));
    return {
      open: counts['open'] ?? 0,
      inProgress: counts['in_progress'] ?? 0,
      resolved: counts['resolved'] ?? 0,
      escalated: counts['escalated'] ?? 0,
    };
  }
}
