/**
 * Feature gate middleware — checks entitlements before route logic.
 * Usage: app.get("/api/exports/csv", requireAuth, requireFeature("exports"), handler);
 */
import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage.js";
import {
  loadEntitlements,
  resolveEntitlements,
  type PlanTier,
} from "../entitlements/engine.js";

/**
 * Express middleware that requires a specific feature to be enabled.
 * Returns 403 with a structured error if the feature is disabled.
 */
export function requireFeature(featureKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { plan, overrides } = await loadEntitlements(storage);
      const effective = resolveEntitlements(plan as PlanTier, overrides);
      const entry = effective.find((e) => e.feature === featureKey);

      if (!entry || !entry.enabled) {
        return res.status(403).json({
          error: "Feature not available",
          feature: featureKey,
          plan,
          message: `The "${featureKey}" feature is not enabled on your current plan.`,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
