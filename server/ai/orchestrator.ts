/**
 * Agent Orchestrator — Runs the Anthropic tool-use loop with SSE streaming.
 *
 * Flow:
 *  1. Send messages + tools to Anthropic → stream response
 *  2. For each tool_use block, execute via registry → send result back
 *  3. Continue until model issues a stop_reason != "tool_use" (max N iterations)
 *  4. Stream text, tool_start, tool_result, and ui_block events via SSE
 */
import Anthropic from "@anthropic-ai/sdk";
import type { Request, Response } from "express";
import { toolRegistry } from "./tools/registry.js";
import type { ToolContext, SSEEvent, MessageMetadata, ToolResult } from "./tools/types.js";
import { logger } from "../observability/logger.js";
import { getCircuitBreaker, CircuitBreakerOpenError } from "../circuitBreaker.js";
import { sanitizeInput } from "../middleware/validation.js";

const MAX_TOOL_ROUNDS = 6;

interface OrchestrateParams {
  client: Anthropic;
  model: string;
  maxTokens: number;
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant"; content: string | Anthropic.ContentBlockParam[] }>;
  toolContext: ToolContext;
  req: Request;
  res: Response;
}

/**
 * Write an SSE event to the response.
 */
function sse(res: Response, event: SSEEvent): void {
  if (!res.writableEnded) {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      // Client disconnected — write failed silently
    }
  }
}

/**
 * Execute a single tool safely with timeout.
 */
async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const tool = toolRegistry.get(toolName);
  if (!tool) {
    return { content: `Unknown tool: ${toolName}`, isError: true };
  }

  // Validate input against schema
  const parsed = tool.inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      content: `Invalid input for ${toolName}: ${parsed.error.message}`,
      isError: true,
    };
  }

  try {
    const timeoutMs = tool.timeoutMs ?? 15_000;
    const result = await Promise.race([
      tool.handler(parsed.data as Record<string, unknown>, ctx),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Tool execution timed out")), timeoutMs)
      ),
    ]);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tool execution failed";
    logger.error(`Tool execution error: ${toolName}`, undefined, { error: message, input });
    return { content: message, isError: true };
  }
}

/**
 * Run the agentic loop: send to Anthropic, handle tool_use, re-send results.
 * Returns metadata about all tool calls and UI blocks for storage.
 */
export async function orchestrate(params: OrchestrateParams): Promise<{
  fullResponse: string;
  metadata: MessageMetadata;
}> {
  const { client, model, maxTokens, systemPrompt, toolContext, req, res } = params;
  let messages = [...params.messages];

  // Detect client disconnect and abort the tool loop early
  let clientDisconnected = false;
  req.on('close', () => { clientDisconnected = true; });

  const anthropicTools = toolRegistry.toAnthropicTools(toolContext);
  const metadata: MessageMetadata = { toolCalls: [], uiBlocks: [], model };

  // Circuit breaker prevents cascading failures when AI provider is down
  const aiBreaker = getCircuitBreaker("ai-provider", {
    failureThreshold: 5,
    resetTimeoutMs: 30_000,
    halfOpenMax: 2,
  });

  // Inject SSE emitter into the context so tools can stream pipeline events
  const ctxWithEmitter: ToolContext = {
    ...toolContext,
    emitEvent: (event) => sse(res, event),
  };

  let fullTextResponse = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (clientDisconnected) break;

    // Build the request; only include tools if we have any
    const requestParams: Anthropic.MessageCreateParams = {
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: messages as Anthropic.MessageParam[],
      ...(anthropicTools.length > 0 ? { tools: anthropicTools as Anthropic.Tool[] } : {}),
    };

    let response: Anthropic.Message;
    try {
      response = await aiBreaker.execute(() => client.messages.create(requestParams));
    } catch (err) {
      if (err instanceof CircuitBreakerOpenError) {
        sse(res, { type: "error", message: "AI service is temporarily unavailable. Please try again shortly." });
        return { fullResponse: "", metadata };
      }
      throw err;
    }

    // Process content blocks
    const toolUseBlocks: Anthropic.ToolUseBlock[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        fullTextResponse += block.text;
        sse(res, { type: "text", content: block.text });
      } else if (block.type === "tool_use") {
        toolUseBlocks.push(block);
      }
    }

    // If no tool calls, we're done
    if (response.stop_reason !== "tool_use" || toolUseBlocks.length === 0) {
      break;
    }

    // Execute each tool call
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      const startMs = Date.now();

      sse(res, {
        type: "tool_start",
        toolUseId: toolUse.id,
        name: toolUse.name,
        input: toolUse.input as Record<string, unknown>,
      });

      const result = await executeTool(
        toolUse.name,
        toolUse.input as Record<string, unknown>,
        ctxWithEmitter,
      );

      // Sanitize tool output to prevent prompt injection / XSS in streamed content
      const safeContent = sanitizeInput(result.content);

      const durationMs = Date.now() - startMs;

      // Stream result + UI blocks
      sse(res, {
        type: "tool_result",
        toolUseId: toolUse.id,
        name: toolUse.name,
        result: safeContent,
        uiBlock: result.uiBlock,
        isError: result.isError,
      });

      if (result.uiBlock) {
        sse(res, { type: "ui_block", block: result.uiBlock });
        metadata.uiBlocks!.push(result.uiBlock);
      }

      // Record in metadata
      metadata.toolCalls!.push({
        id: toolUse.id,
        name: toolUse.name,
        input: toolUse.input as Record<string, unknown>,
        result: safeContent,
        uiBlock: result.uiBlock,
        isError: result.isError,
        durationMs,
      });

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: safeContent,
        is_error: result.isError,
      });
    }

    // Feed results back to the model for next round
    messages = [
      ...messages,
      { role: "assistant" as const, content: response.content as Anthropic.ContentBlockParam[] },
      { role: "user" as const, content: toolResults as Anthropic.ContentBlockParam[] },
    ];
  }

  return { fullResponse: fullTextResponse, metadata };
}
