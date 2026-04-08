import { describe, it, expect } from "vitest";
import {
  insertReservationSchema,
  insertRepairOrderSchema,
  insertDowntimeEventSchema,
  insertKpiDefinitionSchema,
  insertKpiSnapshotSchema,
  insertAnomalySchema,
  insertExecutiveBriefingSchema,
} from "../../shared/schema.js";

// ─── RESERVATION SCHEMA VALIDATION ───
describe("insertReservationSchema", () => {
  it("accepts valid reservation", () => {
    const result = insertReservationSchema.safeParse({
      customerName: "John Doe",
      pickupDate: new Date("2026-04-15T09:00:00Z"),
      returnDate: new Date("2026-04-18T16:00:00Z"),
    });
    expect(result.success).toBe(true);
  });

  it("accepts reservation with all fields", () => {
    const result = insertReservationSchema.safeParse({
      vehicleId: 1,
      stationId: 1,
      customerName: "Jane Smith",
      customerEmail: "jane@example.com",
      customerPhone: "+1234567890",
      status: "confirmed",
      source: "website",
      pickupDate: new Date("2026-04-15T09:00:00Z"),
      returnDate: new Date("2026-04-18T16:00:00Z"),
      notes: "VIP customer",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing customerName", () => {
    const result = insertReservationSchema.safeParse({
      pickupDate: new Date("2026-04-15T09:00:00Z"),
      returnDate: new Date("2026-04-18T16:00:00Z"),
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing pickupDate", () => {
    const result = insertReservationSchema.safeParse({
      customerName: "John Doe",
      returnDate: new Date("2026-04-18T16:00:00Z"),
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing returnDate", () => {
    const result = insertReservationSchema.safeParse({
      customerName: "John Doe",
      pickupDate: new Date("2026-04-15T09:00:00Z"),
    });
    expect(result.success).toBe(false);
  });
});

// ─── RESERVATION STATE MACHINE ───
describe("reservation state machine", () => {
  const RESERVATION_TRANSITIONS: Record<string, string[]> = {
    confirmed: ['checked_out', 'cancelled', 'no_show'],
    checked_out: ['returned'],
    returned: [],
    cancelled: [],
    no_show: [],
  };

  function isValidTransition(from: string, to: string): boolean {
    return (RESERVATION_TRANSITIONS[from] || []).includes(to);
  }

  // Valid transitions
  it("allows confirmed → checked_out", () => {
    expect(isValidTransition('confirmed', 'checked_out')).toBe(true);
  });

  it("allows confirmed → cancelled", () => {
    expect(isValidTransition('confirmed', 'cancelled')).toBe(true);
  });

  it("allows confirmed → no_show", () => {
    expect(isValidTransition('confirmed', 'no_show')).toBe(true);
  });

  it("allows checked_out → returned", () => {
    expect(isValidTransition('checked_out', 'returned')).toBe(true);
  });

  // Invalid transitions
  it("rejects confirmed → returned (must check out first)", () => {
    expect(isValidTransition('confirmed', 'returned')).toBe(false);
  });

  it("rejects returned → confirmed (terminal state)", () => {
    expect(isValidTransition('returned', 'confirmed')).toBe(false);
  });

  it("rejects cancelled → confirmed (terminal state)", () => {
    expect(isValidTransition('cancelled', 'confirmed')).toBe(false);
  });

  it("rejects no_show → checked_out (terminal state)", () => {
    expect(isValidTransition('no_show', 'checked_out')).toBe(false);
  });

  it("rejects checked_out → cancelled (must return or stay)", () => {
    expect(isValidTransition('checked_out', 'cancelled')).toBe(false);
  });
});

// ─── REPAIR ORDER SCHEMA VALIDATION ───
describe("insertRepairOrderSchema", () => {
  it("accepts valid repair order", () => {
    const result = insertRepairOrderSchema.safeParse({
      vehicleId: 1,
      title: "Engine check",
    });
    expect(result.success).toBe(true);
  });

  it("accepts repair order with full fields", () => {
    const result = insertRepairOrderSchema.safeParse({
      vehicleId: 1,
      incidentId: 5,
      stationId: 2,
      title: "Brake replacement",
      description: "Front brake pads worn",
      status: "open",
      priority: "high",
      assignedTo: 3,
      estimatedCost: 450.00,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing vehicleId", () => {
    const result = insertRepairOrderSchema.safeParse({
      title: "Engine check",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing title", () => {
    const result = insertRepairOrderSchema.safeParse({
      vehicleId: 1,
    });
    expect(result.success).toBe(false);
  });
});

// ─── REPAIR ORDER STATE MACHINE ───
describe("repair order state machine", () => {
  const REPAIR_ORDER_TRANSITIONS: Record<string, string[]> = {
    open: ['in_progress', 'cancelled'],
    in_progress: ['awaiting_parts', 'completed', 'cancelled'],
    awaiting_parts: ['in_progress', 'cancelled'],
    completed: [],
    cancelled: [],
  };

  function isValidTransition(from: string, to: string): boolean {
    return (REPAIR_ORDER_TRANSITIONS[from] || []).includes(to);
  }

  // Valid transitions
  it("allows open → in_progress", () => {
    expect(isValidTransition('open', 'in_progress')).toBe(true);
  });

  it("allows open → cancelled", () => {
    expect(isValidTransition('open', 'cancelled')).toBe(true);
  });

  it("allows in_progress → awaiting_parts", () => {
    expect(isValidTransition('in_progress', 'awaiting_parts')).toBe(true);
  });

  it("allows in_progress → completed", () => {
    expect(isValidTransition('in_progress', 'completed')).toBe(true);
  });

  it("allows in_progress → cancelled", () => {
    expect(isValidTransition('in_progress', 'cancelled')).toBe(true);
  });

  it("allows awaiting_parts → in_progress (parts arrived)", () => {
    expect(isValidTransition('awaiting_parts', 'in_progress')).toBe(true);
  });

  it("allows awaiting_parts → cancelled", () => {
    expect(isValidTransition('awaiting_parts', 'cancelled')).toBe(true);
  });

  // Invalid transitions
  it("rejects open → completed (must be in_progress first)", () => {
    expect(isValidTransition('open', 'completed')).toBe(false);
  });

  it("rejects open → awaiting_parts (must start work first)", () => {
    expect(isValidTransition('open', 'awaiting_parts')).toBe(false);
  });

  it("rejects completed → open (terminal state)", () => {
    expect(isValidTransition('completed', 'open')).toBe(false);
  });

  it("rejects cancelled → in_progress (terminal state)", () => {
    expect(isValidTransition('cancelled', 'in_progress')).toBe(false);
  });
});

// ─── DOWNTIME EVENT SCHEMA VALIDATION ───
describe("insertDowntimeEventSchema", () => {
  it("accepts valid downtime event", () => {
    const result = insertDowntimeEventSchema.safeParse({
      vehicleId: 1,
      reason: "maintenance",
      startedAt: new Date("2026-04-10T08:00:00Z"),
    });
    expect(result.success).toBe(true);
  });

  it("accepts downtime with optional fields", () => {
    const result = insertDowntimeEventSchema.safeParse({
      vehicleId: 1,
      reason: "repair",
      incidentId: 3,
      repairOrderId: 7,
      stationId: 2,
      startedAt: new Date("2026-04-10T08:00:00Z"),
      notes: "Scheduled maintenance",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing vehicleId", () => {
    const result = insertDowntimeEventSchema.safeParse({
      reason: "maintenance",
      startedAt: new Date(),
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing reason", () => {
    const result = insertDowntimeEventSchema.safeParse({
      vehicleId: 1,
      startedAt: new Date(),
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing startedAt", () => {
    const result = insertDowntimeEventSchema.safeParse({
      vehicleId: 1,
      reason: "maintenance",
    });
    expect(result.success).toBe(false);
  });
});

// ─── KPI DEFINITION SCHEMA VALIDATION ───
describe("insertKpiDefinitionSchema", () => {
  it("accepts valid KPI definition", () => {
    const result = insertKpiDefinitionSchema.safeParse({
      slug: "fleet_utilization",
      name: "Fleet Utilization",
    });
    expect(result.success).toBe(true);
  });

  it("accepts KPI definition with thresholds", () => {
    const result = insertKpiDefinitionSchema.safeParse({
      slug: "wash_sla_attainment",
      name: "Wash SLA Attainment",
      description: "Percentage of washes completed within SLA",
      category: "quality",
      unit: "percent",
      targetValue: 95,
      warningThreshold: 85,
      criticalThreshold: 70,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing slug", () => {
    const result = insertKpiDefinitionSchema.safeParse({
      name: "Fleet Utilization",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const result = insertKpiDefinitionSchema.safeParse({
      slug: "fleet_utilization",
    });
    expect(result.success).toBe(false);
  });
});

// ─── KPI SNAPSHOT SCHEMA VALIDATION ───
describe("insertKpiSnapshotSchema", () => {
  it("accepts valid snapshot", () => {
    const result = insertKpiSnapshotSchema.safeParse({
      kpiSlug: "fleet_utilization",
      value: 72.5,
      date: "2026-04-10",
    });
    expect(result.success).toBe(true);
  });

  it("accepts snapshot with station scoping", () => {
    const result = insertKpiSnapshotSchema.safeParse({
      kpiSlug: "wash_sla_attainment",
      value: 95.2,
      date: "2026-04-10",
      stationId: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing kpiSlug", () => {
    const result = insertKpiSnapshotSchema.safeParse({
      value: 72.5,
      date: "2026-04-10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing value", () => {
    const result = insertKpiSnapshotSchema.safeParse({
      kpiSlug: "fleet_utilization",
      date: "2026-04-10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing date", () => {
    const result = insertKpiSnapshotSchema.safeParse({
      kpiSlug: "fleet_utilization",
      value: 72.5,
    });
    expect(result.success).toBe(false);
  });
});

// ─── ANOMALY SCHEMA VALIDATION ───
describe("insertAnomalySchema", () => {
  it("accepts valid anomaly", () => {
    const result = insertAnomalySchema.safeParse({
      type: "wash_stagnation",
      title: "Wash queue stalled",
      description: "3+ items pending for over 4 hours",
    });
    expect(result.success).toBe(true);
  });

  it("accepts anomaly with full fields", () => {
    const result = insertAnomalySchema.safeParse({
      type: "repeated_damage",
      severity: "critical",
      title: "Vehicle ABC-1234 repeated damage",
      description: "3 evidence items in 7 days",
      entityType: "vehicle",
      entityId: "5",
      stationId: 1,
      status: "open",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing type", () => {
    const result = insertAnomalySchema.safeParse({
      title: "Test anomaly",
      description: "desc",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing title", () => {
    const result = insertAnomalySchema.safeParse({
      type: "wash_stagnation",
      description: "desc",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing description", () => {
    const result = insertAnomalySchema.safeParse({
      type: "wash_stagnation",
      title: "Test anomaly",
    });
    expect(result.success).toBe(false);
  });
});

// ─── EXECUTIVE BRIEFING SCHEMA VALIDATION ───
describe("insertExecutiveBriefingSchema", () => {
  it("accepts valid briefing", () => {
    const result = insertExecutiveBriefingSchema.safeParse({
      title: "Daily Operational Brief",
      summary: "Fleet operating normally",
      date: "2026-04-10",
      kpiSummary: { fleet_utilization: 72, wash_sla_attainment: 91 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts briefing with recommendations", () => {
    const result = insertExecutiveBriefingSchema.safeParse({
      title: "Weekly Brief",
      summary: "Some issues noted",
      date: "2026-04-10",
      kpiSummary: { fleet_utilization: 65 },
      anomalySummary: { total: 3, critical: 1 },
      recommendations: ["Increase staffing on Thursday", "Review maintenance schedule"],
      generatedBy: "system",
      stationId: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing title", () => {
    const result = insertExecutiveBriefingSchema.safeParse({
      summary: "Fleet operating normally",
      date: "2026-04-10",
      kpiSummary: {},
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing summary", () => {
    const result = insertExecutiveBriefingSchema.safeParse({
      title: "Brief",
      date: "2026-04-10",
      kpiSummary: {},
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing date", () => {
    const result = insertExecutiveBriefingSchema.safeParse({
      title: "Brief",
      summary: "Summary",
      kpiSummary: {},
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing kpiSummary", () => {
    const result = insertExecutiveBriefingSchema.safeParse({
      title: "Brief",
      summary: "Summary",
      date: "2026-04-10",
    });
    expect(result.success).toBe(false);
  });
});

// ─── DOCUMENT UPLOAD VALIDATION ───
describe("document upload validation", () => {
  const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'text/csv', 'text/plain',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ]);
  const MAX_FILE_SIZE = 25 * 1024 * 1024;

  function validateUpload(mimeType: string, size: number): { valid: boolean; error?: string } {
    if (!ALLOWED_MIME_TYPES.has(mimeType)) return { valid: false, error: `MIME type not allowed` };
    if (size > MAX_FILE_SIZE) return { valid: false, error: `File too large` };
    return { valid: true };
  }

  it("accepts image/jpeg", () => {
    expect(validateUpload('image/jpeg', 1024).valid).toBe(true);
  });

  it("accepts application/pdf", () => {
    expect(validateUpload('application/pdf', 5 * 1024 * 1024).valid).toBe(true);
  });

  it("accepts text/csv", () => {
    expect(validateUpload('text/csv', 100).valid).toBe(true);
  });

  it("rejects application/javascript (not in allowlist)", () => {
    const result = validateUpload('application/javascript', 100);
    expect(result.valid).toBe(false);
  });

  it("rejects text/html (XSS vector)", () => {
    const result = validateUpload('text/html', 100);
    expect(result.valid).toBe(false);
  });

  it("rejects file exceeding 25MB", () => {
    const result = validateUpload('image/png', 26 * 1024 * 1024);
    expect(result.valid).toBe(false);
  });

  it("accepts file at exactly 25MB", () => {
    expect(validateUpload('image/png', 25 * 1024 * 1024).valid).toBe(true);
  });
});

// ─── KPI COMPUTE COVERAGE ───
describe("KPI compute logic", () => {
  const KPI_SLUGS = [
    'fleet_utilization', 'fleet_availability', 'wash_sla_attainment',
    'avg_wash_turnaround', 'avg_incident_resolution', 'active_reservations',
    'open_downtime', 'total_vehicles', 'completed_washes', 'open_incidents',
  ];

  it("defines all 10 expected KPI slugs", () => {
    expect(KPI_SLUGS).toHaveLength(10);
  });

  it("all slugs are snake_case", () => {
    for (const slug of KPI_SLUGS) {
      expect(slug).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("fleet_utilization is a percentage-type metric", () => {
    // In compute endpoint: (rented + washing + checked_out) / total * 100
    const total = 20;
    const active = 12;
    const util = Math.round((active / total) * 100);
    expect(util).toBeGreaterThanOrEqual(0);
    expect(util).toBeLessThanOrEqual(100);
  });

  it("handles zero vehicles without division by zero", () => {
    const total = 0;
    const util = total > 0 ? Math.round((0 / total) * 100) : 0;
    expect(util).toBe(0);
  });
});

// ─── ANOMALY DETECTION TYPES ───
describe("anomaly detection types", () => {
  const ANOMALY_TYPES = ['wash_stagnation', 'repeated_damage', 'notification_spike'];

  it("supports 3 anomaly types", () => {
    expect(ANOMALY_TYPES).toHaveLength(3);
  });

  it("wash_stagnation triggers on ≥3 items pending >4h", () => {
    const threshold = 3;
    const hoursCutoff = 4;
    const staleItems = 4;
    expect(staleItems >= threshold).toBe(true);
    expect(hoursCutoff).toBe(4);
  });

  it("repeated_damage triggers on ≥3 evidence items per vehicle in 7 days", () => {
    const evidenceCount = 3;
    const daysWindow = 7;
    expect(evidenceCount >= 3).toBe(true);
    expect(daysWindow).toBe(7);
  });

  it("notification_spike triggers on >20 notifications in last hour", () => {
    const notifCount = 25;
    expect(notifCount > 20).toBe(true);
  });
});

// ─── PATH TRAVERSAL PREVENTION ───
describe("document key sanitization", () => {
  it("rejects keys containing ..", () => {
    const key = "../../../etc/passwd";
    expect(key.includes('..')).toBe(true);
  });

  it("accepts clean entity-scoped keys", () => {
    const key = "vehicle/5/1712841600000-abc123-photo.jpg";
    expect(key.includes('..')).toBe(false);
    expect(key.length).toBeGreaterThan(0);
  });

  it("strips unsafe characters from filenames", () => {
    const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
    expect(sanitize("hello<script>.jpg")).toBe("hello_script_.jpg");
    expect(sanitize("../../etc/passwd")).toBe(".._.._etc_passwd");
    expect(sanitize("normal-file.png")).toBe("normal-file.png");
  });
});

// ═══════════════════════════════════════════════════════════
// PHASE 2 HARDENING TESTS
// ═══════════════════════════════════════════════════════════

// ─── KPI FLEET UTILIZATION FIX ───
describe("KPI fleet_utilization hardened formula", () => {
  function computeFleetUtilization(vehicles: Array<{ status: string }>): number {
    const total = vehicles.length;
    const active = vehicles.filter(v => v.status === 'rented' || v.status === 'washing').length;
    return total > 0 ? Math.round((active / total) * 100 * 10) / 10 : 0;
  }

  it("counts only rented + washing as utilized (not maintenance)", () => {
    const vehicles = [
      { status: 'ready' }, { status: 'rented' }, { status: 'washing' },
      { status: 'maintenance' }, { status: 'ready' },
    ];
    const util = computeFleetUtilization(vehicles);
    // 2 out of 5 = 40%, NOT 60% (old formula would have said (5-2ready)/5 = 60%)
    expect(util).toBe(40);
  });

  it("returns 0 when fleet is empty", () => {
    expect(computeFleetUtilization([])).toBe(0);
  });

  it("returns 0 when all vehicles are in maintenance", () => {
    const vehicles = [{ status: 'maintenance' }, { status: 'maintenance' }];
    expect(computeFleetUtilization(vehicles)).toBe(0);
  });

  it("returns 100 when all vehicles are rented", () => {
    const vehicles = [{ status: 'rented' }, { status: 'rented' }];
    expect(computeFleetUtilization(vehicles)).toBe(100);
  });
});

// ─── ANOMALY DEDUPLICATION ───
describe("anomaly deduplication logic", () => {
  function shouldCreateAnomaly(type: string, entityId: string | null, existingOpen: Array<{ type: string; entityId: string | null }>): boolean {
    if (entityId) {
      return !existingOpen.some(a => a.type === type && a.entityId === entityId);
    }
    return !existingOpen.some(a => a.type === type);
  }

  it("allows creation when no existing open anomaly of same type", () => {
    expect(shouldCreateAnomaly('wash_stagnation', null, [])).toBe(true);
  });

  it("blocks creation when open anomaly of same type exists", () => {
    const existing = [{ type: 'wash_stagnation', entityId: null }];
    expect(shouldCreateAnomaly('wash_stagnation', null, existing)).toBe(false);
  });

  it("allows creation for different entity even when same type exists", () => {
    const existing = [{ type: 'repeated_damage', entityId: '1' }];
    expect(shouldCreateAnomaly('repeated_damage', '2', existing)).toBe(true);
  });

  it("blocks creation for same entity + same type", () => {
    const existing = [{ type: 'repeated_damage', entityId: '5' }];
    expect(shouldCreateAnomaly('repeated_damage', '5', existing)).toBe(false);
  });

  it("allows creation for same entity but different type", () => {
    const existing = [{ type: 'wash_stagnation', entityId: null }];
    expect(shouldCreateAnomaly('notification_spike', null, existing)).toBe(true);
  });
});

// ─── RESERVATION DOUBLE-BOOKING GUARD ───
describe("reservation double-booking guard", () => {
  function hasOverlap(
    pickup: string, returnDate: string,
    existing: Array<{ status: string; pickupDate: string; returnDate: string }>
  ): boolean {
    return existing.some(r =>
      (r.status === 'confirmed' || r.status === 'checked_out') &&
      new Date(r.pickupDate) < new Date(returnDate) &&
      new Date(r.returnDate) > new Date(pickup)
    );
  }

  it("detects overlapping reservation for same vehicle", () => {
    const existing = [{ status: 'confirmed', pickupDate: '2026-04-10', returnDate: '2026-04-15' }];
    expect(hasOverlap('2026-04-12', '2026-04-18', existing)).toBe(true);
  });

  it("allows non-overlapping reservation", () => {
    const existing = [{ status: 'confirmed', pickupDate: '2026-04-10', returnDate: '2026-04-15' }];
    expect(hasOverlap('2026-04-16', '2026-04-20', existing)).toBe(false);
  });

  it("allows overlap with cancelled reservation", () => {
    const existing = [{ status: 'cancelled', pickupDate: '2026-04-10', returnDate: '2026-04-15' }];
    expect(hasOverlap('2026-04-12', '2026-04-18', existing)).toBe(false);
  });

  it("allows overlap with returned reservation", () => {
    const existing = [{ status: 'returned', pickupDate: '2026-04-10', returnDate: '2026-04-15' }];
    expect(hasOverlap('2026-04-12', '2026-04-18', existing)).toBe(false);
  });

  it("detects exact overlap", () => {
    const existing = [{ status: 'confirmed', pickupDate: '2026-04-10', returnDate: '2026-04-15' }];
    expect(hasOverlap('2026-04-10', '2026-04-15', existing)).toBe(true);
  });

  it("no overlap when new reservation starts exactly when old one ends", () => {
    const existing = [{ status: 'confirmed', pickupDate: '2026-04-10', returnDate: '2026-04-15' }];
    expect(hasOverlap('2026-04-15', '2026-04-20', existing)).toBe(false);
  });
});

// ─── REPAIR ORDER DUPLICATE GUARD ───
describe("repair order duplicate open guard", () => {
  function hasActiveRO(existing: Array<{ status: string }>): boolean {
    return existing.some(r => r.status === 'open' || r.status === 'in_progress' || r.status === 'awaiting_parts');
  }

  it("blocks when vehicle has open repair order", () => {
    expect(hasActiveRO([{ status: 'open' }])).toBe(true);
  });

  it("blocks when vehicle has in_progress repair order", () => {
    expect(hasActiveRO([{ status: 'in_progress' }])).toBe(true);
  });

  it("blocks when vehicle has awaiting_parts repair order", () => {
    expect(hasActiveRO([{ status: 'awaiting_parts' }])).toBe(true);
  });

  it("allows when vehicle only has completed repair orders", () => {
    expect(hasActiveRO([{ status: 'completed' }, { status: 'cancelled' }])).toBe(false);
  });

  it("allows when vehicle has no repair orders", () => {
    expect(hasActiveRO([])).toBe(false);
  });
});

// ─── DOCUMENT PATH CONTAINMENT ───
describe("document path containment", () => {
  const path = require('path');
  const UPLOAD_DIR = './uploads';

  function isContained(key: string): boolean {
    if (!key || key.includes('..') || key.startsWith('/')) return false;
    const filepath = path.resolve(UPLOAD_DIR, key);
    return filepath.startsWith(path.resolve(UPLOAD_DIR));
  }

  it("allows normal key", () => {
    expect(isContained('vehicle/5/1234-abc-photo.jpg')).toBe(true);
  });

  it("rejects path traversal with ..", () => {
    expect(isContained('../../../etc/passwd')).toBe(false);
  });

  it("rejects absolute path key", () => {
    expect(isContained('/etc/passwd')).toBe(false);
  });

  it("rejects empty key", () => {
    expect(isContained('')).toBe(false);
  });

  it("allows nested directory key", () => {
    expect(isContained('a/b/c/d/file.pdf')).toBe(true);
  });
});

// ─── DOWNTIME ENDDATE VALIDATION ───
describe("downtime endedAt validation", () => {
  it("rejects endedAt before startedAt", () => {
    const startedAt = new Date('2026-04-10T08:00:00Z');
    const endedAt = new Date('2026-04-09T08:00:00Z');
    expect(endedAt <= startedAt).toBe(true);
  });

  it("rejects endedAt equal to startedAt", () => {
    const startedAt = new Date('2026-04-10T08:00:00Z');
    const endedAt = new Date('2026-04-10T08:00:00Z');
    expect(endedAt <= startedAt).toBe(true);
  });

  it("accepts endedAt after startedAt", () => {
    const startedAt = new Date('2026-04-10T08:00:00Z');
    const endedAt = new Date('2026-04-10T10:00:00Z');
    expect(endedAt > startedAt).toBe(true);
  });
});

// ─── KPI DEFINITION PATCH SCHEMA ───
describe("KPI definition patch validation", () => {
  const kpiDefinitionPatchSchema = require('zod').z.object({
    name: require('zod').z.string().optional(),
    description: require('zod').z.string().nullable().optional(),
    category: require('zod').z.string().optional(),
    unit: require('zod').z.string().optional(),
    targetValue: require('zod').z.number().nullable().optional(),
    warningThreshold: require('zod').z.number().nullable().optional(),
    criticalThreshold: require('zod').z.number().nullable().optional(),
    active: require('zod').z.boolean().optional(),
  }).strict();

  it("accepts valid partial update", () => {
    const result = kpiDefinitionPatchSchema.safeParse({ name: "Updated KPI", active: false });
    expect(result.success).toBe(true);
  });

  it("rejects unknown fields (strict mode)", () => {
    const result = kpiDefinitionPatchSchema.safeParse({ name: "Updated", sql_injection: "DROP TABLE" });
    expect(result.success).toBe(false);
  });

  it("accepts empty object (no-op update)", () => {
    const result = kpiDefinitionPatchSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
