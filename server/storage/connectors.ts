import { db, eq, desc , wsFilter, wsInsert, and} from "./base.js";
import {
  integrationConnectors, type IntegrationConnector, type InsertIntegrationConnector,
  syncJobs, type SyncJob, type InsertSyncJob,
} from "../../shared/schema.js";

export class ConnectorStorage {
  // ── Integration connectors ──
  async getIntegrationConnectors(type?: string) {
    if (type) return db.select().from(integrationConnectors).where(and(eq(integrationConnectors.type, type), wsFilter(integrationConnectors))).orderBy(desc(integrationConnectors.createdAt));
    return db.select().from(integrationConnectors).where(wsFilter(integrationConnectors)).orderBy(desc(integrationConnectors.createdAt));
  }
  /** Unscoped lookup of webhook connectors by type — used by webhook ingestion (no user session). */
  async getIntegrationConnectorsUnscoped(type: string) {
    return db.select().from(integrationConnectors).where(eq(integrationConnectors.type, type)).orderBy(desc(integrationConnectors.createdAt));
  }
  async getIntegrationConnector(id: number) {
    const [c] = await db.select().from(integrationConnectors).where(and(eq(integrationConnectors.id, id), wsFilter(integrationConnectors)));
    return c;
  }
  async createIntegrationConnector(data: InsertIntegrationConnector) {
    const [c] = await db.insert(integrationConnectors).values(wsInsert(data)).returning();
    return c;
  }
  async updateIntegrationConnector(id: number, data: Partial<IntegrationConnector>) {
    const { id: _id, ...rest } = data;
    const [c] = await db.update(integrationConnectors).set({ ...rest, updatedAt: new Date() }).where(and(eq(integrationConnectors.id, id), wsFilter(integrationConnectors))).returning();
    return c;
  }
  async deleteIntegrationConnector(id: number) {
    await db.delete(integrationConnectors).where(and(eq(integrationConnectors.id, id), wsFilter(integrationConnectors)));
  }

  // ── Sync jobs ──
  async getSyncJobs(connectorId?: number, limit = 100) {
    if (connectorId) {
      return db.select().from(syncJobs).where(and(eq(syncJobs.connectorId, connectorId), wsFilter(syncJobs))).orderBy(desc(syncJobs.createdAt)).limit(limit);
    }
    return db.select().from(syncJobs).where(wsFilter(syncJobs)).orderBy(desc(syncJobs.createdAt)).limit(limit);
  }
  async getSyncJob(id: number) {
    const [j] = await db.select().from(syncJobs).where(and(eq(syncJobs.id, id), wsFilter(syncJobs)));
    return j;
  }
  async createSyncJob(data: InsertSyncJob) {
    const [j] = await db.insert(syncJobs).values(wsInsert(data)).returning();
    return j;
  }
  async updateSyncJob(id: number, data: Partial<SyncJob>) {
    const { id: _id, ...rest } = data;
    const [j] = await db.update(syncJobs).set(rest).where(and(eq(syncJobs.id, id), wsFilter(syncJobs))).returning();
    return j;
  }
}
