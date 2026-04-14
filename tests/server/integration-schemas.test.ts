import { describe, it, expect } from "vitest";
import { z } from "zod/v4";
import {
  insertIntegrationConnectorSchema,
  insertSyncJobSchema,
  insertKnowledgeDocumentSchema,
  insertIncidentSummarySchema,
} from "../../shared/schema.js";

// ═══════════════════════════════════════════════════════════
// PHASE 3 — SCHEMA VALIDATION TESTS
// ═══════════════════════════════════════════════════════════

describe("insertIntegrationConnectorSchema", () => {
  it("accepts valid connector data", () => {
    const result = insertIntegrationConnectorSchema.safeParse({
      name: "PMS Connector",
      type: "pms",
      direction: "inbound",
      config: { host: "https://pms.example.com", apiKey: "tok_123" },
      status: "active",
      createdBy: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = insertIntegrationConnectorSchema.safeParse({
      type: "pms",
      config: {},
      createdBy: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing type", () => {
    const result = insertIntegrationConnectorSchema.safeParse({
      name: "Test",
      config: {},
      createdBy: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing config", () => {
    const result = insertIntegrationConnectorSchema.safeParse({
      name: "Test",
      type: "api",
      createdBy: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing createdBy", () => {
    const result = insertIntegrationConnectorSchema.safeParse({
      name: "Test",
      type: "api",
      config: {},
    });
    expect(result.success).toBe(false);
  });

  it("accepts webhook type with token config", () => {
    const result = insertIntegrationConnectorSchema.safeParse({
      name: "Webhook Connector",
      type: "webhook",
      direction: "inbound",
      config: { webhookToken: "secret_token_abc123" },
      createdBy: 1,
    });
    expect(result.success).toBe(true);
  });
});

describe("insertSyncJobSchema", () => {
  it("accepts valid sync job data", () => {
    const result = insertSyncJobSchema.safeParse({
      connectorId: 1,
      status: "running",
      direction: "inbound",
      entityType: "reservation",
      recordsProcessed: 0,
      recordsFailed: 0,
      recordsSkipped: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing connectorId", () => {
    const result = insertSyncJobSchema.safeParse({
      status: "running",
      direction: "inbound",
      entityType: "reservation",
    });
    expect(result.success).toBe(false);
  });

  it("accepts partial data with defaults", () => {
    const result = insertSyncJobSchema.safeParse({
      connectorId: 5,
    });
    expect(result.success).toBe(true);
  });

  it("accepts errorLog array", () => {
    const result = insertSyncJobSchema.safeParse({
      connectorId: 1,
      errorLog: ["error 1", "error 2"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts metadata object", () => {
    const result = insertSyncJobSchema.safeParse({
      connectorId: 1,
      metadata: { source: "manual", batchSize: 50 },
    });
    expect(result.success).toBe(true);
  });
});

describe("insertKnowledgeDocumentSchema", () => {
  it("accepts valid document data", () => {
    const result = insertKnowledgeDocumentSchema.safeParse({
      title: "Wash SOP v3",
      filename: "wash-sop-v3.pdf",
      mimeType: "application/pdf",
      size: 245000,
      storageKey: "docs/wash-sop-v3.pdf",
      category: "sop",
      uploadedBy: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing title", () => {
    const result = insertKnowledgeDocumentSchema.safeParse({
      filename: "test.pdf",
      mimeType: "application/pdf",
      size: 1000,
      storageKey: "docs/test.pdf",
      uploadedBy: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing filename", () => {
    const result = insertKnowledgeDocumentSchema.safeParse({
      title: "Test",
      mimeType: "application/pdf",
      size: 1000,
      storageKey: "docs/test.pdf",
      uploadedBy: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing size", () => {
    const result = insertKnowledgeDocumentSchema.safeParse({
      title: "Test",
      filename: "test.pdf",
      mimeType: "application/pdf",
      storageKey: "docs/test.pdf",
      uploadedBy: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing uploadedBy", () => {
    const result = insertKnowledgeDocumentSchema.safeParse({
      title: "Test",
      filename: "test.pdf",
      mimeType: "application/pdf",
      size: 1000,
      storageKey: "docs/test.pdf",
    });
    expect(result.success).toBe(false);
  });

  it("accepts tags array", () => {
    const result = insertKnowledgeDocumentSchema.safeParse({
      title: "Policy Document",
      filename: "policy.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 50000,
      storageKey: "docs/policy.docx",
      category: "policy",
      uploadedBy: 1,
      tags: ["hr", "policy", "2025"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts metadata object", () => {
    const result = insertKnowledgeDocumentSchema.safeParse({
      title: "Manual",
      filename: "manual.pdf",
      mimeType: "application/pdf",
      size: 100000,
      storageKey: "docs/manual.pdf",
      uploadedBy: 1,
      metadata: { version: "2.0", department: "operations" },
    });
    expect(result.success).toBe(true);
  });
});

describe("insertIncidentSummarySchema", () => {
  it("accepts valid summary data", () => {
    const result = insertIncidentSummarySchema.safeParse({
      incidentId: 42,
      summary: "Incident was resolved within 30 minutes. No downtime recorded.",
      dataSourcesUsed: ["incident", "war_room_messages"],
      generatedBy: "system",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing incidentId", () => {
    const result = insertIncidentSummarySchema.safeParse({
      summary: "Test summary",
      dataSourcesUsed: ["incident"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing summary", () => {
    const result = insertIncidentSummarySchema.safeParse({
      incidentId: 1,
      dataSourcesUsed: ["incident"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing dataSourcesUsed", () => {
    const result = insertIncidentSummarySchema.safeParse({
      incidentId: 1,
      summary: "Test summary",
    });
    expect(result.success).toBe(false);
  });

  it("accepts kpiImpact object", () => {
    const result = insertIncidentSummarySchema.safeParse({
      incidentId: 10,
      summary: "Major incident with vehicle downtime.",
      dataSourcesUsed: ["incident", "downtime_events", "repair_orders"],
      kpiImpact: { downtimeMinutes: 480, resolutionMinutes: 120 },
    });
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// PHASE 3 — PATCH SCHEMA TESTS
// ═══════════════════════════════════════════════════════════

const connectorPatchSchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  direction: z.string().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(["active", "paused", "error", "disabled"]).optional(),
}).strict();

const kbDocPatchSchema = z.object({
  title: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
}).strict();

describe("connectorPatchSchema", () => {
  it("accepts valid partial update", () => {
    const result = connectorPatchSchema.safeParse({ name: "Updated Name" });
    expect(result.success).toBe(true);
  });

  it("accepts status update", () => {
    const result = connectorPatchSchema.safeParse({ status: "paused" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status value", () => {
    const result = connectorPatchSchema.safeParse({ status: "running" });
    expect(result.success).toBe(false);
  });

  it("rejects extra fields (strict)", () => {
    const result = connectorPatchSchema.safeParse({ name: "Test", createdBy: 99 });
    expect(result.success).toBe(false);
  });

  it("accepts empty update", () => {
    const result = connectorPatchSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts config update", () => {
    const result = connectorPatchSchema.safeParse({ config: { host: "new-host.example.com" } });
    expect(result.success).toBe(true);
  });
});

describe("kbDocPatchSchema", () => {
  it("accepts valid partial update", () => {
    const result = kbDocPatchSchema.safeParse({ title: "Updated Title" });
    expect(result.success).toBe(true);
  });

  it("accepts tags update", () => {
    const result = kbDocPatchSchema.safeParse({ tags: ["new-tag", "v2"] });
    expect(result.success).toBe(true);
  });

  it("accepts null tags (clear)", () => {
    const result = kbDocPatchSchema.safeParse({ tags: null });
    expect(result.success).toBe(true);
  });

  it("rejects extra fields (strict)", () => {
    const result = kbDocPatchSchema.safeParse({ title: "Test", uploadedBy: 5 });
    expect(result.success).toBe(false);
  });

  it("accepts metadata update", () => {
    const result = kbDocPatchSchema.safeParse({ metadata: { version: "3.0" } });
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// PHASE 3 — SYNC VALIDATION TESTS
// ═══════════════════════════════════════════════════════════

const reservationSyncSchema = z.object({
  reservations: z.array(z.object({
    externalId: z.string().min(1).max(200),
    customerName: z.string().min(1).max(200),
    customerEmail: z.string().email().nullable().optional(),
    customerPhone: z.string().nullable().optional(),
    vehiclePlate: z.string().nullable().optional(),
    stationCode: z.string().nullable().optional(),
    pickupDate: z.string(),
    returnDate: z.string(),
    status: z.enum(["confirmed", "checked_out", "returned", "cancelled", "no_show"]).optional(),
    notes: z.string().nullable().optional(),
  })),
}).strict();

describe("reservationSyncSchema", () => {
  it("accepts valid reservation sync payload", () => {
    const result = reservationSyncSchema.safeParse({
      reservations: [{
        externalId: "PMS-001",
        customerName: "John Smith",
        customerEmail: "john@example.com",
        pickupDate: "2025-06-01T09:00:00Z",
        returnDate: "2025-06-05T17:00:00Z",
        status: "confirmed",
      }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts batch of reservations", () => {
    const result = reservationSyncSchema.safeParse({
      reservations: [
        { externalId: "PMS-001", customerName: "Alice", pickupDate: "2025-06-01", returnDate: "2025-06-05" },
        { externalId: "PMS-002", customerName: "Bob", pickupDate: "2025-06-02", returnDate: "2025-06-06" },
        { externalId: "PMS-003", customerName: "Charlie", pickupDate: "2025-06-03", returnDate: "2025-06-07" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty externalId", () => {
    const result = reservationSyncSchema.safeParse({
      reservations: [{
        externalId: "",
        customerName: "John",
        pickupDate: "2025-06-01",
        returnDate: "2025-06-05",
      }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty customerName", () => {
    const result = reservationSyncSchema.safeParse({
      reservations: [{
        externalId: "PMS-001",
        customerName: "",
        pickupDate: "2025-06-01",
        returnDate: "2025-06-05",
      }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = reservationSyncSchema.safeParse({
      reservations: [{
        externalId: "PMS-001",
        customerName: "John",
        customerEmail: "not-an-email",
        pickupDate: "2025-06-01",
        returnDate: "2025-06-05",
      }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts null email and phone", () => {
    const result = reservationSyncSchema.safeParse({
      reservations: [{
        externalId: "PMS-001",
        customerName: "Jane",
        customerEmail: null,
        customerPhone: null,
        pickupDate: "2025-06-01",
        returnDate: "2025-06-05",
      }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts all status values", () => {
    const statuses = ["confirmed", "checked_out", "returned", "cancelled", "no_show"];
    for (const status of statuses) {
      const result = reservationSyncSchema.safeParse({
        reservations: [{
          externalId: "PMS-001",
          customerName: "Test",
          pickupDate: "2025-06-01",
          returnDate: "2025-06-05",
          status,
        }],
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid status", () => {
    const result = reservationSyncSchema.safeParse({
      reservations: [{
        externalId: "PMS-001",
        customerName: "Test",
        pickupDate: "2025-06-01",
        returnDate: "2025-06-05",
        status: "unknown_status",
      }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects extra fields (strict)", () => {
    const result = reservationSyncSchema.safeParse({
      reservations: [{
        externalId: "PMS-001",
        customerName: "Test",
        pickupDate: "2025-06-01",
        returnDate: "2025-06-05",
      }],
      extraField: "should fail",
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty array", () => {
    const result = reservationSyncSchema.safeParse({ reservations: [] });
    expect(result.success).toBe(true);
  });

  it("rejects externalId exceeding 200 chars", () => {
    const result = reservationSyncSchema.safeParse({
      reservations: [{
        externalId: "X".repeat(201),
        customerName: "Test",
        pickupDate: "2025-06-01",
        returnDate: "2025-06-05",
      }],
    });
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// PHASE 3 — NL AUTOMATION DRAFT TESTS
// ═══════════════════════════════════════════════════════════

const nlDraftSchema = z.object({
  description: z.string().min(5).max(2000),
}).strict();

describe("nlDraftSchema", () => {
  it("accepts valid description", () => {
    const result = nlDraftSchema.safeParse({
      description: "When an SLA is breached, notify the admin team",
    });
    expect(result.success).toBe(true);
  });

  it("rejects too short description", () => {
    const result = nlDraftSchema.safeParse({ description: "Hi" });
    expect(result.success).toBe(false);
  });

  it("rejects too long description", () => {
    const result = nlDraftSchema.safeParse({ description: "A".repeat(2001) });
    expect(result.success).toBe(false);
  });

  it("rejects extra fields", () => {
    const result = nlDraftSchema.safeParse({ description: "Valid description here", trigger: "sla_breach" });
    expect(result.success).toBe(false);
  });

  it("rejects missing description", () => {
    const result = nlDraftSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// PHASE 3 — NL TRIGGER DETECTION TESTS (unit logic)
// ═══════════════════════════════════════════════════════════

function detectTrigger(description: string): { trigger: string; name: string; confidence: number } {
  const descLower = description.toLowerCase();
  if (descLower.includes('sla') || descLower.includes('overdue') || descLower.includes('late')) {
    return { trigger: 'sla_breach', name: 'SLA Breach Response', confidence: 0.7 };
  }
  if (descLower.includes('wash') && (descLower.includes('complet') || descLower.includes('finish') || descLower.includes('done'))) {
    return { trigger: 'wash_completed', name: 'Wash Completion Handler', confidence: 0.7 };
  }
  if (descLower.includes('evidence') || descLower.includes('photo') || descLower.includes('damage')) {
    return { trigger: 'evidence_uploaded', name: 'Evidence Upload Handler', confidence: 0.7 };
  }
  if (descLower.includes('incident') && (descLower.includes('creat') || descLower.includes('new') || descLower.includes('open'))) {
    return { trigger: 'incident_created', name: 'Incident Response Rule', confidence: 0.7 };
  }
  if (descLower.includes('reservation') || descLower.includes('booking')) {
    return { trigger: 'reservation_created', name: 'Reservation Handler', confidence: 0.7 };
  }
  if (descLower.includes('repair') || descLower.includes('maintenance')) {
    return { trigger: 'repair_order_created', name: 'Repair Order Rule', confidence: 0.7 };
  }
  if (descLower.includes('anomal') || descLower.includes('detect') || descLower.includes('spike')) {
    return { trigger: 'anomaly_detected', name: 'Anomaly Response Rule', confidence: 0.7 };
  }
  if (descLower.includes('shift') && (descLower.includes('publish') || descLower.includes('schedul'))) {
    return { trigger: 'shift_published', name: 'Shift Publication Rule', confidence: 0.7 };
  }
  if (descLower.includes('queue') && (descLower.includes('threshold') || descLower.includes('backlog'))) {
    return { trigger: 'queue_threshold', name: 'Queue Threshold Rule', confidence: 0.65 };
  }
  return { trigger: 'vehicle_status_change', name: 'Custom Rule', confidence: 0.5 };
}

describe("NL trigger detection", () => {
  it("detects SLA breach trigger", () => {
    expect(detectTrigger("When SLA is breached send alert").trigger).toBe("sla_breach");
  });

  it("detects overdue as SLA trigger", () => {
    expect(detectTrigger("Alert when vehicle is overdue").trigger).toBe("sla_breach");
  });

  it("detects wash completion trigger", () => {
    expect(detectTrigger("When a wash is completed, notify coordinator").trigger).toBe("wash_completed");
  });

  it("detects evidence upload trigger", () => {
    expect(detectTrigger("When damage photos are uploaded create incident").trigger).toBe("evidence_uploaded");
  });

  it("detects incident creation trigger", () => {
    expect(detectTrigger("When a new incident is created, open war room").trigger).toBe("incident_created");
  });

  it("detects reservation trigger", () => {
    expect(detectTrigger("When a booking comes in, notify staff").trigger).toBe("reservation_created");
  });

  it("detects repair order trigger", () => {
    expect(detectTrigger("When maintenance is needed, create log").trigger).toBe("repair_order_created");
  });

  it("detects anomaly trigger", () => {
    expect(detectTrigger("When an anomaly is detected, alert admin").trigger).toBe("anomaly_detected");
  });

  it("detects shift publication trigger", () => {
    expect(detectTrigger("When shifts are published send notification").trigger).toBe("shift_published");
  });

  it("detects queue threshold trigger", () => {
    expect(detectTrigger("When queue backlog exceeds limits").trigger).toBe("queue_threshold");
  });

  it("defaults to vehicle_status_change for unknown", () => {
    const result = detectTrigger("Do something when things happen");
    expect(result.trigger).toBe("vehicle_status_change");
    expect(result.confidence).toBe(0.5);
  });

  it("returns higher confidence for known triggers", () => {
    expect(detectTrigger("Alert on SLA breach").confidence).toBeGreaterThanOrEqual(0.7);
  });
});

// ═══════════════════════════════════════════════════════════
// PHASE 3 — WORKSPACE MEMORY SEARCH SCORING TESTS
// ═══════════════════════════════════════════════════════════

interface MemoryEntry {
  key: string;
  value: string;
  category: string;
  confidence: number;
}

function scoreMemoryEntry(entry: MemoryEntry, query: string): number {
  const lowerQuery = query.toLowerCase();
  const queryTokens = lowerQuery.split(/\s+/).filter(t => t.length > 2);
  let score = 0;
  const keyLower = entry.key.toLowerCase();
  const valueLower = entry.value.toLowerCase();
  const categoryLower = entry.category.toLowerCase();

  if (keyLower === lowerQuery) score += 10;
  if (keyLower.includes(lowerQuery)) score += 5;
  if (valueLower.includes(lowerQuery)) score += 3;
  if (categoryLower.includes(lowerQuery)) score += 2;
  for (const token of queryTokens) {
    if (keyLower.includes(token)) score += 2;
    if (valueLower.includes(token)) score += 1;
  }
  score *= entry.confidence;
  return score;
}

describe("workspace memory search scoring", () => {
  it("scores exact key match highest", () => {
    const entry = { key: "fleet_policy", value: "All vehicles must be washed daily", category: "policy", confidence: 1.0 };
    const score = scoreMemoryEntry(entry, "fleet_policy");
    expect(score).toBeGreaterThanOrEqual(10);
  });

  it("scores partial key match", () => {
    const entry = { key: "fleet_policy", value: "desc", category: "policy", confidence: 1.0 };
    const score = scoreMemoryEntry(entry, "fleet");
    expect(score).toBeGreaterThan(0);
  });

  it("scores value match", () => {
    const entry = { key: "some_key", value: "All vehicles need inspection every week", category: "ops", confidence: 1.0 };
    const score = scoreMemoryEntry(entry, "vehicles inspection");
    expect(score).toBeGreaterThan(0);
  });

  it("returns zero for no match", () => {
    const entry = { key: "policy_a", value: "Something unrelated", category: "other", confidence: 1.0 };
    const score = scoreMemoryEntry(entry, "zzz_nonexistent_term_zzz");
    expect(score).toBe(0);
  });

  it("penalizes low confidence entries", () => {
    const highConf = { key: "alert_rule", value: "test", category: "ops", confidence: 1.0 };
    const lowConf = { ...highConf, confidence: 0.3 };
    const scoreHigh = scoreMemoryEntry(highConf, "alert_rule");
    const scoreLow = scoreMemoryEntry(lowConf, "alert_rule");
    expect(scoreHigh).toBeGreaterThan(scoreLow);
  });

  it("scores category match", () => {
    const entry = { key: "abc", value: "xyz", category: "policy", confidence: 1.0 };
    const score = scoreMemoryEntry(entry, "policy");
    expect(score).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════
// PHASE 3 — STATION-SCOPED PERMISSIONS TESTS
// ═══════════════════════════════════════════════════════════

function getStationScope(user: { role: string; station: string | null }): number | null {
  if (user.role === 'admin' || user.role === 'supervisor') return null;
  return user.station ? parseInt(user.station, 10) : null;
}

describe("getStationScope", () => {
  it("returns null for admin (all access)", () => {
    expect(getStationScope({ role: 'admin', station: '1' })).toBeNull();
  });

  it("returns null for supervisor (all access)", () => {
    expect(getStationScope({ role: 'supervisor', station: '2' })).toBeNull();
  });

  it("returns stationId for coordinator", () => {
    expect(getStationScope({ role: 'coordinator', station: '5' })).toBe(5);
  });

  it("returns stationId for agent", () => {
    expect(getStationScope({ role: 'agent', station: '3' })).toBe(3);
  });

  it("returns stationId for washer", () => {
    expect(getStationScope({ role: 'washer', station: '7' })).toBe(7);
  });

  it("returns null for agent with no station assigned", () => {
    expect(getStationScope({ role: 'agent', station: null })).toBeNull();
  });

  it("returns null for coordinator with no station assigned", () => {
    expect(getStationScope({ role: 'coordinator', station: null })).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════
// PHASE 3 — STAFFING RECOMMENDATION FORMULA TESTS
// ═══════════════════════════════════════════════════════════

function computeStaffingRecommendation(
  reservationLoad: number,
  pendingWash: number,
  activeIncidents: number,
  activeRepairs: number,
): { recommended: number; confidence: number } {
  const baseFromReservations = Math.ceil(reservationLoad / 8);
  const washDemandFactor = Math.ceil(pendingWash / 5);
  const incidentDrag = Math.ceil((activeIncidents + activeRepairs) / 3);
  const recommended = Math.max(2, baseFromReservations + washDemandFactor + incidentDrag);
  const confidence = Math.min(0.95, 0.5 + (reservationLoad > 0 ? 0.2 : 0) + (pendingWash > 0 ? 0.1 : 0));
  return { recommended, confidence };
}

describe("staffing recommendation formula", () => {
  it("returns minimum of 2 with no data", () => {
    expect(computeStaffingRecommendation(0, 0, 0, 0).recommended).toBe(2);
  });

  it("scales with reservation load", () => {
    const low = computeStaffingRecommendation(4, 0, 0, 0).recommended;
    const high = computeStaffingRecommendation(40, 0, 0, 0).recommended;
    expect(high).toBeGreaterThan(low);
  });

  it("accounts for wash queue backlog", () => {
    const noWash = computeStaffingRecommendation(0, 0, 0, 0).recommended;
    const withWash = computeStaffingRecommendation(0, 15, 0, 0).recommended;
    expect(withWash).toBeGreaterThan(noWash);
  });

  it("accounts for incidents and repairs", () => {
    const noIssues = computeStaffingRecommendation(0, 0, 0, 0).recommended;
    const withIssues = computeStaffingRecommendation(0, 0, 5, 4).recommended;
    expect(withIssues).toBeGreaterThan(noIssues);
  });

  it("base from 8 reservations = 1", () => {
    expect(computeStaffingRecommendation(8, 0, 0, 0).recommended).toBe(2); // max(2, 1+0+0) = 2
  });

  it("base from 16 reservations = 2", () => {
    expect(computeStaffingRecommendation(16, 0, 0, 0).recommended).toBe(2); // max(2, 2+0+0) = 2
  });

  it("base from 24 reservations = 3", () => {
    expect(computeStaffingRecommendation(24, 0, 0, 0).recommended).toBe(3); // max(2, 3+0+0) = 3
  });

  it("confidence increases with reservation data", () => {
    const noData = computeStaffingRecommendation(0, 0, 0, 0).confidence;
    const withData = computeStaffingRecommendation(10, 0, 0, 0).confidence;
    expect(withData).toBeGreaterThan(noData);
  });

  it("confidence capped at 0.95", () => {
    const result = computeStaffingRecommendation(100, 50, 10, 10);
    expect(result.confidence).toBeLessThanOrEqual(0.95);
  });

  it("combined workload increases recommendation", () => {
    // 24 reservations (3 base) + 10 pending wash (2 factor) + 6 active (2 drag) = 7
    expect(computeStaffingRecommendation(24, 10, 3, 3).recommended).toBe(7);
  });
});

// ═══════════════════════════════════════════════════════════
// PHASE 3 — WEBHOOK VALIDATION TESTS
// ═══════════════════════════════════════════════════════════

const webhookSchema = z.object({
  connectorToken: z.string().min(1),
  reservations: reservationSyncSchema.shape.reservations,
}).strict();

describe("webhook reservation schema", () => {
  it("accepts valid webhook payload", () => {
    const result = webhookSchema.safeParse({
      connectorToken: "tok_abc123",
      reservations: [{
        externalId: "WH-001",
        customerName: "Jane Doe",
        pickupDate: "2025-07-01",
        returnDate: "2025-07-05",
      }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing connectorToken", () => {
    const result = webhookSchema.safeParse({
      reservations: [{
        externalId: "WH-001",
        customerName: "Jane",
        pickupDate: "2025-07-01",
        returnDate: "2025-07-05",
      }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty connectorToken", () => {
    const result = webhookSchema.safeParse({
      connectorToken: "",
      reservations: [{
        externalId: "WH-001",
        customerName: "Jane",
        pickupDate: "2025-07-01",
        returnDate: "2025-07-05",
      }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects extra fields (strict)", () => {
    const result = webhookSchema.safeParse({
      connectorToken: "tok_abc",
      reservations: [],
      secret: "extra",
    });
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// PHASE 3 — PERMISSION MATRIX TESTS
// ═══════════════════════════════════════════════════════════

const permissionMatrix: Record<string, { permissions: string[] }> = {
  admin: { permissions: ['manage_users', 'manage_stations', 'manage_policies', 'delete_entities', 'export_data', 'manage_connectors', 'manage_automations', 'view_audit_log', 'manage_kpis', 'all_stations'] },
  supervisor: { permissions: ['view_users', 'manage_shifts', 'manage_incidents', 'manage_automations', 'view_audit_log', 'generate_briefings', 'manage_connectors', 'manage_kpis', 'all_stations'] },
  coordinator: { permissions: ['manage_shifts', 'manage_incidents', 'view_analytics', 'manage_automations', 'assigned_station'] },
  agent: { permissions: ['view_vehicles', 'manage_wash_queue', 'submit_evidence', 'view_shifts', 'view_incidents', 'assigned_station'] },
  washer: { permissions: ['view_wash_queue', 'update_wash_status', 'submit_evidence', 'assigned_station'] },
};

describe("permission matrix", () => {
  it("admin has all_stations scope", () => {
    expect(permissionMatrix.admin.permissions).toContain('all_stations');
  });

  it("supervisor has all_stations scope", () => {
    expect(permissionMatrix.supervisor.permissions).toContain('all_stations');
  });

  it("coordinator is scoped to assigned_station", () => {
    expect(permissionMatrix.coordinator.permissions).toContain('assigned_station');
    expect(permissionMatrix.coordinator.permissions).not.toContain('all_stations');
  });

  it("agent is scoped to assigned_station", () => {
    expect(permissionMatrix.agent.permissions).toContain('assigned_station');
    expect(permissionMatrix.agent.permissions).not.toContain('all_stations');
  });

  it("washer is scoped to assigned_station", () => {
    expect(permissionMatrix.washer.permissions).toContain('assigned_station');
    expect(permissionMatrix.washer.permissions).not.toContain('all_stations');
  });

  it("only admin can delete_entities", () => {
    expect(permissionMatrix.admin.permissions).toContain('delete_entities');
    expect(permissionMatrix.supervisor.permissions).not.toContain('delete_entities');
    expect(permissionMatrix.coordinator.permissions).not.toContain('delete_entities');
  });

  it("only admin can export_data", () => {
    expect(permissionMatrix.admin.permissions).toContain('export_data');
    expect(permissionMatrix.supervisor.permissions).not.toContain('export_data');
  });

  it("admin and supervisor can manage_connectors", () => {
    expect(permissionMatrix.admin.permissions).toContain('manage_connectors');
    expect(permissionMatrix.supervisor.permissions).toContain('manage_connectors');
    expect(permissionMatrix.coordinator.permissions).not.toContain('manage_connectors');
  });

  it("every role has at least one permission", () => {
    for (const role of Object.keys(permissionMatrix)) {
      expect(permissionMatrix[role].permissions.length).toBeGreaterThan(0);
    }
  });
});
