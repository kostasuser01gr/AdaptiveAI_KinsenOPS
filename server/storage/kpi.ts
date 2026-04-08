import { db, eq, desc, and, gte, sql , wsFilter, wsInsert} from "./base.js";
import {
  kpiDefinitions, type InsertKpiDefinition,
  kpiSnapshots, type InsertKpiSnapshot,
  anomalies, type Anomaly, type InsertAnomaly,
  executiveBriefings, type InsertExecutiveBriefing,
} from "../../shared/schema.js";

export class KpiStorage {
  // ── KPI definitions ──
  async getKpiDefinitions(category?: string) {
    if (category) return db.select().from(kpiDefinitions).where(and(eq(kpiDefinitions.category, category), wsFilter(kpiDefinitions)));
    return db.select().from(kpiDefinitions).where(wsFilter(kpiDefinitions));
  }
  async getKpiDefinition(slug: string) {
    const [k] = await db.select().from(kpiDefinitions).where(and(eq(kpiDefinitions.slug, slug), wsFilter(kpiDefinitions)));
    return k;
  }
  async createKpiDefinition(data: InsertKpiDefinition) {
    const [k] = await db.insert(kpiDefinitions).values(wsInsert(data)).returning();
    return k;
  }
  async updateKpiDefinition(id: number, data: Partial<InsertKpiDefinition>) {
    const [k] = await db.update(kpiDefinitions).set(data).where(and(eq(kpiDefinitions.id, id), wsFilter(kpiDefinitions))).returning();
    return k;
  }

  // ── KPI snapshots ──
  async getKpiSnapshots(slug: string, from?: string, to?: string, stationId?: number) {
    const conditions = [eq(kpiSnapshots.kpiSlug, slug)];
    if (from) conditions.push(gte(kpiSnapshots.date, from));
    if (to) conditions.push(sql`${kpiSnapshots.date} <= ${to}`);
    if (stationId) conditions.push(eq(kpiSnapshots.stationId, stationId));
    if (conditions.length === 1) return db.select().from(kpiSnapshots).where(and(conditions[0], wsFilter(kpiSnapshots))).orderBy(kpiSnapshots.date);
    return db.select().from(kpiSnapshots).where(and(...conditions, wsFilter(kpiSnapshots))).orderBy(kpiSnapshots.date);
  }
  async createKpiSnapshot(data: InsertKpiSnapshot) {
    const [k] = await db.insert(kpiSnapshots).values(wsInsert(data)).returning();
    return k;
  }

  // ── Anomalies ──
  async getAnomalies(filters?: { type?: string; status?: string; stationId?: number }) {
    const conditions = [];
    if (filters?.type) conditions.push(eq(anomalies.type, filters.type));
    if (filters?.status) conditions.push(eq(anomalies.status, filters.status));
    if (filters?.stationId) conditions.push(eq(anomalies.stationId, filters.stationId));
    if (conditions.length === 0) return db.select().from(anomalies).where(wsFilter(anomalies)).orderBy(desc(anomalies.detectedAt));
    if (conditions.length === 1) return db.select().from(anomalies).where(and(conditions[0], wsFilter(anomalies))).orderBy(desc(anomalies.detectedAt));
    return db.select().from(anomalies).where(and(...conditions, wsFilter(anomalies))).orderBy(desc(anomalies.detectedAt));
  }
  async getAnomaly(id: number) {
    const [a] = await db.select().from(anomalies).where(and(eq(anomalies.id, id), wsFilter(anomalies)));
    return a;
  }
  async createAnomaly(data: InsertAnomaly) {
    const [a] = await db.insert(anomalies).values(wsInsert(data)).returning();
    return a;
  }
  async updateAnomaly(id: number, data: Partial<Anomaly>) {
    const { id: _id, ...rest } = data;
    const [a] = await db.update(anomalies).set(rest).where(and(eq(anomalies.id, id), wsFilter(anomalies))).returning();
    return a;
  }

  // ── Executive briefings ──
  async getExecutiveBriefings(limit = 20) {
    return db.select().from(executiveBriefings).where(wsFilter(executiveBriefings)).orderBy(desc(executiveBriefings.createdAt)).limit(limit);
  }
  async getExecutiveBriefing(id: number) {
    const [b] = await db.select().from(executiveBriefings).where(and(eq(executiveBriefings.id, id), wsFilter(executiveBriefings)));
    return b;
  }
  async createExecutiveBriefing(data: InsertExecutiveBriefing) {
    const [b] = await db.insert(executiveBriefings).values(wsInsert(data)).returning();
    return b;
  }
}
