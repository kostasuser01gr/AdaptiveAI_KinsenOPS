import { describe, it, expect } from "vitest";
import { z } from "zod/v4";

// ─── Route-level validation logic tests ──────────────────────────────────────
// These test the schema validation used in routes without hitting the DB.

import {
  insertVehicleSchema,
  insertWashQueueSchema,
  insertShiftSchema,
  insertNotificationSchema,
  insertAutomationRuleSchema,
  insertImportSchema,
} from "../../shared/schema.js";

describe("insertVehicleSchema", () => {
  it("accepts valid vehicle data", () => {
    const result = insertVehicleSchema.safeParse({
      plate: "ABC-1234",
      model: "Toyota Yaris",
      category: "B",
      status: "ready",
      sla: "normal",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing plate", () => {
    const result = insertVehicleSchema.safeParse({
      model: "Toyota Yaris",
      category: "B",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing model", () => {
    const result = insertVehicleSchema.safeParse({
      plate: "ABC-1234",
      category: "B",
    });
    expect(result.success).toBe(false);
  });
});

describe("insertWashQueueSchema", () => {
  it("accepts minimal valid wash item", () => {
    const result = insertWashQueueSchema.safeParse({
      vehiclePlate: "ABC-1234",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing vehiclePlate", () => {
    const result = insertWashQueueSchema.safeParse({ washType: "Quick Wash" });
    expect(result.success).toBe(false);
  });
});

describe("insertShiftSchema", () => {
  it("accepts valid shift", () => {
    const result = insertShiftSchema.safeParse({
      employeeName: "John Doe",
      employeeRole: "agent",
      weekStart: "2026-03-09",
      schedule: ["Mon", "Tue", "Wed"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing employeeName", () => {
    const result = insertShiftSchema.safeParse({
      employeeRole: "agent",
      weekStart: "2026-03-09",
      schedule: ["Mon"],
    });
    expect(result.success).toBe(false);
  });
});

describe("insertNotificationSchema", () => {
  it("accepts valid notification", () => {
    const result = insertNotificationSchema.safeParse({
      title: "Alert",
      body: "Something happened",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing title", () => {
    const result = insertNotificationSchema.safeParse({ body: "Something happened" });
    expect(result.success).toBe(false);
  });
});

describe("insertAutomationRuleSchema", () => {
  it("accepts valid automation rule", () => {
    const result = insertAutomationRuleSchema.safeParse({
      name: "QC Fail Alert",
      trigger: "qc_fail",
      createdBy: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing trigger", () => {
    const result = insertAutomationRuleSchema.safeParse({
      name: "My Rule",
      createdBy: 1,
    });
    expect(result.success).toBe(false);
  });
});

// ─── Pagination logic ──────────────────────────────────────────────────────────
describe("Pagination helpers", () => {
  function paginate<T>(items: T[], limit: number, offset: number) {
    return {
      data: items.slice(offset, offset + limit),
      total: items.length,
      limit,
      offset,
    };
  }

  it("returns correct slice for page 1", () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const result = paginate(items, 3, 0);
    expect(result.data).toEqual([0, 1, 2]);
    expect(result.total).toBe(10);
  });

  it("returns correct slice for page 2", () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const result = paginate(items, 3, 3);
    expect(result.data).toEqual([3, 4, 5]);
  });

  it("returns empty slice beyond total", () => {
    const items = Array.from({ length: 5 }, (_, i) => i);
    const result = paginate(items, 3, 10);
    expect(result.data).toEqual([]);
    expect(result.total).toBe(5);
  });
});

// ─── Chunk 3: Import schema validation ───────────────────────────────────────

describe("insertImportSchema", () => {
  it("accepts valid import data", () => {
    const result = insertImportSchema.safeParse({
      filename: "Q3_Vehicles.xlsx",
      status: "uploading",
      uploadedBy: 1,
      records: 0,
      columns: 0,
      fileType: "xlsx",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing filename", () => {
    const result = insertImportSchema.safeParse({
      status: "uploading",
      uploadedBy: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing uploadedBy", () => {
    const result = insertImportSchema.safeParse({
      filename: "test.csv",
      status: "uploading",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid mappings array", () => {
    const result = insertImportSchema.safeParse({
      filename: "mapped.csv",
      status: "mapping",
      uploadedBy: 1,
      records: 100,
      columns: 8,
      fileType: "csv",
      mappings: [
        { source: "License Plate", target: "plate", confidence: 0.98 },
        { source: "Car Brand", target: "make", confidence: 0.95 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid diffs object", () => {
    const result = insertImportSchema.safeParse({
      filename: "reviewed.csv",
      status: "reviewing",
      uploadedBy: 1,
      records: 50,
      columns: 6,
      fileType: "csv",
      diffs: { added: 40, updated: 8, deleted: 0, conflicts: 2 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts null mappings and diffs", () => {
    const result = insertImportSchema.safeParse({
      filename: "raw.csv",
      status: "uploading",
      uploadedBy: 1,
      records: 0,
      columns: 0,
      fileType: "csv",
      mappings: null,
      diffs: null,
    });
    expect(result.success).toBe(true);
  });
});

// ─── Chunk 3: Import PATCH schema validation ─────────────────────────────────

describe("importPatchSchema (inline z.object)", () => {
  // Re-create the patch schema here since it's not exported from routes
  const importPatchSchema = z.object({
    status: z.string().optional(),
    records: z.number().optional(),
    columns: z.number().optional(),
    mappings: z.array(z.object({ source: z.string(), target: z.string(), confidence: z.number() })).nullable().optional(),
    diffs: z.object({ added: z.number(), updated: z.number(), deleted: z.number(), conflicts: z.number() }).nullable().optional(),
    errorMessage: z.string().nullable().optional(),
  }).strict();

  it("accepts valid partial update (status only)", () => {
    const result = importPatchSchema.safeParse({ status: "completed" });
    expect(result.success).toBe(true);
  });

  it("accepts valid full update", () => {
    const result = importPatchSchema.safeParse({
      status: "reviewing",
      records: 200,
      columns: 12,
      diffs: { added: 180, updated: 15, deleted: 0, conflicts: 5 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown fields (strict mode)", () => {
    const result = importPatchSchema.safeParse({
      status: "completed",
      hackerField: "malicious",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-number records", () => {
    const result = importPatchSchema.safeParse({
      records: "not-a-number",
    });
    expect(result.success).toBe(false);
  });

  it("accepts null errorMessage", () => {
    const result = importPatchSchema.safeParse({ errorMessage: null });
    expect(result.success).toBe(true);
  });

  it("accepts null mappings", () => {
    const result = importPatchSchema.safeParse({ mappings: null });
    expect(result.success).toBe(true);
  });
});

// ─── Chunk 3: Public room message validation ─────────────────────────────────

describe("public room message validation", () => {
  const roomMessageSchema = z.object({
    content: z.string().min(1).max(2000),
    role: z.string().optional(),
  }).strict();

  const roomResolveSchema = z.object({
    entityType: z.string().min(1),
    entityId: z.string().min(1),
    title: z.string().optional(),
  }).strict();

  it("accepts valid message", () => {
    const result = roomMessageSchema.safeParse({ content: "Hello, I need help", role: "customer" });
    expect(result.success).toBe(true);
  });

  it("rejects empty content", () => {
    const result = roomMessageSchema.safeParse({ content: "" });
    expect(result.success).toBe(false);
  });

  it("rejects oversized content (>2000 chars)", () => {
    const result = roomMessageSchema.safeParse({ content: "x".repeat(2001) });
    expect(result.success).toBe(false);
  });

  it("rejects unknown fields in message (strict)", () => {
    const result = roomMessageSchema.safeParse({ content: "hi", injectedField: true });
    expect(result.success).toBe(false);
  });

  it("accepts valid room resolve request", () => {
    const result = roomResolveSchema.safeParse({ entityType: "reservation", entityId: "RES-12345" });
    expect(result.success).toBe(true);
  });

  it("rejects empty entityType", () => {
    const result = roomResolveSchema.safeParse({ entityType: "", entityId: "RES-1" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown fields in resolve (strict)", () => {
    const result = roomResolveSchema.safeParse({ entityType: "reservation", entityId: "1", malicious: "payload" });
    expect(result.success).toBe(false);
  });
});

// ─── Chunk 3: Import process endpoint validation ─────────────────────────────

describe("import process validation", () => {

  it("insertImportSchema accepts valid import with uploading status", () => {
    const result = insertImportSchema.safeParse({
      filename: "fleet-data.csv",
      status: "uploading",
      uploadedBy: 1,
      fileType: "csv",
      records: 0,
      columns: 0,
    });
    expect(result.success).toBe(true);
  });

  it("insertImportSchema rejects missing filename", () => {
    const result = insertImportSchema.safeParse({
      status: "uploading",
      uploadedBy: 1,
      fileType: "csv",
      records: 0,
      columns: 0,
    });
    expect(result.success).toBe(false);
  });

  it("insertImportSchema rejects missing uploadedBy", () => {
    const result = insertImportSchema.safeParse({
      filename: "data.xlsx",
      status: "uploading",
      fileType: "xlsx",
      records: 0,
      columns: 0,
    });
    expect(result.success).toBe(false);
  });

  it("importPatchSchema accepts mappings array", () => {
    const importPatchSchema = z.object({
      status: z.string().optional(),
      records: z.number().optional(),
      columns: z.number().optional(),
      mappings: z.array(z.object({ source: z.string(), target: z.string(), confidence: z.number() })).nullable().optional(),
      diffs: z.object({ added: z.number(), updated: z.number(), deleted: z.number(), conflicts: z.number() }).nullable().optional(),
      errorMessage: z.string().nullable().optional(),
    }).strict();
    const result = importPatchSchema.safeParse({
      status: "reviewing",
      records: 200,
      columns: 4,
      mappings: [
        { source: "plate", target: "plate", confidence: 0.98 },
        { source: "model", target: "model", confidence: 0.95 },
      ],
      diffs: { added: 190, updated: 10, deleted: 0, conflicts: 0 },
    });
    expect(result.success).toBe(true);
  });

  it("importPatchSchema rejects invalid mappings structure", () => {
    const importPatchSchema = z.object({
      status: z.string().optional(),
      records: z.number().optional(),
      columns: z.number().optional(),
      mappings: z.array(z.object({ source: z.string(), target: z.string(), confidence: z.number() })).nullable().optional(),
      diffs: z.object({ added: z.number(), updated: z.number(), deleted: z.number(), conflicts: z.number() }).nullable().optional(),
      errorMessage: z.string().nullable().optional(),
    }).strict();
    const result = importPatchSchema.safeParse({
      mappings: [{ source: "plate" }], // missing target and confidence
    });
    expect(result.success).toBe(false);
  });
});

// ─── Chunk 3: Public evidence endpoint validation ────────────────────────────

describe("public evidence endpoint validation", () => {
  const publicEvidenceSchema = z.object({
    reservationId: z.string().min(1).max(100),
    type: z.string().min(1).max(50),
    caption: z.string().max(500).optional(),
    source: z.enum(["customer", "staff"]),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }).strict();

  it("accepts valid customer evidence", () => {
    const result = publicEvidenceSchema.safeParse({
      reservationId: "RES-12345",
      type: "photo",
      caption: "Front Left — minor scratch",
      source: "customer",
      metadata: { zone: "Front Left", fileName: "photo1.jpg" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts evidence without optional fields", () => {
    const result = publicEvidenceSchema.safeParse({
      reservationId: "RES-001",
      type: "photo",
      source: "customer",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing reservationId", () => {
    const result = publicEvidenceSchema.safeParse({
      type: "photo",
      source: "customer",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid source", () => {
    const result = publicEvidenceSchema.safeParse({
      reservationId: "RES-1",
      type: "photo",
      source: "admin",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty reservationId", () => {
    const result = publicEvidenceSchema.safeParse({
      reservationId: "",
      type: "photo",
      source: "customer",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown fields (strict)", () => {
    const result = publicEvidenceSchema.safeParse({
      reservationId: "RES-1",
      type: "photo",
      source: "customer",
      injected: "malicious",
    });
    expect(result.success).toBe(false);
  });

  it("rejects oversized caption", () => {
    const result = publicEvidenceSchema.safeParse({
      reservationId: "RES-1",
      type: "photo",
      source: "customer",
      caption: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

// ─── Notification Action Schema ────────────────────────────────────────────────
describe("notificationActionSchema", () => {
  const notificationActionSchema = z.object({
    metadata: z.record(z.string(), z.unknown()).optional(),
  }).strict();

  it("accepts empty body", () => {
    const result = notificationActionSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts metadata with action fields", () => {
    const result = notificationActionSchema.safeParse({
      metadata: { actionTaken: "approve", actionBy: "admin", actionAt: "2026-03-15T10:00:00Z" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown top-level fields (strict)", () => {
    const result = notificationActionSchema.safeParse({
      metadata: {},
      status: "resolved",
    });
    expect(result.success).toBe(false);
  });

  it("accepts metadata with arbitrary keys", () => {
    const result = notificationActionSchema.safeParse({
      metadata: { foo: 1, bar: "baz", nested: { a: true } },
    });
    expect(result.success).toBe(true);
  });
});

// ─── Analytics Summary Response Shape ──────────────────────────────────────────
describe("analyticsSummaryResponseShape", () => {
  const analyticsSummarySchema = z.object({
    vehiclesByStatus: z.record(z.string(), z.number()),
    totalVehicles: z.number(),
    readyCount: z.number(),
    washesByStatus: z.record(z.string(), z.number()),
    washesCompletedToday: z.number(),
    washesCreatedToday: z.number(),
    notifsBySeverity: z.record(z.string(), z.number()),
    automations: z.object({
      total: z.number(),
      active: z.number(),
      totalExecutions: z.number(),
    }),
    roomsByStatus: z.record(z.string(), z.number()),
    totalEvidence: z.number(),
    evidenceToday: z.number(),
    totalShifts: z.number(),
    totalStations: z.number(),
    totalUsers: z.number(),
    fleetUtilization: z.number(),
    timestamp: z.string(),
  });

  it("validates a well-formed analytics summary", () => {
    const result = analyticsSummarySchema.safeParse({
      vehiclesByStatus: { ready: 10, washing: 3, rented: 5 },
      totalVehicles: 18,
      readyCount: 10,
      washesByStatus: { pending: 2, in_progress: 1, completed: 15 },
      washesCompletedToday: 4,
      washesCreatedToday: 6,
      notifsBySeverity: { critical: 1, warning: 3 },
      automations: { total: 5, active: 3, totalExecutions: 42 },
      roomsByStatus: { open: 1, resolved: 4 },
      totalEvidence: 28,
      evidenceToday: 3,
      totalShifts: 8,
      totalStations: 2,
      totalUsers: 12,
      fleetUtilization: 44,
      timestamp: "2026-03-15T10:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing required field", () => {
    const result = analyticsSummarySchema.safeParse({
      vehiclesByStatus: { ready: 10 },
      totalVehicles: 10,
      // missing most fields
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-number in vehiclesByStatus", () => {
    const result = analyticsSummarySchema.safeParse({
      vehiclesByStatus: { ready: "ten" },
      totalVehicles: 10,
      readyCount: 10,
      washesByStatus: {},
      washesCompletedToday: 0,
      washesCreatedToday: 0,
      notifsBySeverity: {},
      automations: { total: 0, active: 0, totalExecutions: 0 },
      roomsByStatus: {},
      totalEvidence: 0,
      evidenceToday: 0,
      totalShifts: 0,
      totalStations: 0,
      totalUsers: 0,
      fleetUtilization: 0,
      timestamp: "2026-03-15T10:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty status records", () => {
    const result = analyticsSummarySchema.safeParse({
      vehiclesByStatus: {},
      totalVehicles: 0,
      readyCount: 0,
      washesByStatus: {},
      washesCompletedToday: 0,
      washesCreatedToday: 0,
      notifsBySeverity: {},
      automations: { total: 0, active: 0, totalExecutions: 0 },
      roomsByStatus: {},
      totalEvidence: 0,
      evidenceToday: 0,
      totalShifts: 0,
      totalStations: 0,
      totalUsers: 0,
      fleetUtilization: 0,
      timestamp: "2026-03-15T10:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });
});
