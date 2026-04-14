import type { Express } from "express";
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import { storage } from "../storage.js";
import { requireAuth } from "../auth.js";
import { insertIdeaCommentSchema, insertIdeaAttachmentSchema, ideaComments, ideaAttachments } from "../../shared/schema.js";
import { db } from "../db.js";

export function registerIdeaRoutes(app: Express) {
  // ─── IDEAS (extended proposals) ───
  // Uses existing proposals endpoints for CRUD, these add comments + attachments

  // List ideas (proposals with type 'idea' or 'ui_tweak')
  app.get("/api/ideas", requireAuth, async (req, res, next) => {
    try {
      const status = req.query.status as string | undefined;
      const proposals = await storage.getProposals(undefined, status);
      res.json(proposals);
    } catch (e) { next(e); }
  });

  // ─── IDEA COMMENTS ───
  app.get("/api/ideas/:proposalId/comments", requireAuth, async (req, res, next) => {
    try {
      res.json(await storage.getIdeaComments(Number(req.params.proposalId)));
    } catch (e) { next(e); }
  });

  app.post("/api/ideas/:proposalId/comments", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const data = insertIdeaCommentSchema.parse({
        ...req.body,
        proposalId: Number(req.params.proposalId),
        userId,
      });
      res.status(201).json(await storage.createIdeaComment(data));
    } catch (e) { next(e); }
  });

  app.patch("/api/ideas/comments/:id", requireAuth, async (req, res, next) => {
    try {
      const schema = z.object({ content: z.string().min(1).max(5000) });
      const { content } = schema.parse(req.body);
      const userId = (req.user as Express.User).id;
      const role = (req.user as Express.User).role;
      // RT-1: Ownership check — only the author or admins can edit
      const [existing] = await db.select({ userId: ideaComments.userId }).from(ideaComments).where(eq(ideaComments.id, Number(req.params.id)));
      if (!existing) return res.status(404).json({ message: "Comment not found" });
      if (existing.userId !== userId && role !== 'admin') return res.status(403).json({ message: "Forbidden" });
      const comment = await storage.updateIdeaComment(Number(req.params.id), content);
      if (!comment) return res.status(404).json({ message: "Comment not found" });
      res.json(comment);
    } catch (e) { next(e); }
  });

  app.delete("/api/ideas/comments/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const role = (req.user as Express.User).role;
      // RT-1: Ownership check — only the author or admins can delete
      const [existing] = await db.select({ userId: ideaComments.userId }).from(ideaComments).where(eq(ideaComments.id, Number(req.params.id)));
      if (!existing) return res.status(404).json({ message: "Comment not found" });
      if (existing.userId !== userId && role !== 'admin') return res.status(403).json({ message: "Forbidden" });
      await storage.deleteIdeaComment(Number(req.params.id));
      res.status(204).end();
    } catch (e) { next(e); }
  });

  // ─── IDEA ATTACHMENTS ───
  app.get("/api/ideas/:proposalId/attachments", requireAuth, async (req, res, next) => {
    try {
      res.json(await storage.getIdeaAttachments(Number(req.params.proposalId)));
    } catch (e) { next(e); }
  });

  app.post("/api/ideas/:proposalId/attachments", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const data = insertIdeaAttachmentSchema.parse({
        ...req.body,
        proposalId: Number(req.params.proposalId),
        userId,
      });
      res.status(201).json(await storage.createIdeaAttachment(data));
    } catch (e) { next(e); }
  });

  app.delete("/api/ideas/attachments/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const role = (req.user as Express.User).role;
      // RT-2: Ownership check — only the uploader or admins can delete
      const [existing] = await db.select({ userId: ideaAttachments.userId }).from(ideaAttachments).where(eq(ideaAttachments.id, Number(req.params.id)));
      if (!existing) return res.status(404).json({ message: "Attachment not found" });
      if (existing.userId !== userId && role !== 'admin') return res.status(403).json({ message: "Forbidden" });
      await storage.deleteIdeaAttachment(Number(req.params.id));
      res.status(204).end();
    } catch (e) { next(e); }
  });
}
