/**
 * Entitlement engine — catalog, plan defaults, resolution, and middleware (Phase 4.1B).
 *
 * Design:
 *   effective(feature) = override ?? plan_default
 *   Plan defaults define what a tier includes.
 *   Overrides can elevate (enable on lower plan) or suppress (disable on higher plan).
 *   Single-workspace today (workspaceId = "default"), multi-tenant ready.
 */

import type { Request, Response, NextFunction } from "express";
import type { EntitlementOverride, WorkspacePlan } from "../../shared/schema.js";

// ─── FEATURE CATALOG ────────────────────────────────────────────────────────

export const FEATURES = [
  "exports",
  "advanced_exports",
  "automation_execution",
  "ai_automation_drafting",
  "executive_briefings",
  "anomaly_detection",
  "kpi_snapshots",
  "connector_sync",
  "knowledge_ingestion",
  "trust_export_preview",
  "document_storage",
  "staffing_recommendations",
] as const;

export type FeatureKey = (typeof FEATURES)[number];

/** Validate that a string is a known feature key. */
export function isValidFeature(key: string): key is FeatureKey {
  return (FEATURES as readonly string[]).includes(key);
}

// ─── PLAN TIERS ─────────────────────────────────────────────────────────────

export const PLANS = ["core", "ops_plus", "intelligence", "enterprise"] as const;
export type PlanTier = (typeof PLANS)[number];

export function isValidPlan(plan: string): plan is PlanTier {
  return (PLANS as readonly string[]).includes(plan);
}

/** Human-readable plan labels. */
export const PLAN_LABELS: Record<PlanTier, string> = {
  core: "Core",
  ops_plus: "Ops+",
  intelligence: "Intelligence",
  enterprise: "Enterprise",
};

// ─── PLAN DEFAULTS ──────────────────────────────────────────────────────────

const PLAN_DEFAULTS: Record<PlanTier, ReadonlySet<FeatureKey>> = {
  core: new Set<FeatureKey>([
    "document_storage",
  ]),

  ops_plus: new Set<FeatureKey>([
    "document_storage",
    "exports",
    "automation_execution",
    "knowledge_ingestion",
  ]),

  intelligence: new Set<FeatureKey>([
    "document_storage",
    "exports",
    "advanced_exports",
    "automation_execution",
    "ai_automation_drafting",
    "knowledge_ingestion",
    "anomaly_detection",
    "kpi_snapshots",
    "executive_briefings",
    "staffing_recommendations",
  ]),

  enterprise: new Set<FeatureKey>([
    "document_storage",
    "exports",
    "advanced_exports",
    "automation_execution",
    "ai_automation_drafting",
    "knowledge_ingestion",
    "anomaly_detection",
    "kpi_snapshots",
    "executive_briefings",
    "staffing_recommendations",
    "connector_sync",
    "trust_export_preview",
  ]),
};

/**
 * Get the default features for a plan tier.
 */
export function getPlanDefaults(plan: PlanTier): ReadonlySet<FeatureKey> {
  return PLAN_DEFAULTS[plan] ?? PLAN_DEFAULTS.core;
}

// ─── CATALOG (for API consumption) ──────────────────────────────────────────

export interface CatalogEntry {
  feature: FeatureKey;
  description: string;
  minPlan: PlanTier;
}

export const ENTITLEMENT_CATALOG: CatalogEntry[] = [
  { feature: "document_storage", description: "File uploads and document management", minPlan: "core" },
  { feature: "exports", description: "Standard data exports (CSV/JSON)", minPlan: "ops_plus" },
  { feature: "advanced_exports", description: "Approval-gated compliance exports", minPlan: "intelligence" },
  { feature: "automation_execution", description: "Automation rule execution and testing", minPlan: "ops_plus" },
  { feature: "ai_automation_drafting", description: "AI-assisted automation rule drafting", minPlan: "intelligence" },
  { feature: "knowledge_ingestion", description: "Knowledge base document ingestion", minPlan: "ops_plus" },
  { feature: "anomaly_detection", description: "Anomaly detection and alerting", minPlan: "intelligence" },
  { feature: "kpi_snapshots", description: "KPI snapshot capture and history", minPlan: "intelligence" },
  { feature: "executive_briefings", description: "AI-generated executive briefings", minPlan: "intelligence" },
  { feature: "staffing_recommendations", description: "AI staffing projections", minPlan: "intelligence" },
  { feature: "connector_sync", description: "Third-party integration connectors", minPlan: "enterprise" },
  { feature: "trust_export_preview", description: "Compliance export preview and data audit", minPlan: "enterprise" },
];

