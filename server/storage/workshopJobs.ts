/**
 * Workshop jobs storage — external workshop linkage (Phase 4.2B).
 */
import { db, eq, and, desc, sql , wsFilter, wsInsert} from "./base.js";
import {
  workshopJobs,
  type InsertWorkshopJob,
  type WorkshopJob,
} from "../../shared/schema.js";

export class WorkshopJobStorage {
  /**
   * Create or update a workshop job. Uses conflict-safe upsert on (connectorId + externalJobId).
   * Returns { row, wasInsert } for callers that need to distinguish.
   */
  async upsertWorkshopJob(data: InsertWorkshopJob): Promise<WorkshopJob> {
    const result = await this.upsertWorkshopJobEx(data);
    return result.row;
  }

  async upsertWorkshopJobEx(data: InsertWorkshopJob): Promise<{ row: WorkshopJob; wasInsert: boolean }> {
    // Dedupe by connector + external ID
    if (data.connectorId && data.externalJobId) {
      const [existing] = await db
        .select()
        .from(workshopJobs)
        .where(
          and(
            eq(workshopJobs.connectorId, data.connectorId),
            eq(workshopJobs.externalJobId, data.externalJobId),
            wsFilter(workshopJobs),
          ),
        )
        .limit(1);

      if (existing) {
        const [updated] = await db
          .update(workshopJobs)
          .set({
            ...(data.externalStatus !== undefined ? { externalStatus: data.externalStatus } : {}),
            ...(data.normalizedStatus !== undefined ? { normalizedStatus: data.normalizedStatus } : {}),
            ...(data.estimateAmount !== undefined ? { estimateAmount: data.estimateAmount } : {}),
            ...(data.invoiceRef !== undefined ? { invoiceRef: data.invoiceRef } : {}),
            ...(data.notes !== undefined ? { notes: data.notes } : {}),
            ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
            ...(data.repairOrderId !== undefined ? { repairOrderId: data.repairOrderId } : {}),
            lastSyncAt: new Date(),
            updatedAt: new Date(),
          })
          .where(and(eq(workshopJobs.id, existing.id), wsFilter(workshopJobs)))
          .returning();
        return { row: updated, wasInsert: false };
      }
    }

    const [row] = await db.insert(workshopJobs).values(wsInsert(data)).returning();
    return { row, wasInsert: true };
  }

  /** Get workshop jobs with optional filters. */
  async getWorkshopJobs(filters?: {
    repairOrderId?: number;
    connectorId?: number;
    normalizedStatus?: string;
    limit?: number;
  }): Promise<WorkshopJob[]> {
    const conditions = [];
    if (filters?.repairOrderId !== undefined) conditions.push(eq(workshopJobs.repairOrderId, filters.repairOrderId));
    if (filters?.connectorId !== undefined) conditions.push(eq(workshopJobs.connectorId, filters.connectorId));
    if (filters?.normalizedStatus) conditions.push(eq(workshopJobs.normalizedStatus, filters.normalizedStatus));

    const query = db
      .select()
      .from(workshopJobs)
      .orderBy(desc(workshopJobs.updatedAt))
      .limit(filters?.limit ?? 100);

    if (conditions.length > 0) {
      return query.where(and(...conditions, wsFilter(workshopJobs)));
    }
    return query.where(wsFilter(workshopJobs));
  }

  /** Get a single workshop job by ID. */
  async getWorkshopJob(id: number): Promise<WorkshopJob | undefined> {
    const [row] = await db.select().from(workshopJobs).where(and(eq(workshopJobs.id, id), wsFilter(workshopJobs))).limit(1);
    return row;
  }

  /** Update a workshop job by ID. */
  async updateWorkshopJob(id: number, data: Partial<WorkshopJob>): Promise<WorkshopJob | undefined> {
    const { id: _id, createdAt: _c, ...updateData } = data as any;
    const [row] = await db
      .update(workshopJobs)
      .set({ ...updateData, updatedAt: new Date() })
      .where(and(eq(workshopJobs.id, id), wsFilter(workshopJobs)))
      .returning();
    return row;
  }

  /** Link a workshop job to a repair order. */
  async linkWorkshopJobToRepairOrder(workshopJobId: number, repairOrderId: number): Promise<WorkshopJob | undefined> {
    const [row] = await db
      .update(workshopJobs)
      .set({ repairOrderId, updatedAt: new Date() })
      .where(and(eq(workshopJobs.id, workshopJobId), wsFilter(workshopJobs)))
      .returning();
    return row;
  }
}
