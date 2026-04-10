import type { Express } from "express";
import { z } from "zod/v4";
import { requireAuth, requireRole } from "../auth.js";
import { storage } from "../storage.js";
import { modelGateway } from "../ai/gateway.js";

export function registerModelGatewayRoutes(app: Express) {
  // List registered providers
  app.get("/api/ai/providers", requireAuth, async (_req, res, next) => {
    try {
      res.json(modelGateway.getProviders());
    } catch (e) { next(e); }
  });

  // Chat via gateway
  app.post("/api/ai/gateway/chat", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as Express.User;
      const bodySchema = z.object({
        provider: z.string().default("anthropic"),
        model: z.string().optional(),
        messages: z.array(z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().min(1).max(4000),
        })).min(1).max(20),
        systemPrompt: z.string().max(8000).optional(),
        maxTokens: z.number().min(1).max(4096).optional(),
        temperature: z.number().min(0).max(2).optional(),
      }).strict();
      const body = bodySchema.parse(req.body);

      const result = await modelGateway.chat(body.provider, {
        model: body.model || "",
        messages: body.messages,
        systemPrompt: body.systemPrompt,
        maxTokens: body.maxTokens,
        temperature: body.temperature,
      }, { userId: user.id, feature: "gateway" });

      res.json(result);
    } catch (e) { next(e); }
  });

  // Usage stats
  app.get("/api/ai/usage", requireAuth, requireRole("admin", "supervisor"), async (req, res, next) => {
    try {
      const filters: { provider?: string; feature?: string; userId?: number; limit?: number } = {};
      if (req.query.provider) filters.provider = String(req.query.provider);
      if (req.query.feature) filters.feature = String(req.query.feature);
      if (req.query.userId) filters.userId = Number(req.query.userId);
      if (req.query.limit) filters.limit = Math.min(Number(req.query.limit), 500);
      res.json(await storage.getAiModelUsage(filters));
    } catch (e) { next(e); }
  });
}
