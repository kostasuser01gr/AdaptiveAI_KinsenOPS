import { describe, it, expect } from "vitest";

import {
  insertVehicleEventSchema,
  insertWorkshopJobSchema,
} from "../../shared/schema.js";

import {
  normalizeEventType,
  normalizeSeverity,
  normalizeEvent,
  normalizeBatch,
  normalizeWorkshopStatus,
  WORKSHOP_TO_REPAIR_ORDER_STATUS,
  VEHICLE_EVENT_TYPES,
  WORKSHOP_STATUS_ORDER,
  isValidWorkshopTransition,
  type RawTelematicsPayload,
} from "../../server/telematics/normalizer.js";

// ─── Vehicle Event Schema Validation ───

describe("insertVehicleEventSchema", () => {
  it("accepts valid vehicle event data", () => {
    const result = insertVehicleEventSchema.safeParse({
      vehicleId: 1,
      source: "telematics_provider",
      eventType: "odometer_update",
      occurredAt: new Date(),
      severity: "info",
    });
    expect(result.success).toBe(true);
  });

  it("accepts event with all optional fields", () => {
    const result = insertVehicleEventSchema.safeParse({
      vehicleId: 1,
      connectorId: 5,
      source: "webhook:my_provider",
      externalEventId: "ext-123",
      eventType: "engine_alert",
      occurredAt: new Date(),
      severity: "critical",
      payload: { code: "P0301", message: "Cylinder 1 Misfire" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing vehicleId", () => {
    const result = insertVehicleEventSchema.safeParse({
      source: "api",
      eventType: "location_ping",
      occurredAt: new Date(),
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing eventType", () => {
    const result = insertVehicleEventSchema.safeParse({
      vehicleId: 1,
      source: "api",
      occurredAt: new Date(),
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing occurredAt", () => {
    const result = insertVehicleEventSchema.safeParse({
      vehicleId: 1,
      source: "api",
      eventType: "fuel_update",
    });
    expect(result.success).toBe(false);
  });

  it("omits auto-managed fields (receivedAt, processed, processedAt, derivedAction, derivedEntityType, derivedEntityId)", () => {
    const result = insertVehicleEventSchema.safeParse({
      vehicleId: 1,
      source: "api",
      eventType: "location_ping",
      occurredAt: new Date(),
      receivedAt: new Date(),
      processed: true,
      processedAt: new Date(),
      derivedAction: "should_be_stripped",
    });
    // These fields should be omitted by the schema
    if (result.success) {
      expect(result.data).not.toHaveProperty("receivedAt");
      expect(result.data).not.toHaveProperty("processed");
      expect(result.data).not.toHaveProperty("processedAt");
      expect(result.data).not.toHaveProperty("derivedAction");
    }
  });
});

// ─── Workshop Job Schema Validation ───

describe("insertWorkshopJobSchema", () => {
  it("accepts valid workshop job data", () => {
    const result = insertWorkshopJobSchema.safeParse({
      workshopName: "AutoFix Workshop",
      normalizedStatus: "pending",
    });
    expect(result.success).toBe(true);
  });

  it("accepts job with all optional fields", () => {
    const result = insertWorkshopJobSchema.safeParse({
      repairOrderId: 10,
      connectorId: 3,
      externalJobId: "WS-456",
      workshopName: "Quick Repair Co",
      externalStatus: "in_progress",
      normalizedStatus: "in_repair",
      estimateAmount: 350.50,
      invoiceRef: "INV-2025-001",
      notes: "Brake pads replacement",
      metadata: { workshopBranch: "downtown" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing workshopName", () => {
    const result = insertWorkshopJobSchema.safeParse({
      normalizedStatus: "pending",
    });
    expect(result.success).toBe(false);
  });

  it("omits auto-managed fields (createdAt, updatedAt, lastSyncAt)", () => {
    const result = insertWorkshopJobSchema.safeParse({
      workshopName: "Test Workshop",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSyncAt: new Date(),
    });
    if (result.success) {
      expect(result.data).not.toHaveProperty("createdAt");
      expect(result.data).not.toHaveProperty("updatedAt");
      expect(result.data).not.toHaveProperty("lastSyncAt");
    }
  });
});

// ─── Normalization: Event Type ───

describe("normalizeEventType", () => {
  it("maps canonical types directly", () => {
    expect(normalizeEventType("odometer_update")).toBe("odometer_update");
    expect(normalizeEventType("fuel_update")).toBe("fuel_update");
    expect(normalizeEventType("engine_alert")).toBe("engine_alert");
    expect(normalizeEventType("location_ping")).toBe("location_ping");
    expect(normalizeEventType("trip_started")).toBe("trip_started");
    expect(normalizeEventType("trip_ended")).toBe("trip_ended");
    expect(normalizeEventType("dtc_code")).toBe("dtc_code");
  });

  it("maps common aliases", () => {
    expect(normalizeEventType("gps")).toBe("location_ping");
    expect(normalizeEventType("location")).toBe("location_ping");
    expect(normalizeEventType("odometer")).toBe("odometer_update");
    expect(normalizeEventType("mileage")).toBe("odometer_update");
    expect(normalizeEventType("fuel")).toBe("fuel_update");
    expect(normalizeEventType("fuel_level")).toBe("fuel_update");
    expect(normalizeEventType("battery")).toBe("battery_update");
    expect(normalizeEventType("check_engine")).toBe("engine_alert");
    expect(normalizeEventType("maintenance")).toBe("maintenance_alert");
    expect(normalizeEventType("service_due")).toBe("maintenance_alert");
    expect(normalizeEventType("trip_start")).toBe("trip_started");
    expect(normalizeEventType("trip_end")).toBe("trip_ended");
    expect(normalizeEventType("diagnostic")).toBe("dtc_code");
    expect(normalizeEventType("tire")).toBe("tire_pressure");
    expect(normalizeEventType("coolant")).toBe("coolant_temp");
  });

  it("handles case insensitivity", () => {
    expect(normalizeEventType("GPS")).toBe("location_ping");
    expect(normalizeEventType("Odometer_Update")).toBe("odometer_update");
    expect(normalizeEventType("FUEL_UPDATE")).toBe("fuel_update");
  });

  it("handles space/dash normalization", () => {
    expect(normalizeEventType("fuel level")).toBe("fuel_update");
    expect(normalizeEventType("fuel-level")).toBe("fuel_update");
    expect(normalizeEventType("trip start")).toBe("trip_started");
  });

  it("falls back to 'custom' for unknown types", () => {
    expect(normalizeEventType("xyz_unknown")).toBe("custom");
    expect(normalizeEventType("foobar")).toBe("custom");
    expect(normalizeEventType("")).toBe("custom");
  });
});

// ─── Normalization: Severity ───

describe("normalizeSeverity", () => {
  it("maps to 'info' by default", () => {
    expect(normalizeSeverity()).toBe("info");
    expect(normalizeSeverity("")).toBe("info");
    expect(normalizeSeverity("low")).toBe("info");
    expect(normalizeSeverity("normal")).toBe("info");
  });

  it("maps warning-level values", () => {
    expect(normalizeSeverity("warning")).toBe("warning");
    expect(normalizeSeverity("warn")).toBe("warning");
    expect(normalizeSeverity("medium")).toBe("warning");
    expect(normalizeSeverity("WARNING")).toBe("warning");
  });

  it("maps critical-level values", () => {
    expect(normalizeSeverity("critical")).toBe("critical");
    expect(normalizeSeverity("error")).toBe("critical");
    expect(normalizeSeverity("high")).toBe("critical");
    expect(normalizeSeverity("CRITICAL")).toBe("critical");
  });
});

// ─── Normalization: Full Event ───

describe("normalizeEvent", () => {
  const basePayload: RawTelematicsPayload = {
    vehicleId: 42,
    eventType: "odometer",
    occurredAt: "2025-04-07T12:00:00Z",
  };

  it("normalizes a valid payload", () => {
    const result = normalizeEvent(basePayload, "test_provider");
    expect(result.vehicleId).toBe(42);
    expect(result.eventType).toBe("odometer_update");
    expect(result.severity).toBe("info");
    expect(result.source).toBe("test_provider");
    expect(result.occurredAt).toBeInstanceOf(Date);
    expect(result.connectorId).toBeNull();
    expect(result.externalEventId).toBeNull();
  });

  it("includes connectorId when provided", () => {
    const result = normalizeEvent(basePayload, "test", 7);
    expect(result.connectorId).toBe(7);
  });

  it("preserves externalEventId for dedup", () => {
    const result = normalizeEvent({ ...basePayload, externalEventId: "ext-99" }, "test");
    expect(result.externalEventId).toBe("ext-99");
  });

  it("stores raw data in payload", () => {
    const result = normalizeEvent({ ...basePayload, data: { mileage: 50000 } }, "test");
    expect(result.payload).toEqual({ mileage: 50000 });
  });

  it("throws on invalid date", () => {
    expect(() => normalizeEvent({ ...basePayload, occurredAt: "not-a-date" }, "test")).toThrow("Invalid occurredAt date");
  });

  it("throws on missing vehicleId", () => {
    expect(() => normalizeEvent({ ...basePayload, vehicleId: 0 as any }, "test")).toThrow("vehicleId is required");
  });
});

// ─── Normalization: Batch ───

describe("normalizeBatch", () => {
  it("normalizes a batch with all valid events", () => {
    const raws: RawTelematicsPayload[] = [
      { vehicleId: 1, eventType: "gps", occurredAt: "2025-04-07T12:00:00Z" },
      { vehicleId: 2, eventType: "fuel", occurredAt: "2025-04-07T12:01:00Z" },
    ];
    const { valid, errors } = normalizeBatch(raws, "batch_test");
    expect(valid).toHaveLength(2);
    expect(errors).toHaveLength(0);
    expect(valid[0].eventType).toBe("location_ping");
    expect(valid[1].eventType).toBe("fuel_update");
  });

  it("captures errors without failing the whole batch", () => {
    const raws: RawTelematicsPayload[] = [
      { vehicleId: 1, eventType: "gps", occurredAt: "2025-04-07T12:00:00Z" },
      { vehicleId: 0 as any, eventType: "gps", occurredAt: "2025-04-07T12:01:00Z" },
      { vehicleId: 2, eventType: "fuel", occurredAt: "not-a-date" },
    ];
    const { valid, errors } = normalizeBatch(raws, "batch_test");
    expect(valid).toHaveLength(1);
    expect(errors).toHaveLength(2);
    expect(errors[0].index).toBe(1);
    expect(errors[1].index).toBe(2);
  });

  it("sets connectorId on all valid events when provided", () => {
    const raws: RawTelematicsPayload[] = [
      { vehicleId: 1, eventType: "gps", occurredAt: "2025-04-07T12:00:00Z" },
    ];
    const { valid } = normalizeBatch(raws, "test", 42);
    expect(valid[0].connectorId).toBe(42);
  });
});

// ─── Workshop Status Normalization ───

describe("normalizeWorkshopStatus", () => {
  it("maps common external statuses", () => {
    expect(normalizeWorkshopStatus("estimate")).toBe("estimate_received");
    expect(normalizeWorkshopStatus("quoted")).toBe("estimate_received");
    expect(normalizeWorkshopStatus("approved")).toBe("approved");
    expect(normalizeWorkshopStatus("accepted")).toBe("approved");
    expect(normalizeWorkshopStatus("parts_ordered")).toBe("parts_ordered");
    expect(normalizeWorkshopStatus("waiting_parts")).toBe("parts_ordered");
    expect(normalizeWorkshopStatus("in_progress")).toBe("in_repair");
    expect(normalizeWorkshopStatus("repairing")).toBe("in_repair");
    expect(normalizeWorkshopStatus("qa")).toBe("qa_ready");
    expect(normalizeWorkshopStatus("quality_check")).toBe("qa_ready");
    expect(normalizeWorkshopStatus("done")).toBe("completed");
    expect(normalizeWorkshopStatus("finished")).toBe("completed");
    expect(normalizeWorkshopStatus("cancelled")).toBe("cancelled");
    expect(normalizeWorkshopStatus("rejected")).toBe("cancelled");
  });

  it("handles case insensitivity + spaces/dashes", () => {
    expect(normalizeWorkshopStatus("In Progress")).toBe("in_repair");
    expect(normalizeWorkshopStatus("PARTS-ORDERED")).toBe("parts_ordered");
    expect(normalizeWorkshopStatus("Quality Check")).toBe("qa_ready");
  });

  it("defaults to 'pending' for unknown statuses", () => {
    expect(normalizeWorkshopStatus(undefined)).toBe("pending");
    expect(normalizeWorkshopStatus("")).toBe("pending");
    expect(normalizeWorkshopStatus("xyz_unknown")).toBe("pending");
  });
});

// ─── Workshop → Repair Order Status Mapping ───

describe("WORKSHOP_TO_REPAIR_ORDER_STATUS", () => {
  it("maps all workshop statuses to repair order statuses", () => {
    expect(WORKSHOP_TO_REPAIR_ORDER_STATUS["pending"]).toBe("open");
    expect(WORKSHOP_TO_REPAIR_ORDER_STATUS["estimate_received"]).toBe("open");
    expect(WORKSHOP_TO_REPAIR_ORDER_STATUS["approved"]).toBe("open");
    expect(WORKSHOP_TO_REPAIR_ORDER_STATUS["parts_ordered"]).toBe("awaiting_parts");
    expect(WORKSHOP_TO_REPAIR_ORDER_STATUS["in_repair"]).toBe("in_progress");
    expect(WORKSHOP_TO_REPAIR_ORDER_STATUS["qa_ready"]).toBe("in_progress");
    expect(WORKSHOP_TO_REPAIR_ORDER_STATUS["completed"]).toBe("completed");
    expect(WORKSHOP_TO_REPAIR_ORDER_STATUS["cancelled"]).toBe("cancelled");
  });

  it("covers all valid repair order terminal statuses", () => {
    const roStatuses = new Set(Object.values(WORKSHOP_TO_REPAIR_ORDER_STATUS));
    expect(roStatuses.has("open")).toBe(true);
    expect(roStatuses.has("in_progress")).toBe(true);
    expect(roStatuses.has("awaiting_parts")).toBe(true);
    expect(roStatuses.has("completed")).toBe(true);
    expect(roStatuses.has("cancelled")).toBe(true);
  });
});

// ─── Vehicle Event Types Constants ───

describe("VEHICLE_EVENT_TYPES", () => {
  it("contains all expected canonical types", () => {
    const expected = [
      "location_ping", "odometer_update", "fuel_update", "battery_update",
      "engine_alert", "maintenance_alert", "geofence_entry", "geofence_exit",
      "ignition_on", "ignition_off", "trip_started", "trip_ended",
      "dtc_code", "tire_pressure", "coolant_temp", "custom",
    ];
    for (const t of expected) {
      expect(VEHICLE_EVENT_TYPES).toContain(t);
    }
  });

  it("has no duplicate entries", () => {
    const unique = new Set(VEHICLE_EVENT_TYPES);
    expect(unique.size).toBe(VEHICLE_EVENT_TYPES.length);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Phase 4.2B Hardening Tests
// ═══════════════════════════════════════════════════════════════════════════

// ─── Payload Safety: Timestamp Validation ───

describe("normalizeEvent — timestamp validation", () => {
  const basePayload: RawTelematicsPayload = {
    vehicleId: 1,
    eventType: "odometer_update",
    occurredAt: "2025-06-15T10:00:00Z",
  };

  it("rejects invalid timestamp strings", () => {
    expect(() =>
      normalizeEvent({ ...basePayload, occurredAt: "not-a-date" }, "test"),
    ).toThrow("Invalid occurredAt date");
  });

  it("rejects empty string timestamp", () => {
    expect(() =>
      normalizeEvent({ ...basePayload, occurredAt: "" }, "test"),
    ).toThrow("Invalid occurredAt date");
  });

  it("accepts valid ISO timestamp", () => {
    const result = normalizeEvent(
      { ...basePayload, occurredAt: "2025-06-15T10:00:00Z" },
      "test",
    );
    expect(result.occurredAt).toBeInstanceOf(Date);
    expect(result.occurredAt.getTime()).not.toBeNaN();
  });

  it("accepts Date objects", () => {
    const d = new Date("2025-06-15T10:00:00Z");
    const result = normalizeEvent({ ...basePayload, occurredAt: d }, "test");
    expect(result.occurredAt).toEqual(d);
  });
});

// ─── Payload Safety: Unknown Event Types ───

describe("normalizeEventType — unknown types", () => {
  it("maps completely unknown types to 'custom'", () => {
    expect(normalizeEventType("totally_unknown_event")).toBe("custom");
    expect(normalizeEventType("xyz_123")).toBe("custom");
    expect(normalizeEventType("")).toBe("custom");
  });

  it("handles whitespace and special characters", () => {
    expect(normalizeEventType("  gps  ")).toBe("custom"); // leading space not trimmed by design — maps to custom
    expect(normalizeEventType("engine alert")).toBe("engine_alert"); // space → underscore
    expect(normalizeEventType("FUEL-LEVEL")).toBe("fuel_update"); // dash → underscore, case insensitive
  });
});

// ─── Batch Partial Success Reporting ───

describe("normalizeBatch — partial success", () => {
  it("reports individual errors with correct indices", () => {
    const batch: RawTelematicsPayload[] = [
      { vehicleId: 1, eventType: "fuel", occurredAt: "2025-06-15T10:00:00Z" },
      { vehicleId: 0, eventType: "fuel", occurredAt: "2025-06-15T10:00:00Z" }, // invalid vehicleId
      { vehicleId: 2, eventType: "gps", occurredAt: "2025-06-15T10:00:00Z" },
      { vehicleId: 3, eventType: "odometer", occurredAt: "not-a-date" }, // invalid date
    ];

    const { valid, errors } = normalizeBatch(batch, "test");
    expect(valid).toHaveLength(2);
    expect(errors).toHaveLength(2);
    expect(errors[0].index).toBe(1);
    expect(errors[1].index).toBe(3);
    expect(errors[0].message).toContain("vehicleId");
    expect(errors[1].message).toContain("occurredAt");
  });

  it("returns all valid when no errors", () => {
    const batch: RawTelematicsPayload[] = [
      { vehicleId: 1, eventType: "fuel", occurredAt: "2025-06-15T10:00:00Z" },
      { vehicleId: 2, eventType: "gps", occurredAt: "2025-06-15T10:00:00Z" },
    ];
    const { valid, errors } = normalizeBatch(batch, "test");
    expect(valid).toHaveLength(2);
    expect(errors).toHaveLength(0);
  });

  it("returns all errors when all invalid", () => {
    const batch: RawTelematicsPayload[] = [
      { vehicleId: 0, eventType: "fuel", occurredAt: "2025-06-15T10:00:00Z" },
      { vehicleId: -1, eventType: "gps", occurredAt: "2025-06-15T10:00:00Z" },
    ];
    const { valid, errors } = normalizeBatch(batch, "test");
    expect(valid).toHaveLength(0);
    expect(errors).toHaveLength(2);
  });
});

// ─── Workshop Status Non-Regression ───

describe("isValidWorkshopTransition", () => {
  it("allows forward transitions", () => {
    expect(isValidWorkshopTransition("pending", "estimate_received")).toBe(true);
    expect(isValidWorkshopTransition("pending", "approved")).toBe(true);
    expect(isValidWorkshopTransition("approved", "parts_ordered")).toBe(true);
    expect(isValidWorkshopTransition("parts_ordered", "in_repair")).toBe(true);
    expect(isValidWorkshopTransition("in_repair", "qa_ready")).toBe(true);
    expect(isValidWorkshopTransition("qa_ready", "completed")).toBe(true);
  });

  it("blocks backward transitions", () => {
    expect(isValidWorkshopTransition("completed", "in_repair")).toBe(false);
    expect(isValidWorkshopTransition("in_repair", "pending")).toBe(false);
    expect(isValidWorkshopTransition("qa_ready", "approved")).toBe(false);
    expect(isValidWorkshopTransition("approved", "estimate_received")).toBe(false);
  });

  it("blocks transitions from terminal states", () => {
    expect(isValidWorkshopTransition("completed", "pending")).toBe(false);
    expect(isValidWorkshopTransition("completed", "in_repair")).toBe(false);
    expect(isValidWorkshopTransition("completed", "cancelled")).toBe(false);
    expect(isValidWorkshopTransition("cancelled", "pending")).toBe(false);
    expect(isValidWorkshopTransition("cancelled", "in_repair")).toBe(false);
    expect(isValidWorkshopTransition("cancelled", "completed")).toBe(false);
  });

  it("allows cancellation from any non-terminal state", () => {
    expect(isValidWorkshopTransition("pending", "cancelled")).toBe(true);
    expect(isValidWorkshopTransition("estimate_received", "cancelled")).toBe(true);
    expect(isValidWorkshopTransition("approved", "cancelled")).toBe(true);
    expect(isValidWorkshopTransition("parts_ordered", "cancelled")).toBe(true);
    expect(isValidWorkshopTransition("in_repair", "cancelled")).toBe(true);
    expect(isValidWorkshopTransition("qa_ready", "cancelled")).toBe(true);
  });

  it("blocks same-state transitions (not forward)", () => {
    expect(isValidWorkshopTransition("pending", "pending")).toBe(false);
    expect(isValidWorkshopTransition("in_repair", "in_repair")).toBe(false);
  });
});

// ─── WORKSHOP_STATUS_ORDER ───

describe("WORKSHOP_STATUS_ORDER", () => {
  it("contains all non-cancelled workshop statuses in order", () => {
    expect(WORKSHOP_STATUS_ORDER).toEqual([
      "pending",
      "estimate_received",
      "approved",
      "parts_ordered",
      "in_repair",
      "qa_ready",
      "completed",
    ]);
  });

  it("has no duplicates", () => {
    const unique = new Set(WORKSHOP_STATUS_ORDER);
    expect(unique.size).toBe(WORKSHOP_STATUS_ORDER.length);
  });
});

// ─── Dedupe Behavior (Unit-Level) ───

describe("normalizeEvent — dedup fields", () => {
  it("preserves externalEventId for dedupe", () => {
    const raw: RawTelematicsPayload = {
      vehicleId: 1,
      eventType: "odometer_update",
      occurredAt: "2025-06-15T10:00:00Z",
      externalEventId: "ext-abc-123",
    };
    const result = normalizeEvent(raw, "test_source");
    expect(result.externalEventId).toBe("ext-abc-123");
    expect(result.source).toBe("test_source");
  });

  it("sets externalEventId to null when not provided", () => {
    const raw: RawTelematicsPayload = {
      vehicleId: 1,
      eventType: "fuel_update",
      occurredAt: "2025-06-15T10:00:00Z",
    };
    const result = normalizeEvent(raw, "test_source");
    expect(result.externalEventId).toBeNull();
  });

  it("same event with same externalEventId normalizes identically", () => {
    const raw: RawTelematicsPayload = {
      vehicleId: 42,
      eventType: "engine_alert",
      occurredAt: "2025-06-15T10:00:00Z",
      externalEventId: "dedupe-test-1",
      severity: "critical",
      data: { code: "P0301" },
    };
    const a = normalizeEvent(raw, "src1");
    const b = normalizeEvent(raw, "src1");
    expect(a.eventType).toBe(b.eventType);
    expect(a.vehicleId).toBe(b.vehicleId);
    expect(a.externalEventId).toBe(b.externalEventId);
    expect(a.source).toBe(b.source);
  });

  it("different source with same externalEventId normalizes to different source field", () => {
    const raw: RawTelematicsPayload = {
      vehicleId: 42,
      eventType: "fuel",
      occurredAt: "2025-06-15T10:00:00Z",
      externalEventId: "shared-id-1",
    };
    const a = normalizeEvent(raw, "provider_a");
    const b = normalizeEvent(raw, "provider_b");
    expect(a.source).toBe("provider_a");
    expect(b.source).toBe("provider_b");
    // These would NOT conflict on the unique index (source, externalEventId)
  });
});

// ─── Severity Edge Cases ───

describe("normalizeSeverity — edge cases for hardening", () => {
  it("maps 'error' to critical", () => {
    expect(normalizeSeverity("error")).toBe("critical");
    expect(normalizeSeverity("ERROR")).toBe("critical");
  });

  it("maps 'high' to critical", () => {
    expect(normalizeSeverity("high")).toBe("critical");
    expect(normalizeSeverity("HIGH")).toBe("critical");
  });

  it("maps 'warn' to warning", () => {
    expect(normalizeSeverity("warn")).toBe("warning");
    expect(normalizeSeverity("WARN")).toBe("warning");
  });

  it("maps 'medium' to warning", () => {
    expect(normalizeSeverity("medium")).toBe("warning");
  });

  it("maps unknown severity to info", () => {
    expect(normalizeSeverity("low")).toBe("info");
    expect(normalizeSeverity("notice")).toBe("info");
    expect(normalizeSeverity("debug")).toBe("info");
    expect(normalizeSeverity("")).toBe("info");
  });
});

// ─── Repair Order Transition Guard ───

describe("WORKSHOP_TO_REPAIR_ORDER_STATUS — transition validity", () => {
  it("all mapped RO statuses are valid repair order states", () => {
    const validROStatuses = ["open", "in_progress", "awaiting_parts", "completed", "cancelled"];
    for (const [_workshopStatus, roStatus] of Object.entries(WORKSHOP_TO_REPAIR_ORDER_STATUS)) {
      expect(validROStatuses).toContain(roStatus);
    }
  });

  it("completed workshop maps to completed RO", () => {
    expect(WORKSHOP_TO_REPAIR_ORDER_STATUS["completed"]).toBe("completed");
  });

  it("cancelled workshop maps to cancelled RO", () => {
    expect(WORKSHOP_TO_REPAIR_ORDER_STATUS["cancelled"]).toBe("cancelled");
  });

  it("parts_ordered maps to awaiting_parts (valid from open or in_progress)", () => {
    expect(WORKSHOP_TO_REPAIR_ORDER_STATUS["parts_ordered"]).toBe("awaiting_parts");
  });
});
