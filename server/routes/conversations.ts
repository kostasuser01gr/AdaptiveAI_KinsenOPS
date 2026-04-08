import type { Express } from "express";
import { z } from "zod/v4";
import { storage } from "../storage.js";
import { requireAuth } from "../auth.js";
import { aiChatLimiter } from "../middleware/rate-limiter.js";
import { sanitizeInput } from "../middleware/validation.js";
import { conversationPatchSchema, ALLOWED_CONTEXT_KEYS, AI_MAX_MESSAGES, AI_MAX_MESSAGE_CHARS, AI_MAX_TOTAL_CHARS, getAnthropicClient } from "./_helpers.js";
import { insertMessageSchema } from "../../shared/schema.js";

export function registerConversationRoutes(app: Express) {
  // CONVERSATIONS
  app.get("/api/conversations", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      res.json(await storage.getConversations(userId));
    } catch (e) { next(e); }
  });

  app.post("/api/conversations", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const title = req.body.title || "New Conversation";
      res.status(201).json(await storage.createConversation({ userId, title }));
    } catch (e) { next(e); }
  });

  app.patch("/api/conversations/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const conv = await storage.getConversation(Number(req.params.id));
      if (!conv) return res.status(404).json({ message: "Not found" });
      if (conv.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      const c = await storage.updateConversation(Number(req.params.id), conversationPatchSchema.parse(req.body));
      if (!c) return res.status(404).json({ message: "Not found" });
      res.json(c);
    } catch (e) { next(e); }
  });

  app.delete("/api/conversations/:id", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const conv = await storage.getConversation(Number(req.params.id));
      if (!conv) return res.status(404).json({ message: "Not found" });
      if (conv.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      await storage.deleteConversation(Number(req.params.id));
      res.status(204).end();
    } catch (e) { next(e); }
  });

  // MESSAGES
  app.get("/api/conversations/:id/messages", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const conv = await storage.getConversation(Number(req.params.id));
      if (!conv) return res.status(404).json({ message: "Not found" });
      if (conv.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      res.json(await storage.getMessages(Number(req.params.id)));
    } catch (e) { next(e); }
  });

  app.post("/api/conversations/:id/messages", requireAuth, async (req, res, next) => {
    try {
      const userId = (req.user as Express.User).id;
      const conv = await storage.getConversation(Number(req.params.id));
      if (!conv) return res.status(404).json({ message: "Not found" });
      if (conv.userId !== userId) return res.status(403).json({ message: "Forbidden" });
      const data = insertMessageSchema.parse({ ...req.body, conversationId: Number(req.params.id) });
      res.status(201).json(await storage.createMessage(data));
    } catch (e) { next(e); }
  });

  // AI CHAT (SSE streaming)
  app.post("/api/ai/chat", requireAuth, aiChatLimiter, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const requestSchema = z.object({
        conversationId: z.number(),
        messages: z.array(z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().min(1).max(AI_MAX_MESSAGE_CHARS),
        })).min(1).max(AI_MAX_MESSAGES),
        context: z.record(z.string(), z.unknown()).optional(),
      }).strict();

      const { conversationId, messages, context } = requestSchema.parse(req.body);

      // Ownership check
      const conv = await storage.getConversation(conversationId);
      if (!conv || conv.userId !== user.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Sanitize context keys
      const safeContext: Record<string, string> = {};
      if (context) {
        for (const [k, v] of Object.entries(context)) {
          if (ALLOWED_CONTEXT_KEYS.includes(k) && typeof v === 'string') {
            safeContext[k] = sanitizeInput(v).slice(0, 200);
          }
        }
      }

      // Enforce total character limit
      const validatedMessages = messages.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content.slice(0, AI_MAX_MESSAGE_CHARS),
      }));

      let totalChars = 0;
      const trimmedMessages: typeof validatedMessages = [];
      for (let i = validatedMessages.length - 1; i >= 0; i--) {
        if (totalChars + validatedMessages[i].content.length > AI_MAX_TOTAL_CHARS) break;
        totalChars += validatedMessages[i].content.length;
        trimmedMessages.unshift(validatedMessages[i]);
      }

      // Inject workspace memory
      let memoryContext = '';
      try {
        const allMemory = await storage.getWorkspaceMemory();
        if (allMemory.length > 0) {
          const lastMsg = trimmedMessages[trimmedMessages.length - 1]?.content?.toLowerCase() || '';
          const queryTokens = lastMsg.split(/\s+/).filter(t => t.length > 2).slice(0, 10);

          const scored = allMemory.map(entry => {
            let score = entry.confidence;
            const keyLower = entry.key.toLowerCase();
            const valueLower = entry.value.toLowerCase();
            for (const token of queryTokens) {
              if (keyLower.includes(token)) score += 2;
              if (valueLower.includes(token)) score += 1;
            }
            return { entry, score };
          });

          const topEntries = scored
            .filter(s => s.score > 1)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

          if (topEntries.length > 0) {
            memoryContext = '\n\nWorkspace context:\n' + topEntries
              .map(s => `- ${s.entry.key}: ${s.entry.value}`)
              .join('\n')
              .slice(0, 1500);
          }
        }
      } catch {
        // Memory retrieval failure is non-fatal
      }

      const systemPrompt = `You are the AdaptiveAI operations assistant for a fleet-management platform. ` +
        `User: ${user.displayName} (${user.role}). ` +
        (Object.keys(safeContext).length > 0 ? `Context: ${JSON.stringify(safeContext)}. ` : '') +
        `Be concise, actionable, and reference real data when possible.` +
        memoryContext;

      // SSE streaming
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      try {
        const anthropic = getAnthropicClient();
        const stream = anthropic.messages.stream({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: systemPrompt,
          messages: trimmedMessages,
        });

        let fullResponse = '';

        stream.on('text', (text) => {
          fullResponse += text;
          res.write(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`);
        });

        stream.on('end', async () => {
          // Save user message + assistant response
          const lastUserMsg = trimmedMessages[trimmedMessages.length - 1];
          if (lastUserMsg && lastUserMsg.role === 'user') {
            await storage.createMessage({
              conversationId,
              role: 'user',
              content: lastUserMsg.content,
            });
          }
          if (fullResponse) {
            await storage.createMessage({
              conversationId,
              role: 'assistant',
              content: fullResponse,
            });
          }
          res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
          res.end();
        });

        stream.on('error', (error) => {
          res.write(`data: ${JSON.stringify({ type: 'error', message: 'AI service error' })}\n\n`);
          res.end();
        });
      } catch (err) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Failed to connect to AI service' })}\n\n`);
        res.end();
      }
    } catch (e) { next(e); }
  });
}
