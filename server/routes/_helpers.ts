/**
 * Shared constants, schemas, and utility functions used across route modules.
 * Extracted from the monolithic routes.ts during Phase 4.0 route split.
 */
import type { Express, Request, Response, NextFunction } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";
import { storage } from "../storage.js";
import { wsManager } from "../websocket.js";
import { metricsCollector } from "../observability/metrics.js";

// ─── CONSTANTS ───
export const SHIFT_MANAGERS = ["admin", "coordinator", "supervisor"];

export const ALLOWED_CONTEXT_KEYS = [
  'stationId', 'vehiclePlate', 'shiftId', 'washId',
  'screen', 'role', 'entityType', 'entityId',
];

export const AI_MAX_MESSAGES = 20;
export const AI_MAX_MESSAGE_CHARS = 4000;
export const AI_MAX_TOTAL_CHARS = 40000;

// ─── ANTHROPIC CLIENT (lazy singleton) ───
let _anthropic: Anthropic | null = null;
export function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic();
  }
  return _anthropic;
}

// ─── PATCH WHITELIST SCHEMAS ───
export const vehiclePatchSchema = z.object({
  plate: z.string().optional(),
  model: z.string().optional(),
  category: z.string().optional(),
  stationId: z.number().nullable().optional(),
  status: z.string().optional(),
  sla: z.string().optional(),
  mileage: z.number().nullable().optional(),
  fuelLevel: z.number().nullable().optional(),
  nextBooking: z.string().nullable().optional(),
  timerInfo: z.string().nullable().optional(),
}).strict();

export const washQueuePatchSchema = z.object({
  status: z.string().optional(),
  washType: z.string().optional(),
  priority: z.string().optional(),
  assignedTo: z.string().nullable().optional(),
  bay: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  stationId: z.number().nullable().optional(),
  slaDeadline: z.string().nullable().optional(),
  slaInfo: z.string().nullable().optional(),
}).strict();

export const shiftPatchSchema = z.object({
  userId: z.number().optional(),
  weekStart: z.string().optional(),
  schedule: z.array(z.string()).optional(),
  role: z.string().optional(),
  stationId: z.number().nullable().optional(),
  published: z.boolean().optional(),
}).strict();

export const conversationPatchSchema = z.object({
  title: z.string().optional(),
}).strict();

export const stationPatchSchema = z.object({
  name: z.string().optional(),
  code: z.string().optional(),
  address: z.string().nullable().optional(),
  timezone: z.string().optional(),
  config: z.record(z.string(), z.unknown()).nullable().optional(),
}).strict();

export const automationRulePatchSchema = z.object({
  name: z.string().optional(),
  trigger: z.string().optional(),
  conditions: z.record(z.string(), z.unknown()).nullable().optional(),
  actions: z.array(z.record(z.string(), z.unknown())).optional(),
  active: z.boolean().optional(),
  scope: z.string().optional(),
}).strict();

export const entityRoomPatchSchema = z.object({
  title: z.string().optional(),
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "normal", "high", "critical"]).optional(),
  assignedTo: z.number().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
}).strict();

export const workspaceMemoryPatchSchema = z.object({
  value: z.string().optional(),
  confidence: z.number().optional(),
  source: z.string().optional(),
}).strict();

export const systemPolicyPatchSchema = z.object({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  category: z.string().optional(),
  rule: z.record(z.string(), z.unknown()).optional(),
  enforcement: z.string().optional(),
  active: z.boolean().optional(),
}).strict();

export const moduleRegistryPatchSchema = z.object({
  label: z.string().optional(),
  enabled: z.boolean().optional(),
  tier: z.string().optional(),
  config: z.record(z.string(), z.unknown()).nullable().optional(),
}).strict();

export const userPatchSchema = z.object({
  displayName: z.string().optional(),
  role: z.string().optional(),
  station: z.string().nullable().optional(),
  language: z.string().optional(),
  theme: z.string().optional(),
  password: z.string().min(8).optional(),
}).strict();

export const shiftRequestReviewSchema = z.object({
  status: z.enum(["approved", "denied"]),
  note: z.string().nullable().optional(),
}).strict();

export const roomMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  type: z.enum(["message", "system", "ai"]).optional(),
}).strict();

export const activityFeedSchema = z.object({
  action: z.string().min(1).max(100),
  entityType: z.string().min(1).max(50),
  entityId: z.string().min(1).max(100).optional(),
  entityLabel: z.string().max(200).optional(),
  stationId: z.number().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
}).strict();

export const digitalTwinSchema = z.object({
  stationId: z.number().nullable().optional(),
  data: z.record(z.string(), z.unknown()),
  snapshotType: z.string().optional(),
}).strict();

// ─── STATE MACHINE TRANSITIONS ───
export const INCIDENT_TRANSITIONS: Record<string, string[]> = {
  open: ['investigating'],
  investigating: ['mitigating', 'resolved'],
  mitigating: ['resolved'],
  resolved: ['closed', 'investigating'],
  closed: [],
};

export const RESERVATION_TRANSITIONS: Record<string, string[]> = {
  confirmed: ['checked_out', 'cancelled', 'no_show'],
  checked_out: ['returned'],
  returned: [],
  cancelled: [],
  no_show: [],
};

export const REPAIR_ORDER_TRANSITIONS: Record<string, string[]> = {
  open: ['in_progress', 'cancelled'],
  in_progress: ['awaiting_parts', 'completed', 'cancelled'],
  awaiting_parts: ['in_progress', 'cancelled'],
  completed: [],
  cancelled: [],
};

