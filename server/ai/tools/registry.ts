/**
 * Tool Registry — Central registry for all agentic tools.
 * Handles registration, role-based filtering, and JSON Schema conversion.
 */
import { z } from "zod/v4";
import type { ToolDefinition, ToolContext } from "./types.js";
import { isRoleAtLeast } from "../../../shared/roles.js";

class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered.`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /** All registered tools. */
  all(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /** Tools available for a specific user context (role + capabilities). */
  forContext(ctx: ToolContext): ToolDefinition[] {
    return this.all().filter((tool) => {
      if (tool.requiredRole && (!ctx.userRole || !isRoleAtLeast(ctx.userRole, tool.requiredRole))) {
        return false;
      }
      if (tool.requiredCapability && !ctx.capabilities[tool.requiredCapability]) {
        return false;
      }
      return true;
    });
  }

  /** Convert a tool into Anthropic's tool format for messages.create({ tools }). */
  toAnthropicTool(tool: ToolDefinition): { name: string; description: string; input_schema: Record<string, unknown> } {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: z.toJSONSchema(tool.inputSchema) as Record<string, unknown>,
    };
  }

  /** Convert context-filtered tools into Anthropic's tools array. */
  toAnthropicTools(ctx: ToolContext): Array<{ name: string; description: string; input_schema: Record<string, unknown> }> {
    return this.forContext(ctx).map((t) => this.toAnthropicTool(t));
  }
}

export const toolRegistry = new ToolRegistry();
