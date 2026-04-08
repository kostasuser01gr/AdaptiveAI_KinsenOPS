import { db, eq, desc, and, sql , wsFilter, wsInsert} from "./base.js";
import {
  washQueue, type InsertWashQueue,
} from "../../shared/schema.js";

export class WashQueueStorage {
  async getWashQueue() { return db.select().from(washQueue).where(wsFilter(washQueue)).orderBy(desc(washQueue.createdAt)); }
  async createWashQueueItem(data: InsertWashQueue) {
    const [item] = await db.insert(washQueue).values(wsInsert(data)).returning();
    return item;
  }
  async updateWashQueueItem(id: number, data: Partial<InsertWashQueue>) {
    const [item] = await db.update(washQueue).set(data).where(and(eq(washQueue.id, id), wsFilter(washQueue))).returning();
    return item;
  }
  async deleteWashQueueItem(id: number) { await db.delete(washQueue).where(and(eq(washQueue.id, id), wsFilter(washQueue))); }

  async getOverdueWashItems() {
    return db.select().from(washQueue)
      .where(and(
        sql`${washQueue.slaDeadline} IS NOT NULL`,
        sql`${washQueue.slaDeadline} < now()`,
        sql`${washQueue.status} NOT IN ('completed', 'cancelled')`
      , wsFilter(washQueue)))
      .orderBy(washQueue.slaDeadline)
      .limit(500);
  }
}
