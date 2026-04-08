/**
 * Export request storage domain module (Phase 4.1A).
 */
import { db, eq, desc, and, sql, lt , wsFilter, wsInsert} from "./base.js";
import {
  exportRequests,
  type ExportRequest,
  type InsertExportRequest,
} from "../../shared/schema.js";

export class ExportStorage {
  async getExportRequests(filters?: { status?: string; requestedBy?: number; exportType?: string }): Promise<ExportRequest[]> {
    const conditions = [];
    if (filters?.status) conditions.push(eq(exportRequests.status, filters.status));
    if (filters?.requestedBy) conditions.push(eq(exportRequests.requestedBy, filters.requestedBy));
    if (filters?.exportType) conditions.push(eq(exportRequests.exportType, filters.exportType));

    if (conditions.length === 0) {
      return db.select().from(exportRequests).where(wsFilter(exportRequests)).orderBy(desc(exportRequests.createdAt)).limit(200);
    }
    const where = conditions.length === 1 ? and(conditions[0], wsFilter(exportRequests)) : and(...conditions, wsFilter(exportRequests));
    return db.select().from(exportRequests).where(where).orderBy(desc(exportRequests.createdAt)).limit(200);
  }

  async getExportRequest(id: number): Promise<ExportRequest | undefined> {
    const [row] = await db.select().from(exportRequests).where(and(eq(exportRequests.id, id), wsFilter(exportRequests)));
    return row;
  }

  async createExportRequest(data: InsertExportRequest): Promise<ExportRequest> {
    const [row] = await db.insert(exportRequests).values(wsInsert(data)).returning();
    return row;
  }

  async updateExportRequest(id: number, data: Partial<ExportRequest>): Promise<ExportRequest | undefined> {
    const { id: _id, createdAt: _c, ...rest } = data as Record<string, unknown>;
    const [row] = await db
      .update(exportRequests)
      .set({ ...rest, updatedAt: new Date() } as any)
      .where(and(eq(exportRequests.id, id), wsFilter(exportRequests)))
      .returning();
    return row;
  }

  /** System-level: finds expired exports across ALL workspaces for background cleanup. */
  async getExpiredExportRequests(): Promise<ExportRequest[]> {
    return db
      .select()
      .from(exportRequests)
      .where(
        and(
          sql`${exportRequests.expiresAt} IS NOT NULL`,
          lt(exportRequests.expiresAt, new Date()),
          sql`${exportRequests.status} NOT IN ('expired', 'failed', 'rejected')`,
        ),
      )
      .limit(500);
  }

  /** System-level: finds processable exports across ALL workspaces for background processing. */
  async getProcessableExportRequests(): Promise<ExportRequest[]> {
    return db
      .select()
      .from(exportRequests)
      .where(eq(exportRequests.status, "approved"))
      .orderBy(exportRequests.createdAt)
      .limit(20);
  }
}