// ─── RESOLUTION ─────────────────────────────────────────────────────────────

export interface EffectiveEntitlement {
  feature: FeatureKey;
  enabled: boolean;
  source: "plan_default" | "override";
}

/**
 * Resolve effective entitlements for a workspace.
 * effective(feature) = override ?? plan_default
 */
export function resolveEntitlements(
  plan: PlanTier,
  overrides: Pick<EntitlementOverride, "feature" | "enabled">[],
): EffectiveEntitlement[] {
  const defaults = getPlanDefaults(plan);
  const overrideMap = new Map<string, boolean>();
  for (const o of overrides) {
    overrideMap.set(o.feature, o.enabled);
  }

  return FEATURES.map((feature) => {
    if (overrideMap.has(feature)) {
      return { feature, enabled: overrideMap.get(feature)!, source: "override" as const };
    }
    return { feature, enabled: defaults.has(feature), source: "plan_default" as const };
  });
}

/**
 * Check a single feature against plan + overrides.
 */
export function hasEntitlement(
  plan: PlanTier,
  overrides: Pick<EntitlementOverride, "feature" | "enabled">[],
  feature: FeatureKey,
): boolean {
  const override = overrides.find((o) => o.feature === feature);
  if (override) return override.enabled;
  return getPlanDefaults(plan).has(feature);
}

// ─── IN-MEMORY CACHE ────────────────────────────────────────────────────────
// Avoids hitting DB on every request. Invalidated on plan/override changes.

let cachedPlan: PlanTier = "core";
let cachedOverrides: Pick<EntitlementOverride, "feature" | "enabled">[] = [];
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 30_000; // 30s

/**
 * Load plan + overrides from storage. Called lazily and cached.
 */
export async function loadEntitlements(
  storage: {
    getWorkspaceConfigByKey(key: string): Promise<{ value: unknown } | undefined>;
  } & {
    getEntitlementOverrides(workspaceId: string): Promise<Pick<EntitlementOverride, "feature" | "enabled">[]>;
  } & {
    getWorkspacePlan(workspaceId: string): Promise<WorkspacePlan | undefined>;
  },
  force = false,
): Promise<{ plan: PlanTier; overrides: Pick<EntitlementOverride, "feature" | "enabled">[] }> {
  const now = Date.now();
  if (!force && now - cacheLoadedAt < CACHE_TTL_MS) {
    return { plan: cachedPlan, overrides: cachedOverrides };
  }

  const wp = await storage.getWorkspacePlan("default");
  cachedPlan = (wp?.plan && isValidPlan(wp.plan)) ? wp.plan as PlanTier : "core";
  cachedOverrides = await storage.getEntitlementOverrides("default");
  cacheLoadedAt = now;

  return { plan: cachedPlan, overrides: cachedOverrides };
}

/** Force-invalidate cached entitlements (call after mutation). */
export function invalidateEntitlementCache(): void {
  cacheLoadedAt = 0;
}

// ─── EXPRESS MIDDLEWARE ─────────────────────────────────────────────────────

/**
 * Express middleware factory: deny request if the workspace lacks the given feature.
 *
 * Usage: `app.get("/api/foo", requireAuth, requireEntitlement("connector_sync"), handler)`
 *
 * Returns 403 with machine-readable JSON:
 * `{ "message": "Feature not enabled", "code": "ENTITLEMENT_REQUIRED", "feature": "connector_sync" }`
 */
export function requireEntitlement(...features: FeatureKey[]) {
  return async (_req: Request, res: Response, next: NextFunction) => {
    try {
      // Lazy-import storage to break circular dependency
      const { storage } = await import("../storage.js");
      const { plan, overrides } = await loadEntitlements(storage);

      for (const feature of features) {
        if (!hasEntitlement(plan, overrides, feature)) {
          return res.status(403).json({
            message: "Feature not enabled",
            code: "ENTITLEMENT_REQUIRED",
            feature,
          });
        }
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Helper for route handlers: check entitlement inline without middleware.
 */
export async function checkEntitlement(feature: FeatureKey): Promise<boolean> {
  const { storage } = await import("../storage.js");
  const { plan, overrides } = await loadEntitlements(storage);
  return hasEntitlement(plan, overrides, feature);
}
