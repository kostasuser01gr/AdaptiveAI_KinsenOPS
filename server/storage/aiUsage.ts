import { db, eq, desc, and, wsFilter, wsInsert } from "./base.js";
import {
  aiModelUsage, type InsertAiModelUsage,
} from "../../shared/schema.js";

export class AiUsageStorage {
  async getAiModelUsage(filters?: { provider?: string; feature?: string; userId?: number; limit?: number }) {
    const conditions = [wsFilter(aiModelUsage)];
    if (filters?.provider) conditions.push(eq(aiModelUsage.provider, filters.provider));
    if (filters?.feature) conditions.push(eq(aiModelUsage.feature, filters.feature));
    if (filters?.userId) conditions.push(eq(aiModelUsage.userId, filters.userId));
    return db.select().from(aiModelUsage)
      .where(and(...conditions))
      .orderBy(desc(aiModelUsage.createdAt))
      .limit(filters?.limit ?? 100);
  }
  async createAiModelUsage(data: InsertAiModelUsage) {
    const [u] = await db.insert(aiModelUsage).values(wsInsert(data)).returning();
    return u;
  }
}
