/**
 * Channels domain: Discord-style team messaging — channels, members, messages, reactions.
 */
import { pgTable, text, integer, boolean, timestamp, jsonb, index, uniqueIndex, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspaces, users, stations } from "./core.js";

// ─── CHAT CHANNELS ───
export const chatChannels = pgTable("chat_channels", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  type: text("type").notNull().default("public"),
  stationId: integer("station_id").references(() => stations.id),
  createdBy: integer("created_by").notNull().references(() => users.id),
  archived: boolean("archived").notNull().default(false),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("channels_ws_slug_idx").on(t.workspaceId, t.slug),
  index("channels_type_idx").on(t.type),
  index("channels_station_idx").on(t.stationId),
]);
export const insertChatChannelSchema = createInsertSchema(chatChannels).omit({ createdAt: true, updatedAt: true, archived: true });
export type InsertChatChannel = z.infer<typeof insertChatChannelSchema>;
export type ChatChannel = typeof chatChannels.$inferSelect;

// ─── CHANNEL MEMBERS ───
export const channelMembers = pgTable("channel_members", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  channelId: integer("channel_id").notNull().references(() => chatChannels.id),
  userId: integer("user_id").notNull().references(() => users.id),
  role: text("role").notNull().default("member"),
  lastReadAt: timestamp("last_read_at"),
  muted: boolean("muted").notNull().default(false),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("channel_member_uniq_idx").on(t.channelId, t.userId),
  index("channel_member_user_idx").on(t.userId),
]);
export const insertChannelMemberSchema = createInsertSchema(channelMembers).omit({ joinedAt: true, lastReadAt: true });
export type InsertChannelMember = z.infer<typeof insertChannelMemberSchema>;
export type ChannelMember = typeof channelMembers.$inferSelect;

// ─── CHANNEL MESSAGES (with replies, edits) ───
export const channelMessages = pgTable("channel_messages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  channelId: integer("channel_id").notNull().references(() => chatChannels.id),
  userId: integer("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  replyToId: integer("reply_to_id").references((): AnyPgColumn => channelMessages.id),
  edited: boolean("edited").notNull().default(false),
  editedAt: timestamp("edited_at"),
  pinned: boolean("pinned").notNull().default(false),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("ch_msg_channel_idx").on(t.channelId, t.createdAt),
  index("ch_msg_user_idx").on(t.userId),
  index("ch_msg_reply_idx").on(t.replyToId),
  index("ch_msg_pinned_idx").on(t.channelId, t.pinned),
]);
export const insertChannelMessageSchema = createInsertSchema(channelMessages).omit({ createdAt: true, edited: true, editedAt: true, pinned: true });
export type InsertChannelMessage = z.infer<typeof insertChannelMessageSchema>;
export type ChannelMessage = typeof channelMessages.$inferSelect;

// ─── CHANNEL REACTIONS ───
export const channelReactions = pgTable("channel_reactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  messageId: integer("message_id").notNull().references(() => channelMessages.id),
  userId: integer("user_id").notNull().references(() => users.id),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("ch_reaction_uniq_idx").on(t.messageId, t.userId, t.emoji),
  index("ch_reaction_message_idx").on(t.messageId),
]);
export const insertChannelReactionSchema = createInsertSchema(channelReactions).omit({ createdAt: true });
export type InsertChannelReaction = z.infer<typeof insertChannelReactionSchema>;
export type ChannelReaction = typeof channelReactions.$inferSelect;
