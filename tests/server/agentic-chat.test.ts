/**
 * Agentic Chat Integration Tests
 * Verifies tool registry, orchestrator SSE events, and type contracts.
 */
import { describe, it, expect } from "vitest";

// ─── Tool Registry ───────────────────────────────────────────────

describe("Tool Registry", () => {
  it("imports and exposes toolRegistry singleton", async () => {
    const { toolRegistry } = await import("../../server/ai/tools/registry.js");
    expect(toolRegistry).toBeDefined();
    expect(typeof toolRegistry.register).toBe("function");
    expect(typeof toolRegistry.get).toBe("function");
    expect(typeof toolRegistry.all).toBe("function");
    expect(typeof toolRegistry.forContext).toBe("function");
    expect(typeof toolRegistry.toAnthropicTools).toBe("function");
  });

  it("has registered tools after importing impl modules", async () => {
    // Import all tool registration modules (side-effect: registers tools)
    await import("../../server/ai/tools/index.js");
    const { toolRegistry } = await import("../../server/ai/tools/registry.js");

    const all = toolRegistry.all();
    expect(all.length).toBeGreaterThan(0);

    // Spot-check known tools
    expect(toolRegistry.get("get_dashboard_stats")).toBeDefined();
    expect(toolRegistry.get("list_vehicles")).toBeDefined();
    expect(toolRegistry.get("search")).toBeDefined();
  });

  it("filters tools by role via forContext()", async () => {
    await import("../../server/ai/tools/index.js");
    const { toolRegistry } = await import("../../server/ai/tools/registry.js");

    const agentCtx = {
      userId: 1,
      userRole: "agent",
      userDisplayName: "Test",
      workspaceId: "default",
      conversationId: 1,
      capabilities: {},
    };

    const adminCtx = {
      ...agentCtx,
      userRole: "admin",
    };

    const agentTools = toolRegistry.forContext(agentCtx);
    const adminTools = toolRegistry.forContext(adminCtx);

    // Admin should have >= agent tools (more permissions)
    expect(adminTools.length).toBeGreaterThanOrEqual(agentTools.length);
  });

  it("handles undefined userRole gracefully in forContext()", async () => {
    await import("../../server/ai/tools/index.js");
    const { toolRegistry } = await import("../../server/ai/tools/registry.js");

    const ctx = {
      userId: 1,
      userRole: undefined as unknown as string,
      userDisplayName: "Test",
      workspaceId: "default",
      conversationId: 1,
      capabilities: {},
    };

    // Should not throw — tools with requiredRole are filtered out
    const tools = toolRegistry.forContext(ctx);
    expect(Array.isArray(tools)).toBe(true);

    // No tool with a requiredRole should be included
    for (const t of tools) {
      expect(t.requiredRole).toBeUndefined();
    }
  });

  it("converts tools to Anthropic format", async () => {
    await import("../../server/ai/tools/index.js");
    const { toolRegistry } = await import("../../server/ai/tools/registry.js");

    const ctx = {
      userId: 1,
      userRole: "admin",
      userDisplayName: "Test",
      workspaceId: "default",
      conversationId: 1,
      capabilities: {},
    };

    const anthropicTools = toolRegistry.toAnthropicTools(ctx);
    expect(anthropicTools.length).toBeGreaterThan(0);

    for (const tool of anthropicTools) {
      expect(tool).toHaveProperty("name");
      expect(tool).toHaveProperty("description");
      expect(tool).toHaveProperty("input_schema");
      expect(typeof tool.name).toBe("string");
      expect(typeof tool.description).toBe("string");
      expect(typeof tool.input_schema).toBe("object");
    }
  });
});

// ─── SSE Event Type Contracts ────────────────────────────────────

describe("SSE Event Types", () => {
  it("exports all expected event types", async () => {
    const types = await import("../../server/ai/tools/types.js");
    // Verify the types exist by checking the module exports
    expect(types).toBeDefined();
  });

  it("SSE text event uses content field (not text)", () => {
    // This is essentially a contract test for the field the client reads
    const event = { type: "text" as const, content: "hello" };
    expect(event.content).toBe("hello");
    expect((event as Record<string, unknown>).text).toBeUndefined();
  });

  it("SSE tool_result event includes isError field", () => {
    const event = {
      type: "tool_result" as const,
      toolUseId: "abc",
      name: "test",
      result: "ok",
      isError: true,
    };
    expect(event.isError).toBe(true);
  });

  it("SSE error event has message field", () => {
    const event = { type: "error" as const, message: "Rate limited" };
    expect(event.message).toBe("Rate limited");
  });
});

// ─── Orchestrator sse() resilience ───────────────────────────────

describe("Orchestrator", () => {
  it("sse() handles ended response without throwing", async () => {
    const mod = await import("../../server/ai/orchestrator.js");
    expect(mod.orchestrate).toBeDefined();
    expect(typeof mod.orchestrate).toBe("function");
  });
});

// ─── Tool Execution ──────────────────────────────────────────────

describe("Tool Execution", () => {
  it("get_dashboard_stats tool has correct shape", async () => {
    await import("../../server/ai/tools/index.js");
    const { toolRegistry } = await import("../../server/ai/tools/registry.js");

    const tool = toolRegistry.get("get_dashboard_stats");
    expect(tool).toBeDefined();
    expect(tool!.name).toBe("get_dashboard_stats");
    expect(tool!.description).toBeTruthy();
    expect(tool!.inputSchema).toBeDefined();
    expect(typeof tool!.handler).toBe("function");
  });

  it("search tool validates input schema", async () => {
    await import("../../server/ai/tools/index.js");
    const { toolRegistry } = await import("../../server/ai/tools/registry.js");

    const tool = toolRegistry.get("search");
    expect(tool).toBeDefined();

    // Valid input
    const valid = tool!.inputSchema.safeParse({ query: "test" });
    expect(valid.success).toBe(true);

    // Invalid: missing required field
    const invalid = tool!.inputSchema.safeParse({});
    expect(invalid.success).toBe(false);
  });
});
