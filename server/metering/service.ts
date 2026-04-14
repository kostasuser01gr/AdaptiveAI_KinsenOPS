/**
 * Usage metering service — high-level helpers for recording metered events
 * and enforcing usage ceilings (Phase 4.2A).
 *
 * All metering is fire-and-forget: it never blocks the primary action.
 * Ceilings, when configured, are checked before the action begins.
 */

import type { InsertUsageEvent } from "../../shared/schema.js";

// ── Metered action registry ─────────────────────────────────────────────────

export interface MeteredAction {
  feature: string;
  action: string;
  /** Optional monthly ceiling. undefined = unlimited. */
  ceiling?: number;
}

/**
 * Every metered action in the platform.
 * `feature` must match a FeatureKey from the entitlements catalog.
 */
export const METERED_ACTIONS: Record<string, MeteredAction> = {
  export_created:             { feature: "exports",               action: "export_created" },
  advanced_export_approved:   { feature: "advanced_exports",      action: "advanced_export_approved" },
  automation_executed:        { feature: "automation_execution",   action: "automation_executed" },
  ai_draft_created:           { feature: "ai_automation_drafting", action: "ai_draft_created" },
  briefing_generated:         { feature: "executive_briefings",   action: "briefing_generated" },
  anomaly_detection_run:      { feature: "anomaly_detection",     action: "anomaly_detection_run" },
  kpi_snapshot_created:       { feature: "kpi_snapshots",         action: "kpi_snapshot_created" },
  connector_sync_triggered:   { feature: "connector_sync",        action: "connector_sync_triggered" },
  document_ingested:          { feature: "knowledge_ingestion",   action: "document_ingested" },
  trust_export_previewed:     { feature: "trust_export_preview",  action: "trust_export_previewed" },
  staffing_recommendation:    { feature: "staffing_recommendations", action: "staffing_recommendation" },
};

// ── Metering helper ─────────────────────────────────────────────────────────

/**
 * Record a metered usage event and update the daily rollup.
 * This is fire-and-forget — errors are logged but never thrown to the caller.
 */
export async function recordUsage(opts: {
  action: string;
  userId?: number;
  entityType?: string;
  entityId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  workspaceId?: string;
}): Promise<void> {
  try {
    const def = METERED_ACTIONS[opts.action];
    if (!def) return; // Unknown action — nothing to meter

    const { storage } = await import("../storage.js");
    const workspaceId = opts.workspaceId ?? "default";
    const today = new Date().toISOString().slice(0, 10);

    const eventData: InsertUsageEvent = {
      workspaceId,
      feature: def.feature,
      userId: opts.userId,
      action: def.action,
      entityType: opts.entityType,
      entityId: opts.entityId,
      idempotencyKey: opts.idempotencyKey ?? undefined,
      metadata: opts.metadata,
    };

    await storage.recordUsageEvent(eventData);
    await storage.incrementDailyRollup(workspaceId, def.feature, today);
  } catch (err) {
    // Never let metering failures break the primary action
    console.error("[metering] Failed to record usage event:", err);
  }
}

/**
 * Check if a usage ceiling has been reached for this billing period.
 * Returns true if under the ceiling (or no ceiling configured).
 * Returns false if usage would exceed the ceiling.
 */
export async function checkUsageCeiling(
  action: string,
  workspaceId = "default",
): Promise<{ allowed: boolean; current: number; ceiling: number | undefined }> {
  const def = METERED_ACTIONS[action];
  if (!def || def.ceiling === undefined) {
    return { allowed: true, current: 0, ceiling: undefined };
  }

  try {
    const { storage } = await import("../storage.js");
    // Current month window
    const now = new Date();
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const current = await storage.getUsageTotal(workspaceId, def.feature, from);
    return { allowed: current < def.ceiling, current, ceiling: def.ceiling };
  } catch (err) {
    console.error("[metering] Failed to check usage ceiling:", err);
    // Fail closed — deny usage when metering is unreachable to prevent limit bypass
    return { allowed: false, current: 0, ceiling: def.ceiling };
  }
}
