/**
 * Vehicle event derivation hooks — processes ingested events into system actions (Phase 4.2B).
 *
 * Conservative approach: only derive actions for well-understood event types.
 * Each hook returns whether it took action so the event can be marked processed.
 *
 * Hardened (Phase 4.2B-H):
 * - Cooldown windows prevent repeated notifications for same vehicle+eventType
 * - Duplicate incident prevention for repeated critical engine alerts
 * - Monotonic mileage guard (already existed, confirmed)
 * - Fuel level clamped and validated
 */
import { storage } from "../storage.js";
import { wsManager } from "../websocket.js";
import type { VehicleEvent } from "../../shared/schema.js";
import { logger } from "../observability/logger.js";

// ─── Cooldown tracking (in-memory, resets on restart — intentional best-effort) ───
//
// MULTI-INSTANCE CAVEAT: This map is local to the current Node.js process.
// In a multi-instance deployment (e.g., Railway replicas, PM2 cluster mode):
//   - Each instance maintains its own independent cooldown map
//   - Worst case: duplicate notifications/incidents equal to the number of instances
//   - This is acceptable because:
//     1. Derivation actions are idempotent (notification dedup is UI-level)
//     2. Incident creation is append-only (operators manually close dupes)
//     3. Volume is low (~hundreds of events/minute, not thousands)
//   - Upgrade path: Replace with Redis SET NX + TTL if instance count exceeds 3
//     or if duplicate actions become operationally noisy.
//
// Key: `${vehicleId}:${eventType}:${action}`, Value: timestamp of last action
const cooldownMap = new Map<string, number>();

/** Default cooldown intervals — overridden at runtime via configResolver. */
const DEFAULT_COOLDOWN_MS: Record<string, number> = {
  notification: 5 * 60 * 1000,    // 5 minutes between notifications of same type
  incident: 30 * 60 * 1000,       // 30 minutes between auto-incidents
};

/** Resolved cooldown values — refreshed from config periodically. */
let resolvedCooldowns: Record<string, number> | null = null;
let cooldownsLoadedAt = 0;

async function getCooldownMs(): Promise<Record<string, number>> {
  if (resolvedCooldowns && Date.now() - cooldownsLoadedAt < 30_000) return resolvedCooldowns;
  try {
    const { configResolver } = await import("../config/resolver.js");
    const [notification, incident, defaultCd] = await Promise.all([
      configResolver.getNumber("channels.notification_cooldown_seconds"),
      configResolver.getNumber("channels.incident_cooldown_seconds"),
      configResolver.getNumber("channels.default_cooldown_seconds"),
    ]);
    resolvedCooldowns = {
      notification: notification * 1000,
      incident: incident * 1000,
      default: defaultCd * 1000,
    };
    cooldownsLoadedAt = Date.now();
  } catch {
    resolvedCooldowns = DEFAULT_COOLDOWN_MS;
  }
  return resolvedCooldowns;
}

function cooldownKey(vehicleId: number, eventType: string, action: string): string {
  return `${vehicleId}:${eventType}:${action}`;
}

/** Returns true if action is within cooldown window. Updates timestamp if not. */
async function isCoolingDown(vehicleId: number, eventType: string, action: string): Promise<boolean> {
  const key = cooldownKey(vehicleId, eventType, action);
  const last = cooldownMap.get(key);
  const now = Date.now();
  const cooldowns = await getCooldownMs();
  const window = cooldowns[action] ?? cooldowns.default ?? 60_000;
  if (last && now - last < window) return true;
  cooldownMap.set(key, now);
  return false;
}

/** Exported for testing: reset all cooldowns. */
export function _resetCooldowns(): void {
  cooldownMap.clear();
}

/** Process a single vehicle event through all applicable derivation hooks. */
export async function processVehicleEvent(event: VehicleEvent): Promise<void> {
  try {
    const result = await deriveAction(event);
    if (result) {
      await storage.markVehicleEventProcessed(event.id, result);
    }
  } catch (err) {
    logger.error("Vehicle event derivation failed", err instanceof Error ? err : new Error(String(err)), { eventId: event.id });
  }
}

/** Route event to the appropriate hook. Returns derivation info or null if no action taken. */
async function deriveAction(event: VehicleEvent): Promise<{
  derivedAction: string;
  derivedEntityType?: string;
  derivedEntityId?: string;
} | null> {
  switch (event.eventType) {
    case "odometer_update":
      return handleOdometerUpdate(event);
    case "fuel_update":
      return handleFuelUpdate(event);
    case "maintenance_alert":
      return handleMaintenanceAlert(event);
    case "engine_alert":
      return handleEngineAlert(event);
    case "battery_update":
      return handleBatteryUpdate(event);
    default:
      // Mark as processed with no derived action (just stored)
      await storage.markVehicleEventProcessed(event.id, { derivedAction: "stored" });
      return null;
  }
}

// ─── Odometer update → update vehicle.mileage ───
async function handleOdometerUpdate(event: VehicleEvent): Promise<{
  derivedAction: string;
  derivedEntityType: string;
  derivedEntityId: string;
} | null> {
  const payload = event.payload as Record<string, unknown> | null;
  const mileage = payload?.mileage ?? payload?.odometer ?? payload?.value;
  if (typeof mileage !== "number" || mileage <= 0) return null;

  const vehicle = await storage.getVehicle(event.vehicleId);
  if (!vehicle) return null;

  // Only update if the new reading is higher
  if (vehicle.mileage !== null && mileage <= vehicle.mileage) return null;

  await storage.updateVehicle(event.vehicleId, { mileage: Math.round(mileage) });
  return {
    derivedAction: "vehicle_mileage_updated",
    derivedEntityType: "vehicle",
    derivedEntityId: String(event.vehicleId),
  };
}

