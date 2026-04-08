import { db, eq, desc , wsFilter, wsInsert, and} from "./base.js";
import { imports, type InsertImport } from "../../shared/schema.js";

export class ImportStorage {
  async getImports(uploadedBy?: number) {
    if (uploadedBy) return db.select().from(imports).where(and(eq(imports.uploadedBy, uploadedBy), wsFilter(imports))).orderBy(desc(imports.createdAt));
    return db.select().from(imports).where(wsFilter(imports)).orderBy(desc(imports.createdAt));
  }
  async getImport(id: number) {
    const [imp] = await db.select().from(imports).where(and(eq(imports.id, id), wsFilter(imports)));
    return imp;
  }
  async createImport(data: InsertImport) {
    const [imp] = await db.insert(imports).values(wsInsert(data)).returning();
    return imp;
  }
  async updateImport(id: number, data: Partial<InsertImport> & { completedAt?: Date | null }) {
    const [imp] = await db.update(imports).set(data).where(and(eq(imports.id, id), wsFilter(imports))).returning();
    return imp;
  }
  async deleteImport(id: number) {
    await db.delete(imports).where(and(eq(imports.id, id), wsFilter(imports)));
  }
}
