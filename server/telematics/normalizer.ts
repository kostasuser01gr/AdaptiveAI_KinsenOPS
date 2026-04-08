/**
 * Telematics event normalizer — maps raw provider payloads to canonical VehicleEvent shape (Phase 4.2B).
 *
 * Each provider adapter converts a raw JSON payload into one or more InsertVehicleEvent records.
 * The normalizer picks the right adapter based on `source` and handles common validation.
 */
import type { InsertVehicleEvent } from "../../shared/schema.js";

// ─── Canonical event types ───
export const VEHICLE_EVENT_TYPES = [
  "location_ping",
  "odometer_update",
  "fuel_update",
  "battery_update",
  "engine_alert",
  "maintenance_alert",
  "geofence_entry",
  "geofence_exit",
  "ignition_on",
  "ignition_off",
  "trip_started",
  "trip_ended",
  "dtc_code",
  "tire_pressure",
  "coolant_temp",
  "custom",
] as const;

export type VehicleEventType = (typeof VEHICLE_EVENT_TYPES)[number];

export const EVENT_SEVERITY = ["info", "warning", "critical"] as const;
export type EventSeverity = (typeof EVENT_SEVERITY)[number];

// ─── Normalized event input (pre-storage) ───
export interface RawTelematicsPayload {
  /** Provider-assigned event ID (used for dedup). */
  externalEventId?: string;
  /** Canonical event type, or raw string mapped later. */
  eventType: string;
  /** When the event happened at the vehicle/device. */
  occurredAt: string | Date;
  /** Target vehicle ID in our system. */
  vehicleId: number;
  /** Severity hint from provider (maps to info/warning/critical). */
  severity?: string;
  /** Arbitrary payload from the provider. */
  data?: Record<string, unknown>;
}

// ─── Normalization ───

/** Map a raw severity string to our canonical set. */
export function normalizeSeverity(raw?: string): EventSeverity {
  if (!raw) return "info";
  const lower = raw.toLowerCase();
  if (lower === "critical" || lower === "error" || lower === "high") return "critical";
  if (lower === "warning" || lower === "warn" || lower === "medium") return "warning";
  return "info";
}

/** Map a raw event type string to the closest canonical type. */
export function normalizeEventType(raw: string): VehicleEventType {
  const lower = raw.toLowerCase().replace(/[\s-]/g, "_");
  // Direct match
  if ((VEHICLE_EVENT_TYPES as readonly string[]).includes(lower)) {
    return lower as VehicleEventType;
  }
  // Common aliases
  const ALIASES: Record<string, VehicleEventType> = {
    gps: "location_ping",
    location: "location_ping",
    position: "location_ping",
    odometer: "odometer_update",
    mileage: "odometer_update",
    fuel: "fuel_update",
    fuel_level: "fuel_update",
    battery: "battery_update",
    battery_level: "battery_update",
    engine: "engine_alert",
    check_engine: "engine_alert",
    maintenance: "maintenance_alert",
    service_due: "maintenance_alert",
    geofence_in: "geofence_entry",
    geofence_out: "geofence_exit",
    ignition_start: "ignition_on",
    ignition_stop: "ignition_off",
    trip_start: "trip_started",
    trip_end: "trip_ended",
    trip_complete: "trip_ended",
    dtc: "dtc_code",
    diagnostic: "dtc_code",
    tire: "tire_pressure",
    coolant: "coolant_temp",
  };
  return ALIASES[lower] ?? "custom";
}

/**
 * Map a raw telematics payload into a canonical InsertVehicleEvent.
 * Validates required fields and normalizes types/severity.
 */
export function normalizeEvent(
  raw: RawTelematicsPayload,
  source: string,
  connectorId?: number,
): InsertVehicleEvent {
  const occurredAt =
    raw.occurredAt instanceof Date ? raw.occurredAt : new Date(raw.occurredAt);

  if (isNaN(occurredAt.getTime())) {
    throw new Error(`Invalid occurredAt date: ${raw.occurredAt}`);
  }
  if (!raw.vehicleId || typeof raw.vehicleId !== "number" || raw.vehicleId <= 0) {
    throw new Error("vehicleId is required and must be a positive number");
  }

  return {
    vehicleId: raw.vehicleId,
    connectorId: connectorId ?? null,
    source,
    externalEventId: raw.externalEventId ?? null,
    eventType: normalizeEventType(raw.eventType),
    severity: normalizeSeverity(raw.severity),
    occurredAt,
    payload: raw.data ?? null,
  };
}

/**
 * Normalize a batch of raw payloads, returning { valid, errors }.
 * Errors include the index + message so callers can report partial failures.
 */
