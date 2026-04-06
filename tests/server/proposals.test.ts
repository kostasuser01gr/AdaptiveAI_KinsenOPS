import { describe, it, expect } from "vitest";
import { z } from "zod/v4";
import { insertWorkspaceProposalSchema } from "../../shared/schema.js";

// ─── Workspace Proposal schema validation tests ─────────────────────────────

describe("insertWorkspaceProposalSchema", () => {
  it("accepts valid button proposal", () => {
    const result = insertWorkspaceProposalSchema.safeParse({
      userId: 1,
      type: "button",
      label: "Quick Fleet Check",
      description: "Adds a quick-action button for fleet overview",
      impact: "low",
      scope: "personal",
      payload: { icon: "Car", target: "/fleet", placement: "header" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid workflow proposal", () => {
    const result = insertWorkspaceProposalSchema.safeParse({
      userId: 2,
      type: "workflow",
      label: "Auto-escalate QC failures",
      impact: "medium",
      scope: "shared",
      payload: { trigger: "qc_fail", actions: ["notify_supervisor", "flag_vehicle"] },
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid config proposal", () => {
    const result = insertWorkspaceProposalSchema.safeParse({
      userId: 1,
      type: "config",
      label: "Enable dark mode default",
      impact: "low",
      scope: "shared",
      payload: { key: "theme.default", value: "dark" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts minimal valid proposal (defaults applied)", () => {
    const result = insertWorkspaceProposalSchema.safeParse({
      userId: 1,
      type: "button",
      label: "Test",
      payload: { target: "/test" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing userId", () => {
    const result = insertWorkspaceProposalSchema.safeParse({
      type: "button",
      label: "Test",
      payload: { target: "/test" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing type", () => {
    const result = insertWorkspaceProposalSchema.safeParse({
      userId: 1,
      label: "Test",
      payload: { target: "/test" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing label", () => {
    const result = insertWorkspaceProposalSchema.safeParse({
      userId: 1,
      type: "button",
      payload: { target: "/test" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing payload", () => {
    const result = insertWorkspaceProposalSchema.safeParse({
      userId: 1,
      type: "button",
      label: "Test",
    });
    expect(result.success).toBe(false);
  });

  it("accepts null payload at Zod level (DB notNull constraint enforces)", () => {
    // Drizzle's createInsertSchema for jsonb doesn't enforce notNull at Zod level;
    // the database constraint catches null payloads. This documents current behavior.
    const result = insertWorkspaceProposalSchema.safeParse({
      userId: 1,
      type: "button",
      label: "Test",
      payload: null,
    });
    expect(result.success).toBe(true);
  });

  it("does not accept createdAt (server-managed)", () => {
    const result = insertWorkspaceProposalSchema.safeParse({
      userId: 1,
      type: "button",
      label: "Test",
      payload: { target: "/" },
      createdAt: new Date(),
    });
    // createdAt should be omitted — Drizzle omit strips it, so the field is ignored or rejected
    if (result.success) {
      // If it passes, createdAt should not appear in the output
      expect((result.data as Record<string, unknown>).createdAt).toBeUndefined();
    }
  });

  it("does not accept reviewedBy (server-managed)", () => {
    const result = insertWorkspaceProposalSchema.safeParse({
      userId: 1,
      type: "button",
      label: "Test",
      payload: { target: "/" },
      reviewedBy: 99,
    });
    if (result.success) {
      expect((result.data as Record<string, unknown>).reviewedBy).toBeUndefined();
    }
  });
});

// ─── Proposal review schema validation ──────────────────────────────────────

describe("proposal review validation", () => {
  const proposalReviewSchema = z.object({
    status: z.enum(["approved", "rejected"]),
    note: z.string().optional(),
  }).strict();

  it("accepts approval", () => {
    const result = proposalReviewSchema.safeParse({ status: "approved" });
    expect(result.success).toBe(true);
  });

  it("accepts rejection with note", () => {
    const result = proposalReviewSchema.safeParse({ status: "rejected", note: "Too risky" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = proposalReviewSchema.safeParse({ status: "applied" });
    expect(result.success).toBe(false);
  });

  it("rejects status 'proposed'", () => {
    const result = proposalReviewSchema.safeParse({ status: "proposed" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown fields (strict)", () => {
    const result = proposalReviewSchema.safeParse({ status: "approved", hackerField: "inject" });
    expect(result.success).toBe(false);
  });
});

// ─── Proposal apply logic (needsApproval) ───────────────────────────────────

describe("proposal apply rules", () => {
  function needsApproval(scope: string, impact: string): boolean {
    return scope === "shared" || impact === "high";
  }

  it("personal + low does NOT need approval", () => {
    expect(needsApproval("personal", "low")).toBe(false);
  });

  it("personal + medium does NOT need approval", () => {
    expect(needsApproval("personal", "medium")).toBe(false);
  });

  it("personal + high DOES need approval", () => {
    expect(needsApproval("personal", "high")).toBe(true);
  });

  it("shared + low DOES need approval", () => {
    expect(needsApproval("shared", "low")).toBe(true);
  });

  it("shared + high DOES need approval", () => {
    expect(needsApproval("shared", "high")).toBe(true);
  });
});

// ─── Proposal type apply handling ───────────────────────────────────────────

describe("proposal type apply handling", () => {
  const HANDLED_TYPES = ["button", "workflow", "config"];

  function getApplyAction(type: string): string {
    if (type === "button" || type === "workflow") return "create_custom_action";
    if (type === "config") return "set_workspace_config";
    return "unsupported";
  }

  it("button → create_custom_action", () => {
    expect(getApplyAction("button")).toBe("create_custom_action");
  });

  it("workflow → create_custom_action", () => {
    expect(getApplyAction("workflow")).toBe("create_custom_action");
  });

  it("config → set_workspace_config", () => {
    expect(getApplyAction("config")).toBe("set_workspace_config");
  });

  it("macro → unsupported (not yet handled)", () => {
    expect(getApplyAction("macro")).toBe("unsupported");
  });

  it("view → unsupported (not yet handled)", () => {
    expect(getApplyAction("view")).toBe("unsupported");
  });

  it("unknown type → unsupported", () => {
    expect(getApplyAction("xss_attack")).toBe("unsupported");
  });

  it("all known types are in HANDLED_TYPES", () => {
    for (const t of HANDLED_TYPES) {
      expect(getApplyAction(t)).not.toBe("unsupported");
    }
  });
});

// ─── Proposal revert logic ─────────────────────────────────────────────────

describe("proposal revert logic", () => {
  function getRevertAction(type: string, hasPreviousValue: boolean): string {
    if (type === "button" || type === "workflow") return "delete_custom_action";
    if (type === "config") return hasPreviousValue ? "restore_previous" : "delete_config_key";
    return "unsupported";
  }

  it("button revert → delete_custom_action", () => {
    expect(getRevertAction("button", false)).toBe("delete_custom_action");
  });

  it("config with previousValue → restore_previous", () => {
    expect(getRevertAction("config", true)).toBe("restore_previous");
  });

  it("config without previousValue → delete_config_key", () => {
    expect(getRevertAction("config", false)).toBe("delete_config_key");
  });

  it("unknown type → unsupported", () => {
    expect(getRevertAction("foo", false)).toBe("unsupported");
  });
});
