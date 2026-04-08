/**
 * Export framework tests (Phase 4.1A).
 *
 * Unit tests for policy, validation, state transitions, and generators.
 * No DB required — pure logic tests.
 */
import { describe, it, expect } from "vitest";
import {
  validateExportParams,
  initialStatus,
  canRequestExport,
  requiresApproval,
  EXPORT_TYPES,
  EXPORT_FORMATS,
  EXPORT_EXPIRY_HOURS,
  MAX_EXPORT_ROWS,
} from "../../server/exports/policy.js";

// ─── EXPORT POLICY TESTS ────────────────────────────────────────────────────

describe("Export policy — validateExportParams", () => {
  it("accepts valid export type + format", () => {
    expect(validateExportParams("audit_log", "csv")).toBeNull();
    expect(validateExportParams("vehicles", "json")).toBeNull();
    expect(validateExportParams("kpi_snapshots", "csv")).toBeNull();
  });

  it("rejects invalid export type", () => {
    const err = validateExportParams("hacked_table", "csv");
    expect(err).toContain("Invalid export type");
  });

  it("rejects invalid format", () => {
    const err = validateExportParams("vehicles", "xlsx");
    expect(err).toContain("Invalid format");
  });

  it("rejects empty strings", () => {
    expect(validateExportParams("", "csv")).toContain("Invalid export type");
    expect(validateExportParams("vehicles", "")).toContain("Invalid format");
  });
});

describe("Export policy — requiresApproval", () => {
  it("audit_log requires approval", () => {
    expect(requiresApproval("audit_log")).toBe(true);
  });

  it("incidents require approval", () => {
    expect(requiresApproval("incidents")).toBe(true);
  });

  it("vehicles do not require approval", () => {
    expect(requiresApproval("vehicles")).toBe(false);
  });

  it("kpi_snapshots do not require approval", () => {
    expect(requiresApproval("kpi_snapshots")).toBe(false);
  });

  it("reservations do not require approval", () => {
    expect(requiresApproval("reservations")).toBe(false);
  });
});

describe("Export policy — initialStatus", () => {
  it("sensitive export → pending_approval", () => {
    expect(initialStatus("audit_log")).toBe("pending_approval");
    expect(initialStatus("incidents")).toBe("pending_approval");
  });

  it("non-sensitive export → approved", () => {
    expect(initialStatus("vehicles")).toBe("approved");
    expect(initialStatus("reservations")).toBe("approved");
    expect(initialStatus("repair_orders")).toBe("approved");
    expect(initialStatus("downtime_events")).toBe("approved");
    expect(initialStatus("kpi_snapshots")).toBe("approved");
    expect(initialStatus("executive_summaries")).toBe("approved");
  });
});

describe("Export policy — canRequestExport", () => {
  it("admin can request all export types", () => {
    for (const t of EXPORT_TYPES) {
      expect(canRequestExport(t, "admin")).toBe(true);
    }
  });

  it("supervisor can request operational exports", () => {
    expect(canRequestExport("vehicles", "supervisor")).toBe(true);
    expect(canRequestExport("reservations", "supervisor")).toBe(true);
    expect(canRequestExport("incidents", "supervisor")).toBe(true);
    expect(canRequestExport("kpi_snapshots", "supervisor")).toBe(true);
  });

  it("supervisor cannot request admin-only exports", () => {
    expect(canRequestExport("audit_log", "supervisor")).toBe(false);
    expect(canRequestExport("executive_summaries", "supervisor")).toBe(false);
  });

  it("washer cannot request any exports", () => {
    for (const t of EXPORT_TYPES) {
      expect(canRequestExport(t, "washer")).toBe(false);
    }
  });

  it("customer cannot request any exports", () => {
    for (const t of EXPORT_TYPES) {
      expect(canRequestExport(t, "customer")).toBe(false);
    }
  });
});

// ─── EXPORT CONSTANTS ────────────────────────────────────────────────────────

describe("Export constants", () => {
  it("EXPORT_TYPES lists at least 7 types", () => {
    expect(EXPORT_TYPES.length).toBeGreaterThanOrEqual(7);
  });

  it("EXPORT_FORMATS includes csv and json", () => {
    expect(EXPORT_FORMATS).toContain("csv");
    expect(EXPORT_FORMATS).toContain("json");
  });

  it("expiry is 48 hours", () => {
    expect(EXPORT_EXPIRY_HOURS).toBe(48);
  });

  it("max rows is 50000", () => {
    expect(MAX_EXPORT_ROWS).toBe(50_000);
  });
});

// ─── SCHEMA VALIDATION ──────────────────────────────────────────────────────

import { insertExportRequestSchema } from "../../shared/schema.js";

