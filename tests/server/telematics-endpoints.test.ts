/**
 * Endpoint-level integration tests for telematics + workshop substrate (Phase 4.2B-EH).
 *
 * Tests route-level behaviors: Zod schemas, validation guards, batch partial success,
 * dedupe semantics, auth/scope patterns, webhook token verification, non-regressive
 * workshop transitions, idempotent link, repair order state machine.
 *
 * These are pure-logic tests (no DB, no HTTP server) — they exercise the same validation
 * functions and Zod schemas the routes use, verifying all edge cases documented in the
 * hardening mandate.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod/v4";

import {
  normalizeEvent,
  normalizeWorkshopStatus,
  isValidWorkshopTransition,
  WORKSHOP_STATUS_ORDER,
  WORKSHOP_TO_REPAIR_ORDER_STATUS,
  validatePayloadSize,
  validateTimestamp,
  MAX_EVENT_PAYLOAD_BYTES,
  type RawTelematicsPayload,
} from "../../server/telematics/normalizer.js";

import { REPAIR_ORDER_TRANSITIONS, getStationScope } from "../../server/routes/_helpers.js";

// ─── Replicate the route-level Zod schemas (routes export the register function, not schemas) ───

const telematicsEventSchema = z.object({
  externalEventId: z.string().optional(),
  eventType: z.string().min(1),
  occurredAt: z.string().min(1),
  vehicleId: z.number().int().positive(),
  severity: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

const telematicsBatchSchema = z.object({
  events: z.array(telematicsEventSchema).min(1).max(500),
  source: z.string().min(1).optional(),
});

const webhookBatchSchema = z.object({
  connectorToken: z.string().min(1),
  events: z.array(telematicsEventSchema).min(1).max(500),
});

const workshopWebhookSchema = z.object({
  connectorToken: z.string().min(1),
  jobs: z.array(z.object({
    externalJobId: z.string().min(1),
    workshopName: z.string().min(1),
    externalStatus: z.string().optional(),
    repairOrderId: z.number().int().positive().optional(),
    estimateAmount: z.number().optional(),
    invoiceRef: z.string().optional(),
    notes: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })).min(1).max(100),
});

const workshopJobPatchSchema = z.object({
  externalStatus: z.string().optional(),
  normalizedStatus: z.string().optional(),
  estimateAmount: z.number().optional(),
  invoiceRef: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  workshopName: z.string().optional(),
}).strict();

// ─── Helper factories ───

function validEvent(overrides: Partial<z.infer<typeof telematicsEventSchema>> = {}): z.infer<typeof telematicsEventSchema> {
  return {
    vehicleId: 1,
    eventType: "odometer_update",
    occurredAt: "2025-06-15T12:00:00Z",
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// A: TELEMATICS BATCH INGESTION SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

describe("Telematics batch ingestion schema", () => {
  it("accepts a valid batch with source", () => {
    const result = telematicsBatchSchema.safeParse({
      events: [validEvent()],
      source: "fleet_provider",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid batch without source", () => {
    const result = telematicsBatchSchema.safeParse({
      events: [validEvent()],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty events array", () => {
    const result = telematicsBatchSchema.safeParse({ events: [] });
    expect(result.success).toBe(false);
  });

  it("rejects oversized batch (>500 events)", () => {
    const events = Array.from({ length: 501 }, () => validEvent());
    const result = telematicsBatchSchema.safeParse({ events });
    expect(result.success).toBe(false);
  });

  it("rejects event with vehicleId <= 0", () => {
    const result = telematicsBatchSchema.safeParse({
      events: [validEvent({ vehicleId: 0 })],
    });
    expect(result.success).toBe(false);
  });

  it("rejects event with negative vehicleId", () => {
    const result = telematicsBatchSchema.safeParse({
      events: [validEvent({ vehicleId: -1 })],
    });
    expect(result.success).toBe(false);
  });

  it("rejects event with empty eventType", () => {
    const result = telematicsBatchSchema.safeParse({
      events: [validEvent({ eventType: "" })],
    });
    expect(result.success).toBe(false);
  });

  it("rejects event with empty occurredAt", () => {
    const result = telematicsBatchSchema.safeParse({
      events: [validEvent({ occurredAt: "" })],
    });
    expect(result.success).toBe(false);
  });

  it("accepts batch with multiple events and partial externalEventIds", () => {
    const result = telematicsBatchSchema.safeParse({
      events: [
        validEvent({ externalEventId: "ext-1" }),
        validEvent(),  // no externalEventId — always inserted
        validEvent({ externalEventId: "ext-2" }),
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.events).toHaveLength(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// A: WEBHOOK SCHEMA VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

describe("Telematics webhook schema", () => {
  it("accepts a valid webhook batch", () => {
    const result = webhookBatchSchema.safeParse({
      connectorToken: "tok_valid",
      events: [validEvent()],
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing connectorToken", () => {
    const result = webhookBatchSchema.safeParse({
      events: [validEvent()],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty connectorToken", () => {
    const result = webhookBatchSchema.safeParse({
      connectorToken: "",
      events: [validEvent()],
    });
    expect(result.success).toBe(false);
  });

  it("rejects webhook with empty events", () => {
    const result = webhookBatchSchema.safeParse({
      connectorToken: "tok_valid",
      events: [],
    });
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// A: PAYLOAD SIZE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

describe("validatePayloadSize", () => {
  it("returns null for no payload", () => {
    expect(validatePayloadSize(null)).toBeNull();
    expect(validatePayloadSize(undefined)).toBeNull();
  });

  it("returns null for small payload", () => {
    expect(validatePayloadSize({ key: "value" })).toBeNull();
  });

  it("returns error for oversized payload", () => {
    const bigData = { blob: "x".repeat(MAX_EVENT_PAYLOAD_BYTES + 1) };
    const err = validatePayloadSize(bigData);
    expect(err).not.toBeNull();
    expect(err).toContain("too large");
  });

  it("returns null for payload just under the limit", () => {
    // JSON.stringify({ d: "xxx..." }) = {"d":"xxx..."} → 8 chars of wrapper + string length
    const data = { d: "x".repeat(MAX_EVENT_PAYLOAD_BYTES - 8) };
    const serialized = JSON.stringify(data);
    expect(serialized.length).toBe(MAX_EVENT_PAYLOAD_BYTES);
    expect(validatePayloadSize(data)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// A: TIMESTAMP VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

describe("validateTimestamp", () => {
  it("accepts current timestamp", () => {
    expect(validateTimestamp(new Date().toISOString())).toBeNull();
  });

  it("accepts Date object", () => {
    expect(validateTimestamp(new Date())).toBeNull();
  });

  it("rejects invalid date string", () => {
    const err = validateTimestamp("not-a-date");
    expect(err).not.toBeNull();
    expect(err).toContain("Invalid timestamp");
  });

  it("rejects timestamp before 2020", () => {
    const err = validateTimestamp("2019-12-31T23:59:59Z");
    expect(err).not.toBeNull();
    expect(err).toContain("too old");
  });

  it("rejects timestamp far in the future (>1h)", () => {
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2h ahead
    const err = validateTimestamp(future);
    expect(err).not.toBeNull();
    expect(err).toContain("future");
  });

  it("accepts timestamp slightly in the future (<1h)", () => {
    const nearFuture = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30m ahead
    expect(validateTimestamp(nearFuture)).toBeNull();
  });

  it("accepts timestamp at the 2020 boundary", () => {
    expect(validateTimestamp("2020-01-01T00:00:00Z")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// A: BATCH PARTIAL SUCCESS — normalizeEvent rejects bad items individually
// ═══════════════════════════════════════════════════════════════════════════════

describe("Batch partial success — per-event validation", () => {
  it("normalizeEvent rejects vehicleId <= 0", () => {
    expect(() =>
      normalizeEvent({ vehicleId: 0, eventType: "fuel", occurredAt: "2025-06-15T12:00:00Z" }, "api"),
    ).toThrow("vehicleId");
  });

  it("normalizeEvent rejects invalid occurredAt", () => {
    expect(() =>
      normalizeEvent({ vehicleId: 1, eventType: "fuel", occurredAt: "garbage" }, "api"),
    ).toThrow("Invalid occurredAt");
  });

  it("validatePayloadSize + validateTimestamp interplay: both can reject in same batch", () => {
    // In the route, each event is checked independently. A batch can have mixed results.
    const events = [
      validEvent({ data: { blob: "x".repeat(MAX_EVENT_PAYLOAD_BYTES + 1) } }),
      validEvent({ occurredAt: "2019-01-01T00:00:00Z" }),
      validEvent(), // valid
    ];

    const results = events.map((ev) => ({
      sizeErr: validatePayloadSize(ev.data),
      tsErr: validateTimestamp(ev.occurredAt),
    }));

    expect(results[0].sizeErr).not.toBeNull();       // oversized
    expect(results[0].tsErr).toBeNull();              // timestamp OK
    expect(results[1].sizeErr).toBeNull();            // size OK
    expect(results[1].tsErr).not.toBeNull();          // timestamp too old
    expect(results[2].sizeErr).toBeNull();            // OK
    expect(results[2].tsErr).toBeNull();              // OK
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// A: DEDUPE SEMANTICS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Dedupe semantics — route contract", () => {
  it("normalizeEvent preserves externalEventId for downstream ON CONFLICT", () => {
    const raw: RawTelematicsPayload = {
      vehicleId: 5,
      eventType: "fuel",
      occurredAt: "2025-06-15T12:00:00Z",
      externalEventId: "dedup-key-1",
    };
    const normalized = normalizeEvent(raw, "provider_x");
    expect(normalized.externalEventId).toBe("dedup-key-1");
    expect(normalized.source).toBe("provider_x");
  });

  it("normalizeEvent sets externalEventId to null when absent", () => {
    const raw: RawTelematicsPayload = {
      vehicleId: 5,
      eventType: "fuel",
      occurredAt: "2025-06-15T12:00:00Z",
    };
    const normalized = normalizeEvent(raw, "api");
    expect(normalized.externalEventId).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// A: NON-REGRESSIVE WORKSHOP STATUS — endpoint contract
// ═══════════════════════════════════════════════════════════════════════════════

describe("Non-regressive workshop status transitions (route contract)", () => {
  it("forward progression is allowed", () => {
    for (let i = 0; i < WORKSHOP_STATUS_ORDER.length - 1; i++) {
      expect(isValidWorkshopTransition(WORKSHOP_STATUS_ORDER[i], WORKSHOP_STATUS_ORDER[i + 1])).toBe(true);
    }
  });

  it("backward regression is blocked", () => {
    for (let i = 1; i < WORKSHOP_STATUS_ORDER.length; i++) {
      expect(isValidWorkshopTransition(WORKSHOP_STATUS_ORDER[i], WORKSHOP_STATUS_ORDER[i - 1])).toBe(false);
    }
  });

  it("cancellation is allowed from any non-terminal state", () => {
    // WORKSHOP_STATUS_ORDER includes 'completed' at the end, which IS terminal
    const nonTerminal = WORKSHOP_STATUS_ORDER.filter((s) => s !== "completed");
    for (const status of nonTerminal) {
      expect(isValidWorkshopTransition(status, "cancelled")).toBe(true);
    }
  });

  it("nothing transitions out of completed", () => {
    for (const target of [...WORKSHOP_STATUS_ORDER, "cancelled"]) {
      expect(isValidWorkshopTransition("completed", target)).toBe(false);
    }
  });

  it("nothing transitions out of cancelled", () => {
    for (const target of [...WORKSHOP_STATUS_ORDER, "completed"]) {
      expect(isValidWorkshopTransition("cancelled", target)).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// A: WORKSHOP PATCH SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

describe("Workshop job PATCH schema (whitelist)", () => {
  it("accepts valid partial update", () => {
    const result = workshopJobPatchSchema.safeParse({
      externalStatus: "in_repair",
      notes: "Updated from vendor",
    });
    expect(result.success).toBe(true);
  });

  it("rejects extra fields (strict mode)", () => {
    const result = workshopJobPatchSchema.safeParse({
      externalStatus: "in_repair",
      adminSecret: "injected",
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty patch (no-op)", () => {
    const result = workshopJobPatchSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts nullable fields set to null", () => {
    const result = workshopJobPatchSchema.safeParse({
      invoiceRef: null,
      notes: null,
      metadata: null,
    });
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// A: WORKSHOP WEBHOOK SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

describe("Workshop webhook schema", () => {
  it("accepts valid webhook with single job", () => {
    const result = workshopWebhookSchema.safeParse({
      connectorToken: "tok_123",
      jobs: [{ externalJobId: "J-001", workshopName: "Quick Fix Auto" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing connectorToken", () => {
    const result = workshopWebhookSchema.safeParse({
      jobs: [{ externalJobId: "J-001", workshopName: "Quick Fix Auto" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty jobs array", () => {
    const result = workshopWebhookSchema.safeParse({
      connectorToken: "tok_123",
      jobs: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects job with empty externalJobId", () => {
    const result = workshopWebhookSchema.safeParse({
      connectorToken: "tok_123",
      jobs: [{ externalJobId: "", workshopName: "Quick Fix Auto" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects oversized batch (>100 jobs)", () => {
    const jobs = Array.from({ length: 101 }, (_, i) => ({
      externalJobId: `J-${i}`,
      workshopName: "Shop",
    }));
    const result = workshopWebhookSchema.safeParse({
      connectorToken: "tok_123",
      jobs,
    });
    expect(result.success).toBe(false);
  });

  it("accepts maximum batch size (100 jobs)", () => {
    const jobs = Array.from({ length: 100 }, (_, i) => ({
      externalJobId: `J-${i}`,
      workshopName: "Shop",
    }));
    const result = workshopWebhookSchema.safeParse({
      connectorToken: "tok_123",
      jobs,
    });
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// D: STATION SCOPE — getStationScope logic verification
// ═══════════════════════════════════════════════════════════════════════════════

describe("Station scope — auth/scope verification", () => {
  it("admin sees all (returns null)", () => {
    const scope = getStationScope({ role: "admin" } as any);
    expect(scope).toBeNull();
  });

  it("supervisor sees all (returns null)", () => {
    const scope = getStationScope({ role: "supervisor" } as any);
    expect(scope).toBeNull();
  });

  it("washer with station sees only their station", () => {
    const scope = getStationScope({ role: "washer", station: "42" } as any);
    expect(scope).toBe(42);
  });

  it("washer without station returns 'none' (no access)", () => {
    const scope = getStationScope({ role: "washer" } as any);
    expect(scope).toBe("none");
  });

  it("customer without station returns 'none'", () => {
    const scope = getStationScope({ role: "customer" } as any);
    expect(scope).toBe("none");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// D: REPAIR ORDER STATE MACHINE — transition validation
// ═══════════════════════════════════════════════════════════════════════════════

describe("Repair order state machine — auth verification", () => {
  it("open → in_progress is allowed", () => {
    expect(REPAIR_ORDER_TRANSITIONS["open"]).toContain("in_progress");
  });

  it("open → cancelled is allowed", () => {
    expect(REPAIR_ORDER_TRANSITIONS["open"]).toContain("cancelled");
  });

  it("open → completed is NOT allowed (must go through in_progress)", () => {
    expect(REPAIR_ORDER_TRANSITIONS["open"]).not.toContain("completed");
  });

  it("in_progress → awaiting_parts is allowed", () => {
    expect(REPAIR_ORDER_TRANSITIONS["in_progress"]).toContain("awaiting_parts");
  });

  it("in_progress → completed is allowed", () => {
    expect(REPAIR_ORDER_TRANSITIONS["in_progress"]).toContain("completed");
  });

  it("awaiting_parts → in_progress is allowed (parts arrived)", () => {
    expect(REPAIR_ORDER_TRANSITIONS["awaiting_parts"]).toContain("in_progress");
  });

  it("completed is terminal (no outbound transitions)", () => {
    expect(REPAIR_ORDER_TRANSITIONS["completed"]).toEqual([]);
  });

  it("cancelled is terminal (no outbound transitions)", () => {
    expect(REPAIR_ORDER_TRANSITIONS["cancelled"]).toEqual([]);
  });

  it("workshop → RO status consistency: all mapped RO targets are reachable", () => {
    const allReachable = new Set(Object.values(REPAIR_ORDER_TRANSITIONS).flat());
    // Add initial states themselves (they are valid starting points)
    allReachable.add("open");

    for (const [ws, ro] of Object.entries(WORKSHOP_TO_REPAIR_ORDER_STATUS)) {
      expect(allReachable.has(ro) || ro === "open").toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// A: WORKSHOP STATUS NORMALIZATION — endpoint-level contracts
// ═══════════════════════════════════════════════════════════════════════════════

describe("Workshop status normalization — route contracts", () => {
  it("normalizes common external statuses", () => {
    expect(normalizeWorkshopStatus("In Repair")).toBe("in_repair");
    expect(normalizeWorkshopStatus("COMPLETED")).toBe("completed");
    expect(normalizeWorkshopStatus("Parts Ordered")).toBe("parts_ordered");
  });

  it("unknown statuses default to pending", () => {
    expect(normalizeWorkshopStatus("some_random_status")).toBe("pending");
  });

  it("undefined/null defaults to pending", () => {
    expect(normalizeWorkshopStatus(undefined)).toBe("pending");
  });

  it("all WORKSHOP_STATUS_ORDER entries are reachable via normalization", () => {
    // Each canonical status should normalize to itself
    for (const status of WORKSHOP_STATUS_ORDER) {
      expect(normalizeWorkshopStatus(status)).toBe(status);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// A + D: IDEMPOTENT LINK — contract verification
// ═══════════════════════════════════════════════════════════════════════════════

describe("Idempotent link-repair-order — schema contract", () => {
  const linkSchema = z.object({ repairOrderId: z.number().int().positive() });

  it("accepts valid positive integer repairOrderId", () => {
    const result = linkSchema.safeParse({ repairOrderId: 42 });
    expect(result.success).toBe(true);
  });

  it("rejects zero repairOrderId", () => {
    const result = linkSchema.safeParse({ repairOrderId: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative repairOrderId", () => {
    const result = linkSchema.safeParse({ repairOrderId: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer repairOrderId", () => {
    const result = linkSchema.safeParse({ repairOrderId: 1.5 });
    expect(result.success).toBe(false);
  });

  it("rejects missing repairOrderId", () => {
    const result = linkSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
