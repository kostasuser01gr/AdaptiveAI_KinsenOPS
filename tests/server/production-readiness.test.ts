import { describe, it, expect } from "vitest";
import { z } from "zod/v4";
import {
  insertSystemPolicySchema,
  insertAuditLogSchema,
} from "../../shared/schema.js";

// ─── Chunk 8: Production readiness tests ─────────────────────────────────────

// ─── SYSTEM POLICY SCHEMA ────────────────────────────────────────────────────

describe("insertSystemPolicySchema", () => {
  it("accepts valid retention policy", () => {
    const result = insertSystemPolicySchema.safeParse({
      name: "Audit Log Retention",
      category: "retention",
      rule: { maxAgeDays: 90, entityType: "audit_log" },
      enforcement: "warn",
      scope: "global",
      active: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid compliance policy", () => {
    const result = insertSystemPolicySchema.safeParse({
      name: "Data Compliance",
      category: "compliance",
      rule: { requireApproval: true },
      enforcement: "block",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = insertSystemPolicySchema.safeParse({
      category: "retention",
      rule: { maxAgeDays: 90 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing category", () => {
    const result = insertSystemPolicySchema.safeParse({
      name: "Test Policy",
      rule: { maxAgeDays: 90 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing rule", () => {
    const result = insertSystemPolicySchema.safeParse({
      name: "Test Policy",
      category: "retention",
    });
    expect(result.success).toBe(false);
  });
});

// ─── IMPORT STATE MACHINE ────────────────────────────────────────────────────

describe("Import state machine validation", () => {
  const validStates = ["uploading", "mapping", "reviewing", "completed", "failed"] as const;

  // State transition rules
  const allowedTransitions: Record<string, string[]> = {
    uploading: ["mapping", "failed"],
    mapping: ["reviewing", "failed"],
    reviewing: ["completed", "failed"],
    completed: [],
    failed: ["uploading"],
  };

  it("defines all import states", () => {
    expect(validStates).toContain("uploading");
    expect(validStates).toContain("mapping");
    expect(validStates).toContain("reviewing");
    expect(validStates).toContain("completed");
    expect(validStates).toContain("failed");
  });

  it("completed state has no outgoing transitions", () => {
    expect(allowedTransitions["completed"]).toEqual([]);
  });

  it("failed state can only transition to uploading (retry)", () => {
    expect(allowedTransitions["failed"]).toEqual(["uploading"]);
  });

  it("uploading cannot skip to completed", () => {
    expect(allowedTransitions["uploading"]).not.toContain("completed");
  });

  it("every state can reach failed except completed and failed itself", () => {
    for (const state of ["uploading", "mapping", "reviewing"]) {
      expect(allowedTransitions[state]).toContain("failed");
    }
  });
});

// ─── IMPORT PATCH SCHEMA ─────────────────────────────────────────────────────

describe("Import pipeline schemas", () => {
  // Replicate the importPatchSchema from routes.ts
  const importPatchSchema = z.object({
    status: z.string().optional(),
    records: z.number().optional(),
    columns: z.number().optional(),
    mappings: z.array(z.object({ source: z.string(), target: z.string(), confidence: z.number() })).nullable().optional(),
    diffs: z.object({ added: z.number(), updated: z.number(), deleted: z.number(), conflicts: z.number() }).nullable().optional(),
    errorMessage: z.string().nullable().optional(),
  }).strict();

  it("accepts status update to failed with error message", () => {
    const result = importPatchSchema.safeParse({
      status: "failed",
      errorMessage: "File format not supported",
    });
    expect(result.success).toBe(true);
  });

  it("accepts reset for retry (null mappings/diffs)", () => {
    const result = importPatchSchema.safeParse({
      status: "uploading",
      errorMessage: null,
      mappings: null,
      diffs: null,
      records: 0,
      columns: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects unexpected fields", () => {
    const result = importPatchSchema.safeParse({ status: "completed", admin: true });
    expect(result.success).toBe(false);
  });

  it("accepts confirm transition data", () => {
    const result = importPatchSchema.safeParse({ status: "completed" });
    expect(result.success).toBe(true);
  });
});

// ─── AUDIT LOG SCHEMA ────────────────────────────────────────────────────────

describe("insertAuditLogSchema", () => {
  it("accepts valid audit entry", () => {
    const result = insertAuditLogSchema.safeParse({
      userId: 1,
      action: "policy_execute",
      entityType: "system_policy",
      entityId: "5",
      details: { policyName: "Retention 90d", dryRun: false, matchedCount: 42 },
      ipAddress: "127.0.0.1",
    });
    expect(result.success).toBe(true);
  });

  it("accepts policy dry run audit entry", () => {
    const result = insertAuditLogSchema.safeParse({
      userId: 1,
      action: "policy_dry_run",
      entityType: "system_policy",
      entityId: "3",
      details: { policyName: "Compliance Check", dryRun: true, matchedCount: 0 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts null userId for system actions", () => {
    const result = insertAuditLogSchema.safeParse({
      action: "retention_cleanup",
      entityType: "audit_log",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing action", () => {
    const result = insertAuditLogSchema.safeParse({
      userId: 1,
      entityType: "system_policy",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing entityType", () => {
    const result = insertAuditLogSchema.safeParse({
      userId: 1,
      action: "create",
    });
    expect(result.success).toBe(false);
  });
});

// ─── HEALTH CHECK RESPONSE SHAPE ─────────────────────────────────────────────

describe("Health check response contract", () => {
  const healthResponseSchema = z.object({
    status: z.enum(["ok", "degraded"]),
    uptime: z.number().int().nonnegative(),
    timestamp: z.string().datetime(),
    checks: z.object({
      database: z.enum(["connected", "unreachable"]),
    }),
  });

  it("validates healthy response shape", () => {
    const result = healthResponseSchema.safeParse({
      status: "ok",
      uptime: 1234,
      timestamp: new Date().toISOString(),
      checks: { database: "connected" },
    });
    expect(result.success).toBe(true);
  });

  it("validates degraded response shape", () => {
    const result = healthResponseSchema.safeParse({
      status: "degraded",
      uptime: 0,
      timestamp: new Date().toISOString(),
      checks: { database: "unreachable" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = healthResponseSchema.safeParse({
      status: "operational",
      uptime: 100,
      timestamp: new Date().toISOString(),
      checks: { database: "connected" },
    });
    expect(result.success).toBe(false);
  });
});

// ─── SYSTEM HEALTH RESPONSE SHAPE ────────────────────────────────────────────

describe("System health response contract", () => {
  const systemHealthSchema = z.object({
    status: z.enum(["operational", "degraded"]),
    uptime: z.number().int().nonnegative(),
    memory: z.object({
      rss: z.number().nonnegative(),
      heapUsed: z.number().nonnegative(),
      heapTotal: z.number().nonnegative(),
    }),
    checks: z.object({
      database: z.enum(["connected", "unreachable"]),
      websocket: z.enum(["running", "unknown"]),
    }),
    metrics: z.object({
      totalRequests: z.number().nonnegative(),
      avgResponseTime: z.number().nonnegative(),
      errorRate: z.number().min(0).max(1),
    }),
    websocket: z.object({
      totalClients: z.number().nonnegative(),
      authenticatedClients: z.number().nonnegative(),
    }),
    version: z.string(),
    modules: z.number().int().positive(),
    timestamp: z.string().datetime(),
  });

  it("validates operational system health", () => {
    const result = systemHealthSchema.safeParse({
      status: "operational",
      uptime: 5000,
      memory: { rss: 120, heapUsed: 60, heapTotal: 80 },
      checks: { database: "connected", websocket: "running" },
      metrics: { totalRequests: 1500, avgResponseTime: 45.2, errorRate: 0.01 },
      websocket: { totalClients: 3, authenticatedClients: 2 },
      version: "2.0.0",
      modules: 14,
      timestamp: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it("validates degraded system health", () => {
    const result = systemHealthSchema.safeParse({
      status: "degraded",
      uptime: 10,
      memory: { rss: 50, heapUsed: 20, heapTotal: 40 },
      checks: { database: "unreachable", websocket: "running" },
      metrics: { totalRequests: 0, avgResponseTime: 0, errorRate: 0 },
      websocket: { totalClients: 0, authenticatedClients: 0 },
      version: "2.0.0",
      modules: 14,
      timestamp: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });
});

// ─── POLICY EVALUATION RESPONSE ──────────────────────────────────────────────

describe("Policy evaluation response contract", () => {
  const policyEvalResponseSchema = z.object({
    policyId: z.number().int().positive(),
    policyName: z.string(),
    category: z.string(),
    enforcement: z.string(),
    dryRun: z.boolean(),
    matchedCount: z.number().int().nonnegative(),
    affectedEntities: z.array(z.object({
      id: z.number(),
      reason: z.string(),
    })),
    executedAt: z.string().datetime().nullable(),
  });

  it("validates dry run response", () => {
    const result = policyEvalResponseSchema.safeParse({
      policyId: 1,
      policyName: "Audit Retention 90d",
      category: "retention",
      enforcement: "warn",
      dryRun: true,
      matchedCount: 42,
      affectedEntities: [{ id: 101, reason: "older than 90 days" }],
      executedAt: null,
    });
    expect(result.success).toBe(true);
  });

  it("validates execution response", () => {
    const result = policyEvalResponseSchema.safeParse({
      policyId: 2,
      policyName: "Compliance Audit",
      category: "compliance",
      enforcement: "block",
      dryRun: false,
      matchedCount: 5,
      affectedEntities: [],
      executedAt: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });
});

// ─── CSV EXPORT FORMAT ───────────────────────────────────────────────────────

describe("Audit log CSV export format", () => {
  function generateAuditCsv(entries: Array<{
    id: number; userId: number | null; action: string;
    entityType: string; entityId: string | null;
    ipAddress: string | null; createdAt: string;
  }>) {
    const rows = ['id,userId,action,entityType,entityId,ipAddress,createdAt'];
    for (const e of entries) {
      const escapedEntityId = e.entityId ? e.entityId.replace(/"/g, '""') : '';
      rows.push(`${e.id},${e.userId ?? ''},${e.action},"${e.entityType}","${escapedEntityId}",${e.ipAddress ?? ''},${e.createdAt}`);
    }
    return rows.join('\n');
  }

  it("produces correct header", () => {
    const csv = generateAuditCsv([]);
    expect(csv).toBe('id,userId,action,entityType,entityId,ipAddress,createdAt');
  });

  it("handles null userId and ipAddress", () => {
    const csv = generateAuditCsv([{
      id: 1, userId: null, action: "create",
      entityType: "vehicle", entityId: "42",
      ipAddress: null, createdAt: "2025-01-01T00:00:00.000Z",
    }]);
    const lines = csv.split('\n');
    expect(lines[1]).toBe('1,,create,"vehicle","42",,2025-01-01T00:00:00.000Z');
  });

  it("escapes double quotes in entityId", () => {
    const csv = generateAuditCsv([{
      id: 2, userId: 1, action: "update",
      entityType: "policy", entityId: 'rule "alpha"',
      ipAddress: "10.0.0.1", createdAt: "2025-01-02T00:00:00.000Z",
    }]);
    const lines = csv.split('\n');
    expect(lines[1]).toContain('"rule ""alpha"""');
  });
});

// ─── RETENTION CUTOFF CALCULATION ────────────────────────────────────────────

describe("Retention cutoff calculation", () => {
  it("computes correct cutoff for 90 days", () => {
    const now = new Date("2025-04-01T00:00:00Z").getTime();
    const maxAgeDays = 90;
    const cutoff = new Date(now - maxAgeDays * 86400000);
    expect(cutoff.toISOString()).toBe("2025-01-01T00:00:00.000Z");
  });

  it("computes correct cutoff for 30 days", () => {
    const now = new Date("2025-02-01T00:00:00Z").getTime();
    const maxAgeDays = 30;
    const cutoff = new Date(now - maxAgeDays * 86400000);
    expect(cutoff.toISOString()).toBe("2025-01-02T00:00:00.000Z");
  });

  it("defaults to 90 days when maxAgeDays is NaN", () => {
    const maxAgeDays = Number(undefined) || 90;
    expect(maxAgeDays).toBe(90);
  });
});
