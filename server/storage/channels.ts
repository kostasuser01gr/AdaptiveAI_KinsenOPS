import { db, eq, desc, and, wsFilter, wsInsert, gte } from "./base.js";
import {
  chatChannels, type InsertChatChannel,
  channelMembers, type InsertChannelMember,
  channelMessages, type InsertChannelMessage,
  channelReactions, type InsertChannelReaction,
  users,
} from "../../shared/schema.js";

export class ChannelStorage {
  // ─── Channels ───
  async getChatChannels(type?: string) {
    const conditions = [wsFilter(chatChannels), eq(chatChannels.archived, false)];
    if (type) conditions.push(eq(chatChannels.type, type));
    return db.select().from(chatChannels).where(and(...conditions)).orderBy(chatChannels.name);
  }
  async getChatChannel(id: number) {
    const [c] = await db.select().from(chatChannels).where(and(eq(chatChannels.id, id), wsFilter(chatChannels)));
    return c;
  }
  async getChatChannelBySlug(slug: string) {
    const [c] = await db.select().from(chatChannels).where(and(eq(chatChannels.slug, slug), wsFilter(chatChannels)));
    return c;
  }
  async createChatChannel(data: InsertChatChannel) {
    const [c] = await db.insert(chatChannels).values(wsInsert(data)).returning();
    return c;
  }
  async updateChatChannel(id: number, data: Partial<InsertChatChannel>) {
    const [c] = await db.update(chatChannels).set({ ...data, updatedAt: new Date() }).where(and(eq(chatChannels.id, id), wsFilter(chatChannels))).returning();
    return c;
  }
  async archiveChatChannel(id: number) {
    const [c] = await db.update(chatChannels).set({ archived: true, updatedAt: new Date() }).where(and(eq(chatChannels.id, id), wsFilter(chatChannels))).returning();
    return c;
  }

  // ─── Members ───
  async getChannelMembers(channelId: number) {
    return db.select({
      id: channelMembers.id,
      channelId: channelMembers.channelId,
      userId: channelMembers.userId,
      role: channelMembers.role,
      muted: channelMembers.muted,
      lastReadAt: channelMembers.lastReadAt,
      joinedAt: channelMembers.joinedAt,
      displayName: users.displayName,
      username: users.username,
      userRole: users.role,
    }).from(channelMembers)
      .innerJoin(users, eq(channelMembers.userId, users.id))
      .where(eq(channelMembers.channelId, channelId));
  }
  async getUserChannels(userId: number) {
    return db.select().from(channelMembers).where(eq(channelMembers.userId, userId));
  }
  async addChannelMember(data: InsertChannelMember) {
    const [m] = await db.insert(channelMembers).values(data).onConflictDoNothing().returning();
    return m;
  }
  async removeChannelMember(channelId: number, userId: number) {
    await db.delete(channelMembers).where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)));
  }
  async updateChannelMemberReadState(channelId: number, userId: number) {
    const [m] = await db.update(channelMembers)
      .set({ lastReadAt: new Date() })
      .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)))
      .returning();
    return m;
  }

  // ─── Messages ───
  async getChannelMessages(channelId: number, limit = 50, before?: number) {
    const conditions = [eq(channelMessages.channelId, channelId)];
    if (before) conditions.push(gte(channelMessages.id, before));
    return db.select({
      id: channelMessages.id,
      channelId: channelMessages.channelId,
      userId: channelMessages.userId,
      content: channelMessages.content,
      replyToId: channelMessages.replyToId,
      edited: channelMessages.edited,
      editedAt: channelMessages.editedAt,
      pinned: channelMessages.pinned,
      metadata: channelMessages.metadata,
      createdAt: channelMessages.createdAt,
      displayName: users.displayName,
      username: users.username,
    }).from(channelMessages)
      .innerJoin(users, eq(channelMessages.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(channelMessages.createdAt))
      .limit(limit);
  }
  async getChannelMessage(id: number) {
    const [m] = await db.select().from(channelMessages).where(eq(channelMessages.id, id));
    return m;
  }
  async createChannelMessage(data: InsertChannelMessage) {
    const [m] = await db.insert(channelMessages).values(data).returning();
    return m;
  }
  async updateChannelMessage(id: number, content: string) {
    const [m] = await db.update(channelMessages)
      .set({ content, edited: true, editedAt: new Date() })
      .where(eq(channelMessages.id, id))
      .returning();
    return m;
  }
  async togglePinMessage(id: number, pinned: boolean) {
    const [m] = await db.update(channelMessages).set({ pinned }).where(eq(channelMessages.id, id)).returning();
    return m;
  }
  async getPinnedMessages(channelId: number) {
    return db.select().from(channelMessages)
      .where(and(eq(channelMessages.channelId, channelId), eq(channelMessages.pinned, true)))
      .orderBy(desc(channelMessages.createdAt));
  }

  // ─── Reactions ───
  async getMessageReactions(messageId: number) {
    return db.select().from(channelReactions).where(eq(channelReactions.messageId, messageId));
  }
  async addReaction(data: InsertChannelReaction) {
    const [r] = await db.insert(channelReactions).values(data).onConflictDoNothing().returning();
    return r;
  }
  async removeReaction(messageId: number, userId: number, emoji: string) {
    await db.delete(channelReactions).where(and(
      eq(channelReactions.messageId, messageId),
      eq(channelReactions.userId, userId),
      eq(channelReactions.emoji, emoji),
    ));
  }
}
