/**
 * Enhanced station scope resolution — multi-station aware (Phase 4.2A).
 *
 * Upgrades the legacy `getStationScope()` pattern to support multiple
 * station assignments per user via the `user_station_assignments` table,
 * with fallback to the legacy `users.station` text field.
 *
 * Resolution:
 *   admin / supervisor → null (all stations)
 *   explicit assignments → number[] of station IDs
 *   legacy users.station → [parseInt(station)]
 *   no station → 'none'
 */

import type { Request, Response, NextFunction } from "express";

// ─── ENHANCED SCOPE RESOLUTION ──────────────────────────────────────────────

export type StationScope =
  | null          // unrestricted (admin, supervisor)
  | number[]      // restricted to these station IDs
  | "none";       // no station access

/**
 * Resolve the station scope for the current user.
 * Uses the multi-station assignment table with legacy fallback.
 */
export async function resolveStationScope(user: Express.User): Promise<StationScope> {
  // Admin / supervisor see everything
  if (user.role === "admin" || user.role === "supervisor") {
    return null;
  }

  // Resolve from assignments table (with legacy fallback)
  const { storage } = await import("../storage.js");
  const stationIds = await storage.resolveUserStationIds(user.id);

  if (stationIds.length === 0) return "none";
  return stationIds;
}

/**
 * Check if a specific station ID is within the user's scope.
 */
export function isStationInScope(stationId: number, scope: StationScope): boolean {
  if (scope === null) return true;                  // unrestricted
  if (scope === "none") return false;               // no access
  return scope.includes(stationId);                 // check membership
}

// ─── EXPRESS MIDDLEWARE ──────────────────────────────────────────────────────

/**
 * Express middleware: resolves station scope for the current user
 * and attaches it to `req.stationScope`.
 *
 * Should be placed AFTER requireAuth.
 */
export function attachStationScope() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = req.user as Express.User | undefined;
      if (!user) return next();

      (req as any).stationScope = await resolveStationScope(user);
      next();
    } catch (err) {
      next(err);
    }
  };
}
