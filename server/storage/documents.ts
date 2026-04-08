import { db, eq, desc, and , wsFilter, wsInsert} from "./base.js";
import {
  fileAttachments, type InsertFileAttachment,
  knowledgeDocuments, type KnowledgeDocument, type InsertKnowledgeDocument,
} from "../../shared/schema.js";

export class DocumentStorage {
  // ── File attachments ──
  async getFileAttachments(entityType: string, entityId: string) {
    return db.select().from(fileAttachments).where(and(eq(fileAttachments.entityType, entityType), eq(fileAttachments.entityId, entityId), wsFilter(fileAttachments))).orderBy(desc(fileAttachments.createdAt));
  }
  async getFileAttachment(id: number) {
    const [f] = await db.select().from(fileAttachments).where(and(eq(fileAttachments.id, id), wsFilter(fileAttachments)));
    return f;
  }
  async createFileAttachment(data: InsertFileAttachment) {
    const [f] = await db.insert(fileAttachments).values(wsInsert(data)).returning();
    return f;
  }
  async deleteFileAttachment(id: number) {
    await db.delete(fileAttachments).where(and(eq(fileAttachments.id, id), wsFilter(fileAttachments)));
  }

  // ── Knowledge documents ──
  async getKnowledgeDocuments(category?: string) {
    if (category) return db.select().from(knowledgeDocuments).where(and(eq(knowledgeDocuments.category, category), wsFilter(knowledgeDocuments))).orderBy(desc(knowledgeDocuments.createdAt));
    return db.select().from(knowledgeDocuments).where(wsFilter(knowledgeDocuments)).orderBy(desc(knowledgeDocuments.createdAt));
  }
  async getKnowledgeDocument(id: number) {
    const [d] = await db.select().from(knowledgeDocuments).where(and(eq(knowledgeDocuments.id, id), wsFilter(knowledgeDocuments)));
    return d;
  }
  async createKnowledgeDocument(data: InsertKnowledgeDocument) {
    const [d] = await db.insert(knowledgeDocuments).values(wsInsert(data)).returning();
    return d;
  }
  async updateKnowledgeDocument(id: number, data: Partial<KnowledgeDocument>) {
    const { id: _id, ...rest } = data;
    const [d] = await db.update(knowledgeDocuments).set({ ...rest, updatedAt: new Date() }).where(and(eq(knowledgeDocuments.id, id), wsFilter(knowledgeDocuments))).returning();
    return d;
  }
  async deleteKnowledgeDocument(id: number) {
    await db.delete(knowledgeDocuments).where(and(eq(knowledgeDocuments.id, id), wsFilter(knowledgeDocuments)));
  }
  async searchKnowledgeDocuments(query: string) {
    const lowerQuery = query.toLowerCase();
    const all = await db.select().from(knowledgeDocuments).where(wsFilter(knowledgeDocuments)).orderBy(desc(knowledgeDocuments.createdAt));
    return all.filter(d =>
      d.title.toLowerCase().includes(lowerQuery) ||
      d.filename.toLowerCase().includes(lowerQuery) ||
      d.category.toLowerCase().includes(lowerQuery) ||
      (d.tags && d.tags.some(t => t.toLowerCase().includes(lowerQuery)))
    );
  }
}
