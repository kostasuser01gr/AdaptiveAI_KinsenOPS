import type { Express } from "express";
import { z } from "zod/v4";
import { storage } from "../storage.js";
import { requireAuth } from "../auth.js";
import { auditLog, AUDIT_ACTIONS } from "../middleware/audit.js";
import { wsManager } from "../websocket.js";
import { insertChatChannelSchema, insertChannelMessageSchema } from "../../shared/schema.js";
import { autoLinkBridgeChannel, bridgeChannelToRoom } from "./_bridge.js";

export function registerChannelRoutes(app: Express) {
  // ─── Channels ───
  app.get("/api/channels", requireAuth, async (req, res, next) => {
    try {
      const type = req.query.type ? String(req.query.type) : undefined;
      res.json(await storage.getChatChannels(type));
    } catch (e) { next(e); }
  });

  app.get("/api/channels/:id", requireAuth, async (req, res, next) => {
    try {
      const c = await storage.getChatChannel(Number(req.params.id));
      if (!c) return res.status(404).json({ message: "Channel not found" });
      res.json(c);
    } catch (e) { next(e); }
  });

  app.post("/api/channels", requireAuth,
    auditLog({ action: AUDIT_ACTIONS.CREATE, entityType: "chat_channel" }),
    async (req, res, next) => {
      try {
        const user = req.user as Express.User;
        const slug = (req.body.name || "").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 50);
        const data = insertChatChannelSchema.parse({ ...req.body, slug, createdBy: user.id });
        const c = await storage.createChatChannel(data);
        // Auto-join creator
        await storage.addChannelMember({ channelId: c.id, userId: user.id, role: "owner" });
        // Auto-link washer_bridge channels to the washer-ops room
        if (c.type === "washer_bridge") await autoLinkBridgeChannel(c.id);
        res.status(201).json(c);
      } catch (e) { next(e); }
    });

  app.patch("/api/channels/:id", requireAuth,
    auditLog({ action: AUDIT_ACTIONS.UPDATE, entityType: "chat_channel" }),
    async (req, res, next) => {
      try {
        const patchSchema = z.object({
          name: z.string().optional(),
          description: z.string().nullable().optional(),
          type: z.enum(["public", "private", "station", "washer_bridge"]).optional(),
        }).strict();
        const data = patchSchema.parse(req.body);
        const c = await storage.updateChatChannel(Number(req.params.id), data);
        if (!c) return res.status(404).json({ message: "Channel not found" });
        res.json(c);
      } catch (e) { next(e); }
    });

  app.post("/api/channels/:id/archive", requireAuth,
    auditLog({ action: AUDIT_ACTIONS.UPDATE, entityType: "chat_channel" }),
    async (req, res, next) => {
      try {
        const c = await storage.archiveChatChannel(Number(req.params.id));
        if (!c) return res.status(404).json({ message: "Channel not found" });
        res.json(c);
      } catch (e) { next(e); }
    });

  // ─── Members ───
  app.get("/api/channels/:id/members", requireAuth, async (req, res, next) => {
    try {
      res.json(await storage.getChannelMembers(Number(req.params.id)));
    } catch (e) { next(e); }
  });

  app.get("/api/channels/user/memberships", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      res.json(await storage.getUserChannels(user.id));
    } catch (e) { next(e); }
  });

  app.post("/api/channels/:id/join", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const channelId = Number(req.params.id);
      const channel = await storage.getChatChannel(channelId);
      if (!channel) return res.status(404).json({ message: "Channel not found" });
      if (channel.type === "private") return res.status(403).json({ message: "Cannot join private channel directly" });
      const m = await storage.addChannelMember({ channelId, userId: user.id, role: "member" });
      wsManager.broadcast({ type: "member_joined", data: { userId: user.id, channelId }, channel: `channel:${channelId}` });
      res.json(m ?? { channelId, userId: user.id });
    } catch (e) { next(e); }
  });

  app.post("/api/channels/:id/leave", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const channelId = Number(req.params.id);
      await storage.removeChannelMember(channelId, user.id);
      wsManager.broadcast({ type: "member_left", data: { userId: user.id, channelId }, channel: `channel:${channelId}` });
      res.status(204).end();
    } catch (e) { next(e); }
  });

  app.post("/api/channels/:id/read", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const m = await storage.updateChannelMemberReadState(Number(req.params.id), user.id);
      res.json(m ?? {});
    } catch (e) { next(e); }
  });

  // ─── Messages ───
  app.get("/api/channels/:id/messages", requireAuth, async (req, res, next) => {
    try {
      const limit = req.query.limit ? Math.min(Number(req.query.limit), 100) : 50;
      const before = req.query.before ? Number(req.query.before) : undefined;
      res.json(await storage.getChannelMessages(Number(req.params.id), limit, before));
    } catch (e) { next(e); }
  });

  app.post("/api/channels/:id/messages", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const channelId = Number(req.params.id);
      const data = insertChannelMessageSchema.parse({ ...req.body, channelId, userId: user.id });
      const m = await storage.createChannelMessage(data);
      wsManager.broadcast({ type: "channel_message", data: m, channel: `channel:${channelId}` });
      // Bridge to washer room if this is a washer_bridge channel
      bridgeChannelToRoom(channelId, data.content, (m.metadata as Record<string, unknown> | null) ?? undefined);
      res.status(201).json(m);
    } catch (e) { next(e); }
  });

  app.patch("/api/channel-messages/:id", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const msg = await storage.getChannelMessage(Number(req.params.id));
      if (!msg) return res.status(404).json({ message: "Message not found" });
      if (msg.userId !== user.id) return res.status(403).json({ message: "Not your message" });
      const contentSchema = z.object({ content: z.string().min(1).max(4000) }).strict();
      const { content } = contentSchema.parse(req.body);
      const m = await storage.updateChannelMessage(msg.id, content);
      if (m) wsManager.broadcast({ type: "channel_message_edited", data: m, channel: `channel:${msg.channelId}` });
      res.json(m);
    } catch (e) { next(e); }
  });

  app.get("/api/channels/:id/pins", requireAuth, async (req, res, next) => {
    try {
      res.json(await storage.getPinnedMessages(Number(req.params.id)));
    } catch (e) { next(e); }
  });

  app.post("/api/channel-messages/:id/pin", requireAuth, async (req, res, next) => {
    try {
      const m = await storage.togglePinMessage(Number(req.params.id), true);
      if (!m) return res.status(404).json({ message: "Message not found" });
      wsManager.broadcast({ type: "message_pinned", data: m, channel: `channel:${m.channelId}` });
      res.json(m);
    } catch (e) { next(e); }
  });

  app.post("/api/channel-messages/:id/unpin", requireAuth, async (req, res, next) => {
    try {
      const m = await storage.togglePinMessage(Number(req.params.id), false);
      if (!m) return res.status(404).json({ message: "Message not found" });
      wsManager.broadcast({ type: "message_unpinned", data: m, channel: `channel:${m.channelId}` });
      res.json(m);
    } catch (e) { next(e); }
  });

  // ─── Reactions ───
  app.get("/api/channel-messages/:id/reactions", requireAuth, async (req, res, next) => {
    try {
      res.json(await storage.getMessageReactions(Number(req.params.id)));
    } catch (e) { next(e); }
  });

  app.post("/api/channel-messages/:id/reactions", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const emojiSchema = z.object({ emoji: z.string().min(1).max(32) }).strict();
      const { emoji } = emojiSchema.parse(req.body);
      const r = await storage.addReaction({ messageId: Number(req.params.id), userId: user.id, emoji });
      res.status(201).json(r ?? {});
    } catch (e) { next(e); }
  });

  app.delete("/api/channel-messages/:id/reactions/:emoji", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      await storage.removeReaction(Number(req.params.id), user.id, String(req.params.emoji));
      res.status(204).end();
    } catch (e) { next(e); }
  });
}