// ─── Fuel update → update vehicle.fuelLevel ───
async function handleFuelUpdate(event: VehicleEvent): Promise<{
  derivedAction: string;
  derivedEntityType: string;
  derivedEntityId: string;
} | null> {
  const payload = event.payload as Record<string, unknown> | null;
  const fuelLevel = payload?.fuelLevel ?? payload?.fuel ?? payload?.value;
  if (typeof fuelLevel !== "number" || fuelLevel < 0 || fuelLevel > 100) return null;

  await storage.updateVehicle(event.vehicleId, { fuelLevel: Math.round(fuelLevel) });
  return {
    derivedAction: "vehicle_fuel_updated",
    derivedEntityType: "vehicle",
    derivedEntityId: String(event.vehicleId),
  };
}

// ─── Maintenance alert → notification (with cooldown) ───
async function handleMaintenanceAlert(event: VehicleEvent): Promise<{
  derivedAction: string;
  derivedEntityType: string;
  derivedEntityId: string;
} | null> {
  // Cooldown: suppress repeated maintenance alerts for same vehicle
  if (await isCoolingDown(event.vehicleId, event.eventType, "notification")) {
    return { derivedAction: "notification_suppressed", derivedEntityType: "vehicle", derivedEntityId: String(event.vehicleId) };
  }

  const payload = event.payload as Record<string, unknown> | null;
  const description = payload?.message ?? payload?.description ?? "Maintenance alert received";

  const notification = await storage.createNotification({
    type: "maintenance_alert",
    severity: event.severity === "critical" ? "critical" : "warning",
    title: `Maintenance alert — Vehicle #${event.vehicleId}`,
    body: String(description),
    audience: "role",
    recipientRole: "admin",
    sourceEntityType: "vehicle",
    sourceEntityId: String(event.vehicleId),
  });

  wsManager.broadcast({
    type: "notification:created",
    data: notification,
    channel: "notifications",
  });

  return {
    derivedAction: "notification_created",
    derivedEntityType: "notification",
    derivedEntityId: String(notification.id),
  };
}

// ─── Engine alert → notification (critical → also suggest incident, with cooldown) ───
async function handleEngineAlert(event: VehicleEvent): Promise<{
  derivedAction: string;
  derivedEntityType: string;
  derivedEntityId: string;
} | null> {
  const payload = event.payload as Record<string, unknown> | null;
  const description = payload?.message ?? payload?.description ?? payload?.code ?? "Engine alert";

  // Cooldown for notifications
  if (await isCoolingDown(event.vehicleId, event.eventType, "notification")) {
    return { derivedAction: "notification_suppressed", derivedEntityType: "vehicle", derivedEntityId: String(event.vehicleId) };
  }

  const notification = await storage.createNotification({
    type: "engine_alert",
    severity: event.severity === "critical" ? "critical" : "warning",
    title: `Engine alert — Vehicle #${event.vehicleId}`,
    body: String(description),
    audience: "role",
    recipientRole: "admin",
    sourceEntityType: "vehicle",
    sourceEntityId: String(event.vehicleId),
  });

  wsManager.broadcast({
    type: "notification:created",
    data: notification,
    channel: "notifications",
  });

  // For critical engine alerts, auto-create an incident (with cooldown to prevent dupes)
  if (event.severity === "critical") {
    if (await isCoolingDown(event.vehicleId, event.eventType, "incident")) {
      // Already created a recent incident for this vehicle — skip
      return {
        derivedAction: "incident_suppressed",
        derivedEntityType: "notification",
        derivedEntityId: String(notification.id),
      };
    }

    const incident = await storage.createIncident({
      title: `Critical engine alert — Vehicle #${event.vehicleId}`,
      description: `Automated incident from telematics: ${String(description)}`,
      severity: "high",
      status: "open",
      category: "equipment_failure",
      vehicleId: event.vehicleId,
      reportedBy: 0,
    });

    wsManager.broadcast({
      type: "incident:created",
      data: incident,
      channel: "incidents",
    });

    return {
      derivedAction: "incident_created",
      derivedEntityType: "incident",
      derivedEntityId: String(incident.id),
    };
  }

  return {
    derivedAction: "notification_created",
    derivedEntityType: "notification",
    derivedEntityId: String(notification.id),
  };
}

// ─── Battery update → notification if low ───
async function handleBatteryUpdate(event: VehicleEvent): Promise<{
  derivedAction: string;
  derivedEntityType?: string;
  derivedEntityId?: string;
} | null> {
  const payload = event.payload as Record<string, unknown> | null;
  const level = payload?.batteryLevel ?? payload?.battery ?? payload?.voltage ?? payload?.value;

  // Only act on low battery (percentage-based)
  if (typeof level !== "number") return null;
  if (level > 20) {
    return { derivedAction: "stored" };
  }

  // Cooldown: suppress repeated low-battery notifications for same vehicle
  if (await isCoolingDown(event.vehicleId, event.eventType, "notification")) {
    return { derivedAction: "notification_suppressed", derivedEntityType: "vehicle", derivedEntityId: String(event.vehicleId) };
  }

  const notification = await storage.createNotification({
    type: "battery_alert",
    severity: level <= 5 ? "critical" : "warning",
    title: `Low battery — Vehicle #${event.vehicleId}`,
    body: `Battery level at ${level}%`,
    audience: "role",
    recipientRole: "admin",
    sourceEntityType: "vehicle",
    sourceEntityId: String(event.vehicleId),
  });

  wsManager.broadcast({
    type: "notification:created",
    data: notification,
    channel: "notifications",
  });

  return {
    derivedAction: "notification_created",
    derivedEntityType: "notification",
    derivedEntityId: String(notification.id),
  };
}
