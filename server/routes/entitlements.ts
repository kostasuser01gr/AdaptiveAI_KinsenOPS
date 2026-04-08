/**
 * Entitlement routes — read plan, catalog, effective entitlements,
 * and admin override management (Phase 4.1B).
 */
import type { Express } from "express";
import { storage } from "../storage.js";
import { requireAuth, requireRole } from "../auth.js";
import { auditLog } from "../middleware/audit.js";
import {
  ENTITLEMENT_CATALOG,
  FEATURES,
  PLANS,
  PLAN_LABELS,
  isValidFeature,
  isValidPlan,
  resolveEntitlements,
  loadEntitlements,
  invalidateEntitlementCache,
  type PlanTier,
} from "../entitlements/engine.js";

export function registerEntitlementRoutes(app: Express) {
  // ─── FEATURE FLAGS (any authenticated user — frontend consumption) ───
  app.get("/api/entitlements/features", requireAuth, async (_req, res, next) => {
    try {
      const { plan, overrides } = await loadEntitlements(storage);
      const effective = resolveEntitlements(plan as PlanTier, overrides);
      const flags: Record<string, boolean> = {};
      for (const e of effective) flags[e.feature] = e.enabled;
      res.json({ plan, features: flags });
    } catch (err) { next(err); }
  });

  // ─── GET EFFECTIVE ENTITLEMENTS (admin detail view) ───
  app.get("/api/entitlements", requireRole("admin", "supervisor"), async (_req, res, next) => {
    try {
      const { plan, overrides } = await loadEntitlements(storage, true);
      const effective = resolveEntitlements(plan as PlanTier, overrides);
      const wp = await storage.getWorkspacePlan("default");
      res.json({
        workspaceId: "default",
        plan,
        planLabel: PLAN_LABELS[plan as PlanTier] ?? plan,
        activatedAt: wp?.activatedAt ?? null,
        entitlements: effective,
      });
    } catch (err) { next(err); }
  });

  // ─── GET CATALOG ───
  app.get("/api/entitlements/catalog", requireRole("admin", "supervisor"), async (_req, res, next) => {
    try {
      const { plan, overrides } = await loadEntitlements(storage, true);
      const effective = resolveEntitlements(plan as PlanTier, overrides);
      const effectiveMap = new Map(effective.map((e) => [e.feature, e]));

      const catalog = ENTITLEMENT_CATALOG.map((entry) => ({
        ...entry,
        enabled: effectiveMap.get(entry.feature)?.enabled ?? false,
        source: effectiveMap.get(entry.feature)?.source ?? "plan_default",
      }));

      res.json({
        plans: PLANS.map((p) => ({ id: p, label: PLAN_LABELS[p] })),
        currentPlan: plan,
        features: catalog,
      });
    } catch (err) { next(err); }
  });

  // ─── UPDATE WORKSPACE PLAN ───
  app.patch(
    "/api/entitlements/plan",
    requireRole("admin"),
    auditLog({ action: "update", entityType: "workspace_plan" }),
    async (req, res, next) => {
      try {
        const user = req.user as Express.User;
        const { plan } = req.body;
        if (!plan || !isValidPlan(plan)) {
          return res.status(400).json({ message: `Invalid plan. Allowed: ${PLANS.join(", ")}` });
        }
        const wp = await storage.upsertWorkspacePlan({
          workspaceId: "default",
          plan,
          activatedBy: user.id,
        });
        invalidateEntitlementCache();
        res.json(wp);
      } catch (err) { next(err); }
    },
  );

  // ─── UPSERT ENTITLEMENT OVERRIDE ───
  app.patch(
    "/api/entitlements/:feature",
    requireRole("admin"),
    auditLog({ action: "update", entityType: "entitlement_override" }),
    async (req, res, next) => {
      try {
        const user = req.user as Express.User;
        const feature = String(req.params.feature);
        if (!isValidFeature(feature)) {
          return res.status(400).json({ message: `Unknown feature: ${feature}. Valid: ${FEATURES.join(", ")}` });
        }
        const { enabled, reason } = req.body;
        if (typeof enabled !== "boolean") {
          return res.status(400).json({ message: "enabled must be a boolean" });
        }
        const override = await storage.upsertEntitlementOverride({
          workspaceId: "default",
          feature,
          enabled,
          reason: reason || null,
          updatedBy: user.id,
        });
        invalidateEntitlementCache();
        res.json(override);
      } catch (err) { next(err); }
    },
  );

  // ─── DELETE ENTITLEMENT OVERRIDE (revert to plan default) ───
  app.delete(
    "/api/entitlements/:feature",
    requireRole("admin"),
    auditLog({ action: "delete", entityType: "entitlement_override" }),
    async (req, res, next) => {
      try {
        const feature = String(req.params.feature);
        if (!isValidFeature(feature)) {
          return res.status(400).json({ message: `Unknown feature: ${feature}` });
        }
        await storage.deleteEntitlementOverride("default", feature);
        invalidateEntitlementCache();
        res.json({ message: "Override removed, reverted to plan default" });
      } catch (err) { next(err); }
    },
  );
}
