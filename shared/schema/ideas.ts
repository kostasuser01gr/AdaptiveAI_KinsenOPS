/**
 * Ideas domain: threaded comments and attachments on workspace proposals.
 */
import { pgTable, text, integer, timestamp, index, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspaces, users } from "./core.js";
import { workspaceProposals } from "./workspace.js";

// ─── IDEA COMMENTS (threaded discussion on proposals/ideas) ───
export const ideaComments = pgTable("idea_comments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  proposalId: integer("proposal_id").notNull().references(() => workspaceProposals.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  parentId: integer("parent_id").references((): AnyPgColumn => ideaComments.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("idea_comments_proposal_idx").on(t.proposalId),
  index("idea_comments_user_idx").on(t.userId),
  index("idea_comments_parent_idx").on(t.parentId),
]);
export const insertIdeaCommentSchema = createInsertSchema(ideaComments).omit({ createdAt: true, updatedAt: true });
export type InsertIdeaComment = z.infer<typeof insertIdeaCommentSchema>;
export type IdeaComment = typeof ideaComments.$inferSelect;

// ─── IDEA ATTACHMENTS (screenshots, mockups, files for ideas) ───
export const ideaAttachments = pgTable("idea_attachments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workspaceId: text("workspace_id").notNull().default("default").references(() => workspaces.id),
  proposalId: integer("proposal_id").notNull().references(() => workspaceProposals.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  url: text("url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("idea_attachments_proposal_idx").on(t.proposalId),
]);
export const insertIdeaAttachmentSchema = createInsertSchema(ideaAttachments).omit({ createdAt: true });
export type InsertIdeaAttachment = z.infer<typeof insertIdeaAttachmentSchema>;
export type IdeaAttachment = typeof ideaAttachments.$inferSelect;
