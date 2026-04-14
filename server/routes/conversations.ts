import type { Express } from "express";
import { z } from "zod/v4";
import { storage } from "../storage.js";
import { requireAuth } from "../auth.js";
import { aiChatLimiter } from "../middleware/rate-limiter.js";
import { sanitizeInput } from "../middleware/validation.js";
import { conversationPatchSchema, ALLOWED_CONTEXT_KEYS, AI_MAX_MESSAGES, AI_MAX_MESSAGE_CHARS, AI_MAX_TOTAL_CHARS, getAnthropicClient } from "./_helpers.js";
import { insertMessageSchema } from "../../shared/schema.js";
import { logger } from "../observability/logger.js";
import { getUserApiKey } from "./apiKeys.js";
import { configResolver } from "../config/resolver.js";
import Anthropic from "@anthropic-ai/sdk";
import { orchestrate } from "../ai/orchestrator.js";
import { buildSystemPrompt, getMemoryContext } from "../ai/systemPrompt.js";
import { resolveAllCapabilities, CAPABILITIES } from "../capabilities/engine.js";
import { getWorkspaceScope } from "../middleware/workspaceContext.js";
import type { ToolContext } from "../ai/tools/types.js";

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

  // AI CHAT (SSE streaming with multi-model support)
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
        model: z.string().optional(), // e.g. "anthropic/claude-sonnet-4-20250514", "openai/gpt-4o"
      }).strict();

      const { conversationId, messages, context, model: requestedModel } = requestSchema.parse(req.body);

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

      // Build workspace memory + system prompt via the prompt builder
      const lastMsg = trimmedMessages[trimmedMessages.length - 1]?.content || '';
      const memoryContext = await getMemoryContext(lastMsg);

      // Resolve capabilities for tool filtering
      const allCaps: Record<string, boolean> = {};
      const resolvedCaps = await resolveAllCapabilities(user.id, user.role);
      for (const cap of CAPABILITIES) {
        allCaps[cap] = resolvedCaps[cap]?.granted ?? false;
      }

      const ws = getWorkspaceScope();
      const toolContext: ToolContext = {
        userId: user.id,
        userRole: user.role,
        userDisplayName: user.displayName,
        workspaceId: ws ?? 'default',
        conversationId,
        capabilities: allCaps,
        screen: safeContext.screen,
      };

      const systemPrompt = buildSystemPrompt(toolContext, safeContext, memoryContext);

      // SSE streaming
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      try {
        // Parse model specification: "provider/model-name" or just use default
        const [provider, modelName] = parseModelSpec(requestedModel);
        let fullResponse = '';
        let metadata: Record<string, unknown> | undefined;

        if (provider !== 'anthropic') {
          // OpenAI-compatible streaming (works with OpenRouter, Google, Mistral via compatible endpoints)
          const userKey = await getUserApiKey(user.id, provider);
          if (!userKey) {
            res.write(`data: ${JSON.stringify({ type: 'error', message: `No ${provider} API key configured. Add one in Settings → API Keys.` })}\n\n`);
            res.end();
            return;
          }

          const baseUrls: Record<string, string> = {
            openai: await configResolver.getString('integrations.openai_base_url'),
            openrouter: await configResolver.getString('integrations.openrouter_base_url'),
            google: await configResolver.getString('integrations.google_genai_base_url'),
            mistral: await configResolver.getString('integrations.mistral_base_url'),
          };
          const baseUrl = baseUrls[provider] || baseUrls.openai;
          const maxTokens = await configResolver.getNumber('ai.max_response_tokens');
          const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${userKey}`,
            },
            body: JSON.stringify({
              model: modelName,
              messages: [{ role: 'system', content: systemPrompt }, ...trimmedMessages],
              max_tokens: maxTokens,
              stream: true,
            }),
          });

          if (!response.ok || !response.body) {
            res.write(`data: ${JSON.stringify({ type: 'error', message: `${provider} API error: ${response.status}` })}\n\n`);
            res.end();
            return;
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
              try {
                const chunk = JSON.parse(line.slice(6));
                const text = chunk.choices?.[0]?.delta?.content;
                if (text) {
                  fullResponse += text;
                  res.write(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`);
                }
              } catch { /* skip malformed chunks */ }
            }
          }
        } else {
          // Default: Anthropic with agentic tool-use loop
          let anthropicClient: Anthropic;
          const userAnthropicKey = await getUserApiKey(user.id, 'anthropic');
          if (userAnthropicKey) {
            anthropicClient = new Anthropic({ apiKey: userAnthropicKey });
          } else {
            anthropicClient = getAnthropicClient();
          }

          const anthropicMaxTokens = await configResolver.getNumber('ai.max_response_tokens');
          const result = await orchestrate({
            client: anthropicClient,
            model: modelName || 'claude-sonnet-4-20250514',
            maxTokens: anthropicMaxTokens,
            systemPrompt,
            messages: trimmedMessages,
            toolContext,
            req,
            res,
          });

          fullResponse = result.fullResponse;
          if (result.metadata.toolCalls?.length || result.metadata.uiBlocks?.length) {
            metadata = result.metadata as unknown as Record<string, unknown>;
          }
        }

        // Save messages
        const lastUserMsg = trimmedMessages[trimmedMessages.length - 1];
        if (lastUserMsg && lastUserMsg.role === 'user') {
          await storage.createMessage({ conversationId, role: 'user', content: typeof lastUserMsg.content === 'string' ? lastUserMsg.content : JSON.stringify(lastUserMsg.content) });
        }
        if (fullResponse) {
          await storage.createMessage({ conversationId, role: 'assistant', content: fullResponse, ...(metadata ? { metadata } : {}) });
        }
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        res.end();

      } catch (err) {
        logger.error('AI chat SSE error', err instanceof Error ? err : undefined, { conversationId, userId: user.id });
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ type: 'error', message: 'AI service error' })}\n\n`);
          res.end();
        }
      }
    } catch (e) { next(e); }
  });

  // Available models endpoint
  app.get("/api/ai/models", requireAuth, (_req, res) => {
    res.json([
      { id: 'anthropic/claude-sonnet-4-20250514', label: 'Claude Sonnet 4', provider: 'anthropic', requiresKey: false },
      { id: 'anthropic/claude-haiku-4-20250514', label: 'Claude Haiku 4', provider: 'anthropic', requiresKey: false },
      { id: 'openai/gpt-4o', label: 'GPT-4o', provider: 'openai', requiresKey: true },
      { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai', requiresKey: true },
      { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'google', requiresKey: true },
      { id: 'mistral/mistral-large-latest', label: 'Mistral Large', provider: 'mistral', requiresKey: true },
    ]);
  });
}

// Parse "provider/model-name" format
function parseModelSpec(spec?: string): [string, string] {
  if (!spec) return ['anthropic', 'claude-sonnet-4-20250514'];
  const slash = spec.indexOf('/');
  if (slash === -1) return ['anthropic', spec];
  return [spec.slice(0, slash), spec.slice(slash + 1)];
}
