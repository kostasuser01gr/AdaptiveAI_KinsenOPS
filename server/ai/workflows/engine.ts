/**
 * Workflow Engine — Tracks multi-step workflow state per conversation.
 * State is stored in conversation metadata JSONB.
 * The AI recognises workflow-triggering intents and calls workflow tools
 * to advance through steps.
 */
import { z } from "zod/v4";
import type { UIBlock, ToolResult, ToolContext } from "../tools/types.js";

// ─── Workflow types ──────────────────────────────────────────────

export interface WorkflowStep {
  id: string;
  title: string;
  /** What this step collects or does. */
  description: string;
  /** If set, the AI emits this UIBlock to collect data from the user. */
  uiBlock?: (collected: Record<string, unknown>, ctx: ToolContext) => UIBlock;
  /** Validate data collected so far. Return error message or null. */
  validate?: (collected: Record<string, unknown>, ctx: ToolContext) => Promise<string | null>;
  /** Execute side-effects for this step. Called after validation passes. */
  execute?: (collected: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  /** Minimum role required to initiate. */
  requiredRole?: string;
  steps: WorkflowStep[];
}

export interface WorkflowState {
  workflowId: string;
  currentStep: number;
  collectedData: Record<string, unknown>;
  status: "active" | "complete" | "cancelled";
  startedAt: string;
}

// ─── Workflow registry ───────────────────────────────────────────

const workflows = new Map<string, WorkflowDefinition>();

export function registerWorkflow(def: WorkflowDefinition) {
  workflows.set(def.id, def);
}

export function getWorkflow(id: string): WorkflowDefinition | undefined {
  return workflows.get(id);
}

export function allWorkflows(): WorkflowDefinition[] {
  return Array.from(workflows.values());
}

// ─── Engine functions ────────────────────────────────────────────

/** Start a new workflow. Returns the initial UIBlock + timeline. */
export function startWorkflow(workflowId: string, ctx: ToolContext): { state: WorkflowState; result: ToolResult } | null {
  const def = workflows.get(workflowId);
  if (!def) return null;

  const state: WorkflowState = {
    workflowId,
    currentStep: 0,
    collectedData: {},
    status: "active",
    startedAt: new Date().toISOString(),
  };

  const timeline = buildTimeline(def, state);

  return {
    state,
    result: {
      content: `Starting workflow: ${def.name}\nStep 1 of ${def.steps.length}: ${def.steps[0].title}`,
      uiBlock: timeline,
    },
  };
}

/** Advance workflow with new data. Validates, executes, moves to next step. */
export async function advanceWorkflow(
  state: WorkflowState,
  stepData: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ state: WorkflowState; result: ToolResult }> {
  const def = workflows.get(state.workflowId);
  if (!def) {
    return {
      state: { ...state, status: "cancelled" },
      result: { content: "Workflow definition not found.", isError: true },
    };
  }

  const step = def.steps[state.currentStep];
  if (!step) {
    return {
      state: { ...state, status: "complete" },
      result: { content: "Workflow already complete." },
    };
  }

  // Merge new data
  const collected = { ...state.collectedData, ...stepData };

  // Validate
  if (step.validate) {
    const error = await step.validate(collected, ctx);
    if (error) {
      return {
        state: { ...state, collectedData: collected },
        result: { content: `Validation error on "${step.title}": ${error}`, isError: true },
      };
    }
  }

  // Execute side-effects
  let executeResult: ToolResult | undefined;
  if (step.execute) {
    executeResult = await step.execute(collected, ctx);
    if (executeResult.isError) {
      return {
        state: { ...state, collectedData: collected },
        result: executeResult,
      };
    }
  }

  // Advance to next step
  const nextStep = state.currentStep + 1;
  const isComplete = nextStep >= def.steps.length;

  const newState: WorkflowState = {
    ...state,
    currentStep: nextStep,
    collectedData: collected,
    status: isComplete ? "complete" : "active",
  };

  if (isComplete) {
    const timeline = buildTimeline(def, newState);
    return {
      state: newState,
      result: {
        content: executeResult?.content
          ? `${executeResult.content}\n\nWorkflow "${def.name}" completed successfully.`
          : `Workflow "${def.name}" completed successfully.`,
        data: executeResult?.data,
        uiBlock: timeline,
      },
    };
  }

  // Emit next step's UIBlock or timeline
  const nextDef = def.steps[nextStep];
  const timeline = buildTimeline(def, newState);
  const nextBlock = nextDef.uiBlock ? nextDef.uiBlock(collected, ctx) : undefined;

  return {
    state: newState,
    result: {
      content: executeResult?.content
        ? `${executeResult.content}\n\nStep ${nextStep + 1} of ${def.steps.length}: ${nextDef.title}\n${nextDef.description}`
        : `Step ${nextStep + 1} of ${def.steps.length}: ${nextDef.title}\n${nextDef.description}`,
      data: executeResult?.data,
      uiBlock: nextBlock ?? timeline,
    },
  };
}

/** Cancel an active workflow. */
export function cancelWorkflow(state: WorkflowState): { state: WorkflowState; result: ToolResult } {
  return {
    state: { ...state, status: "cancelled" },
    result: { content: "Workflow cancelled." },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────

function buildTimeline(def: WorkflowDefinition, state: WorkflowState): UIBlock {
  return {
    type: "status_timeline",
    title: def.name,
    steps: def.steps.map((s, i) => ({
      label: s.title,
      description: s.description,
      status: i < state.currentStep
        ? "complete"
        : i === state.currentStep && state.status === "active"
          ? "active"
          : state.status === "complete"
            ? "complete"
            : "pending",
    })),
  } as UIBlock;
}