export function normalizeBatch(
  raws: RawTelematicsPayload[],
  source: string,
  connectorId?: number,
): { valid: InsertVehicleEvent[]; errors: { index: number; message: string }[] } {
  const valid: InsertVehicleEvent[] = [];
  const errors: { index: number; message: string }[] = [];

  for (let i = 0; i < raws.length; i++) {
    try {
      valid.push(normalizeEvent(raws[i], source, connectorId));
    } catch (err: any) {
      errors.push({ index: i, message: err.message ?? String(err) });
    }
  }

  return { valid, errors };
}

// ─── Workshop status mapping ───

/** Maps external workshop status strings to our normalized set. */
export const WORKSHOP_STATUS_MAP: Record<string, string> = {
  // Common external statuses → normalized
  estimate: "estimate_received",
  quoted: "estimate_received",
  estimate_received: "estimate_received",
  approved: "approved",
  accepted: "approved",
  authorized: "approved",
  parts_ordered: "parts_ordered",
  waiting_parts: "parts_ordered",
  awaiting_parts: "parts_ordered",
  in_progress: "in_repair",
  in_repair: "in_repair",
  repairing: "in_repair",
  working: "in_repair",
  qa: "qa_ready",
  quality_check: "qa_ready",
  qa_ready: "qa_ready",
  inspection: "qa_ready",
  done: "completed",
  completed: "completed",
  finished: "completed",
  closed: "completed",
  cancelled: "cancelled",
  canceled: "cancelled",
  rejected: "cancelled",
};

export type WorkshopNormalizedStatus =
  | "pending"
  | "estimate_received"
  | "approved"
  | "parts_ordered"
  | "in_repair"
  | "qa_ready"
  | "completed"
  | "cancelled";

/** Normalize a raw workshop status string. Falls back to "pending". */
export function normalizeWorkshopStatus(raw?: string): WorkshopNormalizedStatus {
  if (!raw) return "pending";
  const key = raw.toLowerCase().replace(/[\s-]/g, "_");
  return (WORKSHOP_STATUS_MAP[key] ?? "pending") as WorkshopNormalizedStatus;
}

/**
 * Workshop status progression order (higher index = further in lifecycle).
 * Used to enforce non-regressive status transitions.
 * `cancelled` is a terminal state and can be entered from any non-terminal state.
 */
export const WORKSHOP_STATUS_ORDER: WorkshopNormalizedStatus[] = [
  "pending",
  "estimate_received",
  "approved",
  "parts_ordered",
  "in_repair",
  "qa_ready",
  "completed",
];

/**
 * Returns true if transitioning from `current` to `next` is valid (non-regressive).
 * Rules:
 * - Cannot leave terminal states (completed, cancelled)
 * - Can always move to cancelled from non-terminal
 * - Forward-only otherwise (index must increase)
 */
export function isValidWorkshopTransition(current: string, next: string): boolean {
  // Terminal states cannot transition
  if (current === "completed" || current === "cancelled") return false;
  // Can always cancel from non-terminal
  if (next === "cancelled") return true;
  // Forward-only
  const currentIdx = WORKSHOP_STATUS_ORDER.indexOf(current as WorkshopNormalizedStatus);
  const nextIdx = WORKSHOP_STATUS_ORDER.indexOf(next as WorkshopNormalizedStatus);
  if (currentIdx === -1 || nextIdx === -1) return true; // unknown statuses: allow
  return nextIdx > currentIdx;
}

/**
 * Maps workshop job normalized status → repair order status.
 * Used when syncing workshop progress back to repair orders.
 */
export const WORKSHOP_TO_REPAIR_ORDER_STATUS: Record<string, string> = {
  pending: "open",
  estimate_received: "open",
  approved: "open",
  parts_ordered: "awaiting_parts",
  in_repair: "in_progress",
  qa_ready: "in_progress",
  completed: "completed",
  cancelled: "cancelled",
};

// ─── Ingestion validation helpers ───

export const MAX_EVENT_PAYLOAD_BYTES = 65_536; // 64 KB per event payload
export const MIN_TIMESTAMP = new Date("2020-01-01T00:00:00Z");

/** Validate event payload size. Returns error message or null if OK. */
export function validatePayloadSize(data: unknown): string | null {
  if (!data) return null;
  const size = JSON.stringify(data).length;
  if (size > MAX_EVENT_PAYLOAD_BYTES) {
    return `Event payload too large (${size} bytes, max ${MAX_EVENT_PAYLOAD_BYTES})`;
  }
  return null;
}

/** Validate timestamp is sane: not before 2020-01-01, not more than 1h in the future. */
export function validateTimestamp(ts: string | Date): string | null {
  const d = ts instanceof Date ? ts : new Date(ts);
  if (isNaN(d.getTime())) return `Invalid timestamp: ${ts}`;
  const MAX_DATE = new Date(Date.now() + 60 * 60 * 1000); // 1h in the future
  if (d < MIN_TIMESTAMP) return `Timestamp too old: ${d.toISOString()} (before 2020)`;
  if (d > MAX_DATE) return `Timestamp in the future: ${d.toISOString()}`;
  return null;
}
