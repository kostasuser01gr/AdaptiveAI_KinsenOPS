import { db, eq, desc, and, wsFilter, wsInsert } from "./base.js";
import {
  ideaComments, type InsertIdeaComment,
  ideaAttachments, type InsertIdeaAttachment,
} from "../../shared/schema.js";

export class IdeaStorage {
  // ─── IDEA COMMENTS ───
  async getIdeaComments(proposalId: number) {
    return db.select().from(ideaComments)
      .where(and(eq(ideaComments.proposalId, proposalId), wsFilter(ideaComments)))
      .orderBy(ideaComments.createdAt);
  }
  async createIdeaComment(data: InsertIdeaComment) {
    const [comment] = await db.insert(ideaComments).values(wsInsert(data)).returning();
    return comment;
  }
  async updateIdeaComment(id: number, content: string) {
    const [comment] = await db.update(ideaComments)
      .set({ content, updatedAt: new Date() })
      .where(and(eq(ideaComments.id, id), wsFilter(ideaComments)))
      .returning();
    return comment;
  }
  async deleteIdeaComment(id: number) {
    await db.delete(ideaComments).where(and(eq(ideaComments.id, id), wsFilter(ideaComments)));
  }

  // ─── IDEA ATTACHMENTS ───
  async getIdeaAttachments(proposalId: number) {
    return db.select().from(ideaAttachments)
      .where(and(eq(ideaAttachments.proposalId, proposalId), wsFilter(ideaAttachments)))
      .orderBy(desc(ideaAttachments.createdAt));
  }
  async createIdeaAttachment(data: InsertIdeaAttachment) {
    const [att] = await db.insert(ideaAttachments).values(wsInsert(data)).returning();
    return att;
  }
  async deleteIdeaAttachment(id: number) {
    await db.delete(ideaAttachments).where(and(eq(ideaAttachments.id, id), wsFilter(ideaAttachments)));
  }
}
