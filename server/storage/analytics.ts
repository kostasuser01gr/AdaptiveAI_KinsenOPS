import { db, eq, desc, and, sql, isNull, gte, or , wsFilter, wsInsert} from "./base.js";
import {
  vehicles, washQueue, shifts, users, stations,
  automationRules, entityRooms, notifications, shiftRequests,
  vehicleEvidence,
} from "../../shared/schema.js";

export class AnalyticsStorage {
  async getDashboardStats() {
    const [vehicleCount] = await db.select({ count: sql<number>`count(*)` }).from(vehicles).where(and(isNull(vehicles.deletedAt), wsFilter(vehicles)));
    const [washCount] = await db.select({ count: sql<number>`count(*)` }).from(washQueue).where(wsFilter(washQueue));
    const [shiftCount] = await db.select({ count: sql<number>`count(*)` }).from(shifts).where(wsFilter(shifts));
    const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users).where(wsFilter(users));
    const [stationCount] = await db.select({ count: sql<number>`count(*)` }).from(stations).where(wsFilter(stations));
    const [automationCount] = await db.select({ count: sql<number>`count(*)` }).from(automationRules).where(wsFilter(automationRules));
    const [roomCount] = await db.select({ count: sql<number>`count(*)` }).from(entityRooms).where(wsFilter(entityRooms));
    const [totalNotifs] = await db.select({ count: sql<number>`count(*)` }).from(notifications).where(wsFilter(notifications));
    const [pendingRequests] = await db.select({ count: sql<number>`count(*)` }).from(shiftRequests).where(and(eq(shiftRequests.status, 'pending'), wsFilter(shiftRequests)));
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
    }).from(vehicles).where(and(isNull(vehicles.deletedAt), wsFilter(vehicles))).groupBy(vehicles.status);

    const washesByStatus = await db.select({
      status: washQueue.status,
      count: sql<number>`count(*)`,
    }).from(washQueue).where(wsFilter(washQueue)).groupBy(washQueue.status);

    const [todayCompleted] = await db.select({ count: sql<number>`count(*)` })
      .from(washQueue)
      .where(and(eq(washQueue.status, 'completed'), gte(washQueue.completedAt, todayStart), wsFilter(washQueue)));

    const [todayCreated] = await db.select({ count: sql<number>`count(*)` })
      .from(washQueue)
      .where(and(gte(washQueue.createdAt, todayStart), wsFilter(washQueue)));

    const notifsBySeverity = await db.select({
      severity: notifications.severity,
      count: sql<number>`count(*)`,
    }).from(notifications).where(wsFilter(notifications)).groupBy(notifications.severity);

    const [automationStats] = await db.select({
      total: sql<number>`count(*)`,
      active: sql<number>`count(*) filter (where ${automationRules.active} = true)`,
      totalExecutions: sql<number>`coalesce(sum(${automationRules.triggerCount}), 0)`,
    }).from(automationRules).where(wsFilter(automationRules));

    const roomsByStatus = await db.select({
      status: entityRooms.status,
      count: sql<number>`count(*)`,
    }).from(entityRooms).where(wsFilter(entityRooms)).groupBy(entityRooms.status);

    const [evidenceStats] = await db.select({
      total: sql<number>`count(*)`,
      todayCount: sql<number>`count(*) filter (where ${vehicleEvidence.createdAt} >= ${todayStart})`,
    }).from(vehicleEvidence).where(wsFilter(vehicleEvidence));

    const [shiftStats] = await db.select({ count: sql<number>`count(*)` }).from(shifts).where(wsFilter(shifts));
    const [stationStats] = await db.select({ count: sql<number>`count(*)` }).from(stations).where(wsFilter(stations));
    const [userStats] = await db.select({ count: sql<number>`count(*)` }).from(users).where(wsFilter(users));

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

  async getAnalyticsTrends(days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const washTrends = await db.select({
      date: sql<string>`date(${washQueue.createdAt})`,
      count: sql<number>`count(*)`,
    }).from(washQueue).where(and(gte(washQueue.createdAt, since), wsFilter(washQueue))).groupBy(sql`date(${washQueue.createdAt})`).orderBy(sql`date(${washQueue.createdAt})`);

    const evidenceTrends = await db.select({
      date: sql<string>`date(${vehicleEvidence.createdAt})`,
      count: sql<number>`count(*)`,
    }).from(vehicleEvidence).where(and(gte(vehicleEvidence.createdAt, since), wsFilter(vehicleEvidence))).groupBy(sql`date(${vehicleEvidence.createdAt})`).orderBy(sql`date(${vehicleEvidence.createdAt})`);

    const notifTrends = await db.select({
      date: sql<string>`date(${notifications.createdAt})`,
      count: sql<number>`count(*)`,
    }).from(notifications).where(and(gte(notifications.createdAt, since), wsFilter(notifications))).groupBy(sql`date(${notifications.createdAt})`).orderBy(sql`date(${notifications.createdAt})`);

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

  async getVehicleTrends(vehicleId: number) {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [washCount] = await db.select({ count: sql<number>`count(*)` }).from(washQueue)
      .where(and(eq(washQueue.vehiclePlate, sql`(SELECT plate FROM vehicles WHERE id = ${vehicleId})`), wsFilter(washQueue)));

    const [evidenceCount] = await db.select({ count: sql<number>`count(*)` }).from(vehicleEvidence)
      .where(and(eq(vehicleEvidence.vehicleId, vehicleId), wsFilter(vehicleEvidence)));

    const recentWashes = await db.select({
      date: sql<string>`date(${washQueue.createdAt})`,
      count: sql<number>`count(*)`,
    }).from(washQueue)
      .where(and(
        eq(washQueue.vehiclePlate, sql`(SELECT plate FROM vehicles WHERE id = ${vehicleId})`),
        gte(washQueue.createdAt, since)
      , wsFilter(washQueue)))
      .groupBy(sql`date(${washQueue.createdAt})`)
      .orderBy(sql`date(${washQueue.createdAt})`);

    const recentEvidence = await db.select({
      date: sql<string>`date(${vehicleEvidence.createdAt})`,
      count: sql<number>`count(*)`,
    }).from(vehicleEvidence)
      .where(and(eq(vehicleEvidence.vehicleId, vehicleId), gte(vehicleEvidence.createdAt, since), wsFilter(vehicleEvidence)))
      .groupBy(sql`date(${vehicleEvidence.createdAt})`)
      .orderBy(sql`date(${vehicleEvidence.createdAt})`);

    const topZones = await db.select({
      zone: sql<string>`${vehicleEvidence.metadata}->>'zone'`,
      count: sql<number>`count(*)`,
    }).from(vehicleEvidence)
      .where(and(eq(vehicleEvidence.vehicleId, vehicleId), sql`${vehicleEvidence.metadata}->>'zone' IS NOT NULL`, wsFilter(vehicleEvidence)))
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
      , wsFilter(vehicles)))
      .limit(5);
    for (const v of vRows) results.push({ type: 'vehicle', id: v.id, label: `${v.plate} - ${v.model}`, description: v.status });

    const uRows = await db.select().from(users)
      .where(and(or(
        sql`lower(${users.username}) like ${searchPattern}`,
        sql`lower(${users.displayName}) like ${searchPattern}`
      ), wsFilter(users)))
      .limit(5);
    for (const u of uRows) results.push({ type: 'user', id: u.id, label: u.displayName, description: u.role });

    const sRows = await db.select().from(stations)
      .where(and(or(
        sql`lower(${stations.name}) like ${searchPattern}`,
        sql`lower(${stations.code}) like ${searchPattern}`
      ), wsFilter(stations)))
      .limit(5);
    for (const s of sRows) results.push({ type: 'station', id: s.id, label: `${s.code} - ${s.name}` });

    return results;
  }
}