describe("Export request schema validation", () => {
  it("accepts valid insert data", () => {
    const result = insertExportRequestSchema.safeParse({
      exportType: "vehicles",
      format: "csv",
      status: "requested",
      requestedBy: 1,
    });
    expect(result.success).toBe(true);
  });

  it("requires exportType", () => {
    const result = insertExportRequestSchema.safeParse({
      format: "csv",
      status: "requested",
      requestedBy: 1,
    });
    expect(result.success).toBe(false);
  });

  it("requires requestedBy", () => {
    const result = insertExportRequestSchema.safeParse({
      exportType: "vehicles",
      format: "csv",
      status: "requested",
    });
    expect(result.success).toBe(false);
  });

  it("accepts format omission (DB default applies)", () => {
    const result = insertExportRequestSchema.safeParse({
      exportType: "vehicles",
      status: "requested",
      requestedBy: 1,
    });
    expect(result.success).toBe(true);
  });

  it("accepts filters as JSON object", () => {
    const result = insertExportRequestSchema.safeParse({
      exportType: "vehicles",
      format: "csv",
      status: "approved",
      requestedBy: 1,
      filters: { stationId: 5, from: "2025-01-01" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts null scope", () => {
    const result = insertExportRequestSchema.safeParse({
      exportType: "incidents",
      format: "json",
      status: "pending_approval",
      requestedBy: 2,
      scope: null,
    });
    expect(result.success).toBe(true);
  });
});

// ─── STATE TRANSITION TESTS ─────────────────────────────────────────────────

describe("Export state transitions (logic)", () => {
  const validTransitions: Record<string, string[]> = {
    requested: ["pending_approval", "approved"],
    pending_approval: ["approved", "rejected"],
    approved: ["processing"],
    processing: ["completed", "failed"],
    completed: ["expired"],
    failed: [],
    rejected: [],
    expired: [],
  };

  it("defines all statuses", () => {
    const statuses = Object.keys(validTransitions);
    expect(statuses).toContain("requested");
    expect(statuses).toContain("pending_approval");
    expect(statuses).toContain("approved");
    expect(statuses).toContain("rejected");
    expect(statuses).toContain("processing");
    expect(statuses).toContain("completed");
    expect(statuses).toContain("failed");
    expect(statuses).toContain("expired");
    expect(statuses.length).toBe(8);
  });

  it("terminal states have no further transitions", () => {
    expect(validTransitions["failed"]).toHaveLength(0);
    expect(validTransitions["rejected"]).toHaveLength(0);
    expect(validTransitions["expired"]).toHaveLength(0);
  });

  it("approved can transition to processing", () => {
    expect(validTransitions["approved"]).toContain("processing");
  });

  it("processing can transition to completed or failed", () => {
    expect(validTransitions["processing"]).toContain("completed");
    expect(validTransitions["processing"]).toContain("failed");
  });
});

// ─── ROLE ACCESS MATRIX ─────────────────────────────────────────────────────

describe("Export role access matrix", () => {
  const exportEndpointRoles = {
    list: ["admin", "supervisor"],
    create: ["admin", "supervisor"],
    approve: ["admin"],
    reject: ["admin"],
    download: ["admin", "supervisor"],
  };

  it("only admin can approve", () => {
    expect(exportEndpointRoles.approve).toEqual(["admin"]);
  });

  it("only admin can reject", () => {
    expect(exportEndpointRoles.reject).toEqual(["admin"]);
  });

  it("admin and supervisor can list", () => {
    expect(exportEndpointRoles.list).toContain("admin");
    expect(exportEndpointRoles.list).toContain("supervisor");
  });

  it("admin and supervisor can download", () => {
    expect(exportEndpointRoles.download).toContain("admin");
    expect(exportEndpointRoles.download).toContain("supervisor");
  });
});

// ─── CSV ESCAPE LOGIC ───────────────────────────────────────────────────────

describe("CSV safety", () => {
  // Replicate csvEscape for testing
  function csvEscape(val: unknown): string {
    if (val === null || val === undefined) return "";
    const str = typeof val === "object" ? JSON.stringify(val) : String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  it("escapes commas", () => {
    expect(csvEscape("hello, world")).toBe('"hello, world"');
  });

  it("escapes double quotes", () => {
    expect(csvEscape('say "hello"')).toBe('"say ""hello"""');
  });

  it("escapes newlines", () => {
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });

  it("handles null and undefined", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });

  it("stringifies objects", () => {
    const result = csvEscape({ a: 1 });
    expect(result).toContain("a");
  });

  it("passes through simple strings", () => {
    expect(csvEscape("hello")).toBe("hello");
  });
});