// ─── PUBLIC ROOM TYPES ───
export const PUBLIC_ROOM_ENTITY_TYPES = ['reservation', 'washer-ops'] as const;

export function isPublicRoomType(entityType: string): boolean {
  return (PUBLIC_ROOM_ENTITY_TYPES as readonly string[]).includes(entityType);
}

// ─── CONNECTOR SECRET REDACTION ───
export const CONNECTOR_SECRET_KEYS = ['apiKey', 'apiSecret', 'webhookToken', 'password', 'secret', 'token', 'credentials'];

export function redactConnectorConfig(config: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    if (CONNECTOR_SECRET_KEYS.some(s => k.toLowerCase().includes(s.toLowerCase()))) {
      redacted[k] = typeof v === 'string' && v.length > 0 ? '***REDACTED***' : v;
    } else {
      redacted[k] = v;
    }
  }
  return redacted;
}

// ─── STATION SCOPE ───
export function getStationScope(user: Express.User): number | null | 'none' {
  if (user.role === 'admin' || user.role === 'supervisor') return null;
  if (!user.station) return 'none';
  return parseInt(user.station, 10);
}

// ─── AUTOMATION RULE EXECUTION ENGINE ───
export async function executeAutomationRule(
  rule: Awaited<ReturnType<typeof storage.getAutomationRule>>,
  context: Record<string, unknown> = {}
) {
  if (!rule) return { success: false, error: 'Rule not found' };

  const startTime = Date.now();
  const results: Array<{ action: string; success: boolean; details?: string }> = [];

  try {
    const actions = (rule.actions ?? []) as Array<Record<string, unknown>>;

    for (const action of actions) {
      const actionType = action.type as string;
      try {
        switch (actionType) {
          case 'send_notification': {
            const notif = await storage.createNotification({
              type: 'automation',
              severity: (action.severity as string) || 'info',
              title: (action.title as string) || `[Auto] ${rule.name}`,
              body: (action.body as string) || `Triggered by rule: ${rule.name}`,
              audience: (action.audience as string) || 'broadcast',
              recipientRole: (action.recipientRole as string) || null,
              sourceEntityType: 'automation_rule',
              sourceEntityId: String(rule.id),
            });
            wsManager.broadcast({ type: 'notification:created', data: notif, channel: 'notifications' });
            results.push({ action: actionType, success: true, details: `Notification #${notif.id}` });
            break;
          }
          case 'update_vehicle_status': {
            const vehicleId = action.vehicleId as number | undefined;
            const newStatus = action.status as string | undefined;
            if (vehicleId && newStatus) {
              const v = await storage.updateVehicle(vehicleId, { status: newStatus });
              if (v) wsManager.broadcast({ type: 'vehicle:updated', data: v, channel: 'vehicles' });
              results.push({ action: actionType, success: !!v, details: v ? `Vehicle #${v.id} → ${newStatus}` : 'Vehicle not found' });
            } else {
              results.push({ action: actionType, success: false, details: 'Missing vehicleId or status' });
            }
            break;
          }
          case 'create_room': {
            const room = await storage.createEntityRoom({
              entityType: 'automation',
              entityId: String(rule.id),
              title: (action.title as string) || `[Auto] ${rule.name}`,
              status: 'open',
              priority: (action.priority as string) || 'normal',
              metadata: { ruleId: rule.id, trigger: rule.trigger },
            });
            results.push({ action: actionType, success: true, details: `Room #${room.id}` });
            break;
          }
          case 'create_incident': {
            const incident = await storage.createIncident({
              title: (action.title as string) || `[Auto] ${rule.name}`,
              severity: (action.severity as string) || 'medium',
              category: (action.category as string) || 'automation',
              status: 'open',
              reportedBy: rule.createdBy,
              metadata: { ruleId: rule.id, automated: true },
            });
            results.push({ action: actionType, success: true, details: `Incident #${incident.id}` });
            break;
          }
          case 'log_event': {
            await storage.createActivityEntry({
              userId: rule.createdBy,
              actorName: 'Automation',
              action: (action.eventAction as string) || rule.name,
              entityType: 'automation_rule',
              entityId: String(rule.id),
              entityLabel: rule.name,
            });
            results.push({ action: actionType, success: true });
            break;
          }
          default:
            results.push({ action: actionType, success: false, details: `Unknown action type: ${actionType}` });
        }
      } catch (err) {
        results.push({ action: actionType, success: false, details: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    const durationMs = Date.now() - startTime;
    const success = results.every(r => r.success);

    // Record execution
    await storage.createAutomationExecution({
      ruleId: rule.id,
      triggerEvent: rule.trigger,
      status: success ? 'success' : 'partial_failure',
      triggerEntityType: (context.entityType as string) || null,
      triggerEntityId: (context.entityId as string) || null,
      result: { results },
      durationMs,
    });

    return { success, results, durationMs };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    await storage.createAutomationExecution({
      ruleId: rule.id,
      triggerEvent: rule.trigger,
      status: 'failure',
      triggerEntityType: (context.entityType as string) || null,
      triggerEntityId: (context.entityId as string) || null,
      error: err instanceof Error ? err.message : 'Unknown error',
      result: { error: true },
      durationMs,
    });
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error', durationMs };
  }
}

export async function evaluateAutomationRules(
  trigger: string,
  context: Record<string, unknown> = {}
) {
  try {
    const allRules = await storage.getAutomationRules();
    const matchingRules = allRules.filter(r => r.active && r.trigger === trigger);
    for (const rule of matchingRules) {
      executeAutomationRule(rule, context).catch(() => {});
    }
  } catch {
    // Fire-and-forget — do not crash the caller
  }
}
