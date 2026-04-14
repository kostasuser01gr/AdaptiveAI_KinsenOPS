import { db, eq, desc , wsFilter, wsInsert, and} from "./base.js";
import {
  chatConversations, type InsertConversation,
  chatMessages, type InsertMessage,
} from "../../shared/schema.js";
import { withTransaction } from "../db.js";

export class ChatStorage {
  async getConversations(userId: number) {
    return db.select().from(chatConversations).where(and(eq(chatConversations.userId, userId), wsFilter(chatConversations))).orderBy(desc(chatConversations.createdAt));
  }
  async getConversation(id: number) {
    const [conv] = await db.select().from(chatConversations).where(and(eq(chatConversations.id, id), wsFilter(chatConversations)));
    return conv;
  }
  async createConversation(data: InsertConversation) {
    const [conv] = await db.insert(chatConversations).values(wsInsert(data)).returning();
    return conv;
  }
  async updateConversation(id: number, data: Partial<InsertConversation>) {
    const [conv] = await db.update(chatConversations).set(data).where(and(eq(chatConversations.id, id), wsFilter(chatConversations))).returning();
    return conv;
  }
  async deleteConversation(id: number) {
    await withTransaction(async (tx) => {
      await tx.delete(chatMessages).where(eq(chatMessages.conversationId, id));
      await tx.delete(chatConversations).where(and(eq(chatConversations.id, id), wsFilter(chatConversations)));
    });
  }

  async getMessages(conversationId: number) {
    return db.select().from(chatMessages).where(eq(chatMessages.conversationId, conversationId)).orderBy(chatMessages.createdAt);
  }
  async createMessage(data: InsertMessage) {
    const [msg] = await db.insert(chatMessages).values(data).returning();
    return msg;
  }

  async createMessageWithMetadata(data: InsertMessage & { metadata?: Record<string, unknown> }) {
    const [msg] = await db.insert(chatMessages).values(data).returning();
    return msg;
  }
}
