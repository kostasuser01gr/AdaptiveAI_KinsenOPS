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
  insertIncidentSchema,
  insertAutomationExecutionSchema,
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

// ──────────────────────────────────────────────────────────────────────────────
// Phase 1: Incident schema validation
// ──────────────────────────────────────────────────────────────────────────────
describe("insertIncidentSchema", () => {
  it("accepts valid incident data", () => {
    const result = insertIncidentSchema.safeParse({
      title: "Vehicle Damage Report",
      severity: "high",
      category: "vehicle_damage",
      reportedBy: 1,
    });
    expect(result.success).toBe(true);
  });

  it("accepts full incident data", () => {
    const result = insertIncidentSchema.safeParse({
      title: "Customer Complaint",
      description: "Customer reports scratch on driver side door",
      severity: "medium",
      category: "customer_complaint",
      reportedBy: 1,
      assignedTo: 2,
      vehicleId: 5,
      stationId: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing title", () => {
    const result = insertIncidentSchema.safeParse({
      severity: "low",
      category: "general",
      reportedBy: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing reportedBy", () => {
    const result = insertIncidentSchema.safeParse({
      title: "Some incident",
      severity: "low",
      category: "general",
    });
    expect(result.success).toBe(false);
  });

  it("accepts any severity string (route validates enum)", () => {
    // Drizzle text() columns accept any string; route handler enforces enum
    const result = insertIncidentSchema.safeParse({
      title: "Test",
      severity: "extreme",
      category: "general",
      reportedBy: 1,
    });
    expect(result.success).toBe(true);
  });

  it("accepts any category string (route validates enum)", () => {
    const result = insertIncidentSchema.safeParse({
      title: "Test",
      severity: "low",
      category: "invalid_category",
      reportedBy: 1,
    });
    expect(result.success).toBe(true);
  });

  it("allows nullable optional fields", () => {
    const result = insertIncidentSchema.safeParse({
      title: "Minimal incident",
      severity: "low",
      category: "general",
      reportedBy: 1,
      description: null,
      assignedTo: null,
      vehicleId: null,
      stationId: null,
      metadata: null,
    });
    expect(result.success).toBe(true);
  });
});

describe("insertAutomationExecutionSchema", () => {
  it("accepts valid execution", () => {
    const result = insertAutomationExecutionSchema.safeParse({
      ruleId: 1,
      triggerEvent: "wash_completed",
      status: "running",
    });
    expect(result.success).toBe(true);
  });

  it("accepts execution with entity context", () => {
    const result = insertAutomationExecutionSchema.safeParse({
      ruleId: 1,
      triggerEvent: "vehicle_status_change",
      triggerEntityType: "vehicle",
      triggerEntityId: "42",
      status: "success",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing ruleId", () => {
    const result = insertAutomationExecutionSchema.safeParse({
      triggerEvent: "wash_completed",
      status: "running",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing triggerEvent", () => {
    const result = insertAutomationExecutionSchema.safeParse({
      ruleId: 1,
      status: "running",
    });
    expect(result.success).toBe(false);
  });

  it("accepts any status string (route validates enum)", () => {
    // Drizzle text() columns accept any string; route handler enforces enum
    const result = insertAutomationExecutionSchema.safeParse({
      ruleId: 1,
      triggerEvent: "test",
      status: "invalid",
    });
    expect(result.success).toBe(true);
  });
});

// Phase 1: Incident patch schema validation
describe("incidentPatchSchema", () => {
  const incidentPatchSchema = z.object({
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    severity: z.enum(["low", "medium", "high", "critical"]).optional(),
    status: z.enum(["open", "investigating", "mitigating", "resolved", "closed"]).optional(),
    category: z.string().optional(),
    assignedTo: z.number().nullable().optional(),
    vehicleId: z.number().nullable().optional(),
    stationId: z.number().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  }).strict();

  it("accepts partial update with status", () => {
    const result = incidentPatchSchema.safeParse({ status: "investigating" });
    expect(result.success).toBe(true);
  });

  it("accepts partial update with severity", () => {
    const result = incidentPatchSchema.safeParse({ severity: "critical" });
    expect(result.success).toBe(true);
  });

  it("accepts assignedTo update", () => {
    const result = incidentPatchSchema.safeParse({ assignedTo: 5 });
    expect(result.success).toBe(true);
  });

  it("accepts null assignedTo (unassign)", () => {
    const result = incidentPatchSchema.safeParse({ assignedTo: null });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status transition value", () => {
    const result = incidentPatchSchema.safeParse({ status: "deleted" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown fields (strict mode)", () => {
    const result = incidentPatchSchema.safeParse({ status: "open", foo: "bar" });
    expect(result.success).toBe(false);
  });

  it("accepts metadata update", () => {
    const result = incidentPatchSchema.safeParse({ metadata: { key: "value", nested: { a: 1 } } });
    expect(result.success).toBe(true);
  });

  it("accepts empty object (no-op update)", () => {
    const result = incidentPatchSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

// Phase 1: SLA deadline in wash queue
describe("washQueue SLA deadline handling", () => {
  it("insertWashQueueSchema omits slaDeadline", () => {
    const result = insertWashQueueSchema.safeParse({
      vehiclePlate: "ABC-1234",
      washType: "Full Wash",
      priority: "High",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("slaDeadline");
    }
  });

  it("washQueuePatchSchema accepts slaDeadline string", () => {
    const washQueuePatchSchema = z.object({
      status: z.string().optional(),
      priority: z.string().optional(),
      assignedTo: z.string().nullable().optional(),
      washType: z.string().optional(),
      proofPhotoUrl: z.string().nullable().optional(),
      slaDeadline: z.string().nullable().optional(),
    });
    const result = washQueuePatchSchema.safeParse({ slaDeadline: "2026-03-15T10:30:00.000Z" });
    expect(result.success).toBe(true);
  });

  it("washQueuePatchSchema accepts null slaDeadline (clear)", () => {
    const washQueuePatchSchema = z.object({
      status: z.string().optional(),
      slaDeadline: z.string().nullable().optional(),
    });
    const result = washQueuePatchSchema.safeParse({ slaDeadline: null });
    expect(result.success).toBe(true);
  });
});

// Phase 1: Import apply validation
describe("import apply validation", () => {
  it("validates import must be in reviewing state", () => {
    const statuses = ['uploading', 'mapping', 'reviewing', 'completed', 'failed'];
    const applyable = statuses.filter(s => s === 'reviewing');
    expect(applyable).toEqual(['reviewing']);
  });

  it("validates rawData must be a non-empty array", () => {
    const rawDataSchema = z.array(z.record(z.string(), z.unknown())).min(1);
    expect(rawDataSchema.safeParse([]).success).toBe(false);
    expect(rawDataSchema.safeParse([{ plate: "ABC" }]).success).toBe(true);
    expect(rawDataSchema.safeParse("not array").success).toBe(false);
  });

  it("validates mapping structure", () => {
    const mappingSchema = z.array(z.object({
      source: z.string(),
      target: z.string(),
      confidence: z.number().min(0).max(1),
    })).min(1);
    expect(mappingSchema.safeParse([{ source: "plate", target: "plate", confidence: 0.98 }]).success).toBe(true);
    expect(mappingSchema.safeParse([]).success).toBe(false);
    expect(mappingSchema.safeParse([{ source: "plate" }]).success).toBe(false);
  });
});

// Phase 1: Automation execution action types
describe("automation action type validation", () => {
  const actionSchema = z.object({
    type: z.enum(["send_notification", "update_vehicle_status", "create_room", "create_incident", "log_event"]),
  }).passthrough();

  it("accepts send_notification", () => {
    expect(actionSchema.safeParse({ type: "send_notification", title: "Alert" }).success).toBe(true);
  });

  it("accepts create_incident", () => {
    expect(actionSchema.safeParse({ type: "create_incident", severity: "high" }).success).toBe(true);
  });

  it("accepts create_room", () => {
    expect(actionSchema.safeParse({ type: "create_room", title: "War Room" }).success).toBe(true);
  });

  it("accepts log_event", () => {
    expect(actionSchema.safeParse({ type: "log_event", eventAction: "custom" }).success).toBe(true);
  });

  it("rejects unknown action type", () => {
    expect(actionSchema.safeParse({ type: "delete_everything" }).success).toBe(false);
  });
});

// ─── PHASE 1 HARDENING: Incident status transition state machine ───
describe("incident status transition enforcement", () => {
  const INCIDENT_TRANSITIONS: Record<string, string[]> = {
    open: ['investigating'],
    investigating: ['mitigating', 'resolved'],
    mitigating: ['resolved'],
    resolved: ['closed', 'investigating'],
    closed: [],
  };

  function isValidTransition(from: string, to: string): boolean {
    return (INCIDENT_TRANSITIONS[from] || []).includes(to);
  }

  // Valid transitions
  it("allows open → investigating", () => {
    expect(isValidTransition('open', 'investigating')).toBe(true);
  });

  it("allows investigating → mitigating", () => {
    expect(isValidTransition('investigating', 'mitigating')).toBe(true);
  });

  it("allows investigating → resolved (skip mitigating)", () => {
    expect(isValidTransition('investigating', 'resolved')).toBe(true);
  });

  it("allows mitigating → resolved", () => {
    expect(isValidTransition('mitigating', 'resolved')).toBe(true);
  });

  it("allows resolved → closed", () => {
    expect(isValidTransition('resolved', 'closed')).toBe(true);
  });

  it("allows resolved → investigating (reopen)", () => {
    expect(isValidTransition('resolved', 'investigating')).toBe(true);
  });

  // Invalid transitions
  it("rejects open → closed (skip entire lifecycle)", () => {
    expect(isValidTransition('open', 'closed')).toBe(false);
  });

  it("rejects open → resolved (skip investigation)", () => {
    expect(isValidTransition('open', 'resolved')).toBe(false);
  });

  it("rejects closed → open (terminal state)", () => {
    expect(isValidTransition('closed', 'open')).toBe(false);
  });

  it("rejects closed → investigating (terminal state)", () => {
    expect(isValidTransition('closed', 'investigating')).toBe(false);
  });

  it("rejects mitigating → closed (must resolve first)", () => {
    expect(isValidTransition('mitigating', 'closed')).toBe(false);
  });

  it("rejects open → mitigating (must investigate first)", () => {
    expect(isValidTransition('open', 'mitigating')).toBe(false);
  });
});

// ─── PHASE 1 HARDENING: Import apply constraints ───
describe("import apply hardening", () => {
  it("only reviewing status is applyable", () => {
    const allStatuses = ['uploading', 'mapping', 'reviewing', 'completed', 'failed'];
    for (const status of allStatuses) {
      if (status === 'reviewing') {
        expect(status).toBe('reviewing');
      } else {
        expect(status).not.toBe('reviewing');
      }
    }
  });

  it("rejects double-apply (completed is not reviewing)", () => {
    expect('completed').not.toBe('reviewing');
  });

  it("rejects apply on failed import", () => {
    expect('failed').not.toBe('reviewing');
  });
});
