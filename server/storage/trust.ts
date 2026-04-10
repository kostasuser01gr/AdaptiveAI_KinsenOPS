import { db, desc, lt , wsFilter, wsInsert, and} from "./base.js";
import { auditLog, type InsertAuditLog } from "../../shared/schema.js";

export class TrustStorage {
  async getAuditLog(limit = 100) {
    return db.select().from(auditLog).where(wsFilter(auditLog)).orderBy(desc(auditLog.createdAt)).limit(limit);
  }
  async createAuditEntry(data: InsertAuditLog) {
    const [a] = await db.insert(auditLog).values(wsInsert(data)).returning();
    return a;
  }
  async deleteAuditEntriesBefore(cutoff: Date) {
    const deleted = await db.delete(auditLog).where(and(lt(auditLog.createdAt, cutoff), wsFilter(auditLog))).returning();
    return deleted.length;
  }
}
