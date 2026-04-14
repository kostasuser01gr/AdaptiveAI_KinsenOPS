/**
 * Workflow Tools — Tools the AI can call to start, advance, and cancel workflows.
 */
import { z } from "zod/v4";
import { toolRegistry } from "../registry.js";
import {
  allWorkflows,
  getWorkflow,
  startWorkflow,
  advanceWorkflow,
  cancelWorkflow,
  type WorkflowState,
} from "../../workflows/engine.js";
import type { ToolContext } from "../types.js";

// In-memory workflow state per user session (conversation-scoped).
// In production this would be persisted in conversation metadata.
const activeWorkflows = new Map<number, WorkflowState>();

function keyFor(ctx: ToolContext): number {
  return ctx.userId;
}

// ─── List available workflows ────────────────────────────────────

toolRegistry.register({
  name: "list_workflows",
  description: "List available multi-step workflows the user can initiate (e.g. vehicle onboard, incident report, reservation create).",
  inputSchema: z.object({}),
  handler: async (_input, ctx) => {
    const all = allWorkflows();
    const available = all.filter(w => {
      if (!w.requiredRole) return true;
      const hierarchy: Record<string, number> = { agent: 1, coordinator: 2, supervisor: 3, admin: 4 };
      return (hierarchy[ctx.userRole] ?? 0) >= (hierarchy[w.requiredRole] ?? 0);
    });

    if (available.length === 0) {
      return { content: "No workflows available for your role." };
    }

    return {
      content: `Available workflows:\n${available.map(w => `• **${w.name}** (${w.id}): ${w.description}`).join("\n")}`,
      uiBlock: {
        type: "action_panel",
        title: "Start a Workflow",
        actions: available.map(w => ({
          label: w.name,
          toolName: "start_workflow",
          params: { workflowId: w.id },
        })),
      },
    };
  },
});

// ─── Start a workflow ────────────────────────────────────────────

toolRegistry.register({
  name: "start_workflow",
  description: "Start a multi-step workflow. Available workflows: vehicle_onboard, incident_report, reservation_create.",
  inputSchema: z.object({
    workflowId: z.string().describe("The workflow ID to start"),
  }),
  handler: async (input, ctx) => {
    const existing = activeWorkflows.get(keyFor(ctx));
    if (existing && existing.status === "active") {
      return {
        content: `You already have an active workflow: "${existing.workflowId}". Please complete or cancel it first.`,
        isError: true,
      };
    }

    const result = startWorkflow(input.workflowId as string, ctx);
    if (!result) {
      return { content: `Workflow "${input.workflowId}" not found.`, isError: true };
    }

    activeWorkflows.set(keyFor(ctx), result.state);
    const def = getWorkflow(input.workflowId as string)!;
    const firstStep = def.steps[0];
    const uiBlock = firstStep.uiBlock ? firstStep.uiBlock(result.state.collectedData, ctx) : result.result.uiBlock;

    return {
      content: result.result.content,
      uiBlock,
    };
  },
});

// ─── Advance a workflow ──────────────────────────────────────────

toolRegistry.register({
  name: "workflow_advance",
  description: "Advance the current active workflow with collected data from the previous step.",
  inputSchema: z.object({
    stepData: z.record(z.string(), z.unknown()).optional().describe("Data collected in the current step"),
  }),
  handler: async (input, ctx) => {
    const state = activeWorkflows.get(keyFor(ctx));
    if (!state || state.status !== "active") {
      return { content: "No active workflow to advance.", isError: true };
    }

    const result = await advanceWorkflow(state, (input.stepData ?? {}) as Record<string, unknown>, ctx);
    activeWorkflows.set(keyFor(ctx), result.state);

    if (result.state.status === "complete") {
      activeWorkflows.delete(keyFor(ctx));
    }

    return result.result;
  },
});

// ─── Cancel a workflow ───────────────────────────────────────────

toolRegistry.register({
  name: "cancel_workflow",
  description: "Cancel the current active workflow.",
  inputSchema: z.object({}),
  handler: async (_input, ctx) => {
    const state = activeWorkflows.get(keyFor(ctx));
    if (!state || state.status !== "active") {
      return { content: "No active workflow to cancel." };
    }

    const result = cancelWorkflow(state);
    activeWorkflows.delete(keyFor(ctx));
    return result.result;
  },
});
