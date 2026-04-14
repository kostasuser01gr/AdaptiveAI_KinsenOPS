/**
 * Agentic AI Type System — Tool definitions, results, context, and UIBlock protocol.
 * Phase 7: Foundation types for the tool-calling agent layer.
 *
 * UIBlock, SSEEvent, and MessageMetadata are now defined in shared/ai-types.ts
 * as the single source of truth for both server and client.
 */
import { z } from "zod/v4";

// Re-export shared types so existing imports continue to work
export type {
  UIBlock,
  MetricItem,
  TableColumn,
  TableRowAction,
  FormField,
  SSEEvent,
  MessageMetadata,
} from "../../../shared/ai-types.js";

import type { SSEEvent, UIBlock } from "../../../shared/ai-types.js";

// ─── Tool Context ────────────────────────────────────────────────────────────

/** Contextual information available to every tool execution. */
export interface ToolContext {
  userId: number;
  userRole: string;
  userDisplayName: string;
  workspaceId: string;
  conversationId: number;
  /** Pre-resolved capabilities for the current user. */
  capabilities: Record<string, boolean>;
  /** Screen / page context from the client (e.g. "fleet", "washers"). */
  screen?: string;
  /** Optional SSE emitter for streaming pipeline progress during tool execution. */
  emitEvent?: (event: SSEEvent) => void;
}

// ─── Tool Result ─────────────────────────────────────────────────────────────

/** The return value from a tool handler. */
export interface ToolResult {
  /** Text summary sent back to the AI as the tool_result content. */
  content: string;
  /** Optional structured data (logged/stored, but not sent to AI). */
  data?: unknown;
  /** Optional UI block to render in the chat. */
  uiBlock?: UIBlock;
  /** If true, signals the AI that this is an error result. */
  isError?: boolean;
}

// ─── Tool Definition ─────────────────────────────────────────────────────────

export interface ToolDefinition {
  /** Unique tool name (lowercase, underscored). Must match Anthropic's tool name format. */
  name: string;
  /** Short description for the AI (what the tool does, when to use it). */
  description: string;
  /** Zod schema for the tool's input parameters. */
  inputSchema: z.ZodObject<z.ZodRawShape>;
  /** Minimum role level to access this tool. Uses role hierarchy: admin > supervisor > coordinator > agent. */
  requiredRole?: string;
  /** Fine-grained capability required (resolved via capability engine). */
  requiredCapability?: string;
  /** Custom timeout in ms for this tool (default: 15 000). */
  timeoutMs?: number;
  /** The async handler that executes the tool. */
  handler: (input: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
}
