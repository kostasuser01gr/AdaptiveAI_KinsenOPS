/**
 * AI Model Gateway — Multi-provider adapter with usage tracking.
 * Phase 5: Foundation layer for model-agnostic AI operations.
 */
import Anthropic from "@anthropic-ai/sdk";
import { storage } from "../storage.js";
import { getWorkspaceScope } from "../middleware/workspaceContext.js";
import { config } from "../config.js";

// ─── Provider Adapter Interface ───
export interface ModelAdapter {
  provider: string;
  chat(params: ChatParams): Promise<ChatResult>;
}

export interface ChatParams {
  model: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface ChatResult {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

// ─── Anthropic Adapter ───
class AnthropicAdapter implements ModelAdapter {
  provider = "anthropic" as const;
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic();
  }

  async chat(params: ChatParams): Promise<ChatResult> {
    const start = Date.now();
    const response = await this.client.messages.create({
      model: params.model || "claude-sonnet-4-20250514",
      max_tokens: params.maxTokens ?? 1024,
      system: params.systemPrompt,
      messages: params.messages,
    });
    const latencyMs = Date.now() - start;

    const content = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map(b => b.text)
      .join("");

    return {
      content,
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      latencyMs,
    };
  }
}

// ─── Gateway ───
class ModelGateway {
  private adapters: Map<string, ModelAdapter> = new Map();

  constructor() {
    // Register built-in adapters
    if (config.anthropicApiKey) {
      this.register(new AnthropicAdapter());
    }
  }

  register(adapter: ModelAdapter) {
    this.adapters.set(adapter.provider, adapter);
  }

  getProviders(): string[] {
    return Array.from(this.adapters.keys());
  }

  async chat(provider: string, params: ChatParams, meta?: { userId?: number; feature?: string }): Promise<ChatResult> {
    const adapter = this.adapters.get(provider);
    if (!adapter) throw new Error(`Unknown provider: ${provider}. Available: ${this.getProviders().join(", ")}`);

    const result = await adapter.chat(params);

    // Record usage asynchronously (fire-and-forget)
    try {
      const wsId = getWorkspaceScope();
      await storage.createAiModelUsage({
        workspaceId: wsId,
        provider,
        model: result.model,
        userId: meta?.userId,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        latencyMs: result.latencyMs,
        feature: meta?.feature ?? "chat",
      });
    } catch {
      // Non-critical — don't fail the request if usage tracking fails
    }

    return result;
  }
}

export const modelGateway = new ModelGateway();
