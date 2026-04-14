/**
 * Workflow Engine Unit Tests
 * Verifies startWorkflow, advanceWorkflow, cancelWorkflow, and registration.
 */
import { describe, it, expect } from "vitest";
import {
  registerWorkflow,
  getWorkflow,
  allWorkflows,
  startWorkflow,
  advanceWorkflow,
  cancelWorkflow,
} from "../../server/ai/workflows/engine.js";
import type { ToolContext } from "../../server/ai/tools/types.js";

const TEST_WORKFLOW_ID = "test_workflow";

const mockCtx: ToolContext = {
  userId: 1,
  userRole: "admin",
  userDisplayName: "Test User",
  workspaceId: "default",
  conversationId: 100,
  capabilities: {},
};

// Register a simple 2-step test workflow
registerWorkflow({
  id: TEST_WORKFLOW_ID,
  name: "Test Workflow",
  description: "A workflow for testing",
  steps: [
    {
      id: "step1",
      title: "Enter Name",
      description: "Provide a name",
      validate: async (data) => {
        if (!data.name || typeof data.name !== "string") return "Name is required";
        return null;
      },
    },
    {
      id: "step2",
      title: "Confirm",
      description: "Confirm the details",
      execute: async (data) => ({
        content: `Created: ${data.name}`,
        data: { name: data.name },
      }),
    },
  ],
});

describe("Workflow Registration", () => {
  it("registers and retrieves a workflow", () => {
    const def = getWorkflow(TEST_WORKFLOW_ID);
    expect(def).toBeDefined();
    expect(def!.id).toBe(TEST_WORKFLOW_ID);
    expect(def!.name).toBe("Test Workflow");
    expect(def!.steps).toHaveLength(2);
  });

  it("returns undefined for non-existent workflow", () => {
    expect(getWorkflow("nonexistent")).toBeUndefined();
  });

  it("allWorkflows includes the registered workflow", () => {
    const all = allWorkflows();
    expect(all.some(w => w.id === TEST_WORKFLOW_ID)).toBe(true);
  });
});

describe("startWorkflow", () => {
  it("starts a workflow and returns initial state", () => {
    const result = startWorkflow(TEST_WORKFLOW_ID, mockCtx);
    expect(result).not.toBeNull();
    expect(result!.state.workflowId).toBe(TEST_WORKFLOW_ID);
    expect(result!.state.currentStep).toBe(0);
    expect(result!.state.status).toBe("active");
    expect(result!.state.collectedData).toEqual({});
    expect(result!.result.content).toContain("Starting workflow");
    expect(result!.result.content).toContain("Enter Name");
  });

  it("returns null for non-existent workflow", () => {
    expect(startWorkflow("nonexistent", mockCtx)).toBeNull();
  });

  it("initial state has valid startedAt timestamp", () => {
    const result = startWorkflow(TEST_WORKFLOW_ID, mockCtx);
    const ts = new Date(result!.state.startedAt);
    expect(ts.getTime()).not.toBeNaN();
  });
});

describe("advanceWorkflow", () => {
  it("rejects invalid data via validation", async () => {
    const start = startWorkflow(TEST_WORKFLOW_ID, mockCtx)!;
    const { state, result } = await advanceWorkflow(start.state, {}, mockCtx);

    expect(result.isError).toBe(true);
    expect(result.content).toContain("Name is required");
    expect(state.status).toBe("active");
    expect(state.currentStep).toBe(0);
  });

  it("advances to step 2 with valid data", async () => {
    const start = startWorkflow(TEST_WORKFLOW_ID, mockCtx)!;
    const { state, result } = await advanceWorkflow(start.state, { name: "TestVehicle" }, mockCtx);

    expect(result.isError).toBeUndefined();
    expect(state.currentStep).toBe(1);
    expect(state.status).toBe("active");
    expect(state.collectedData.name).toBe("TestVehicle");
    expect(result.content).toContain("Confirm");
  });

  it("completes workflow after all steps", async () => {
    const start = startWorkflow(TEST_WORKFLOW_ID, mockCtx)!;
    const step1 = await advanceWorkflow(start.state, { name: "TestVehicle" }, mockCtx);

    expect(step1.state.status).toBe("active");

    const step2 = await advanceWorkflow(step1.state, {}, mockCtx);
    expect(step2.state.status).toBe("complete");
    expect(step2.result.content).toContain("Created: TestVehicle");
    expect(step2.result.content).toContain("completed successfully");
  });

  it("returns error for unknown workflow ID in state", async () => {
    const fakeState = {
      workflowId: "nonexistent",
      currentStep: 0,
      collectedData: {},
      status: "active" as const,
      startedAt: new Date().toISOString(),
    };

    const { state, result } = await advanceWorkflow(fakeState, {}, mockCtx);
    expect(result.isError).toBe(true);
    expect(result.content).toContain("not found");
    expect(state.status).toBe("cancelled");
  });

  it("merges step data across steps", async () => {
    const start = startWorkflow(TEST_WORKFLOW_ID, mockCtx)!;
    const step1 = await advanceWorkflow(start.state, { name: "ABC", extra: "info" }, mockCtx);

    expect(step1.state.collectedData.name).toBe("ABC");
    expect(step1.state.collectedData.extra).toBe("info");
  });
});

describe("cancelWorkflow", () => {
  it("cancels an active workflow", () => {
    const start = startWorkflow(TEST_WORKFLOW_ID, mockCtx)!;
    const { state, result } = cancelWorkflow(start.state);

    expect(state.status).toBe("cancelled");
    expect(result.content).toContain("cancelled");
  });

  it("preserves collected data on cancel", () => {
    const start = startWorkflow(TEST_WORKFLOW_ID, mockCtx)!;
    const updatedState = { ...start.state, collectedData: { name: "kept" } };
    const { state } = cancelWorkflow(updatedState);

    expect(state.collectedData.name).toBe("kept");
  });
});

describe("Workflow UIBlock timeline", () => {
  it("startWorkflow result includes a status_timeline UIBlock", () => {
    const start = startWorkflow(TEST_WORKFLOW_ID, mockCtx)!;
    expect(start.result.uiBlock).toBeDefined();
    expect((start.result.uiBlock as Record<string, unknown>).type).toBe("status_timeline");
  });

  it("completed workflow timeline shows all steps as complete", async () => {
    const start = startWorkflow(TEST_WORKFLOW_ID, mockCtx)!;
    const step1 = await advanceWorkflow(start.state, { name: "X" }, mockCtx);
    const step2 = await advanceWorkflow(step1.state, {}, mockCtx);

    const block = step2.result.uiBlock as Record<string, unknown>;
    expect(block.type).toBe("status_timeline");
    const steps = (block as { steps: Array<{ status: string }> }).steps;
    for (const s of steps) {
      expect(s.status).toBe("complete");
    }
  });
});
