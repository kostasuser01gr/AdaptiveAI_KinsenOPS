/**
 * Capability permission engine — catalog, resolution, and middleware (Phase 4.2A).
 *
 * Resolution: effective(user, cap) = user_override ?? role_default ?? false
 *
 * Layered on top of existing role-based auth — capabilities are for fine-grained
 * control of sensitive actions within already-authorized roles.
 */

import type { Request, Response, NextFunction } from "express";

// ─── CAPABILITY CATALOG ─────────────────────────────────────────────────────

export const CAPABILITIES = [
  "trust_export",        // Export from trust/compliance console
  "export_approve",      // Approve/reject export requests
  "connector_manage",    // Manage integration connectors + trigger sync
  "entitlement_manage",  // Change workspace plan / override entitlements
  "automation_execute",  // Manually execute automation rules
  "ai_draft",            // AI automation drafting
  "briefing_generate",   // Generate executive briefings
  "incident_resolve",    // Resolve/close incidents
  "document_ingest",     // Upload/ingest knowledge base documents
] as const;

export type CapabilityKey = (typeof CAPABILITIES)[number];

export function isValidCapability(key: string): key is CapabilityKey {
  return (CAPABILITIES as readonly string[]).includes(key);
}

export const CAPABILITY_CATALOG: Array<{ capability: CapabilityKey; description: string; defaultRoles: string[] }> = [
  { capability: "trust_export",       description: "Export from trust/compliance console",    defaultRoles: ["admin"] },
  { capability: "export_approve",     description: "Approve/reject export requests",          defaultRoles: ["admin", "supervisor"] },
  { capability: "connector_manage",   description: "Manage connectors and trigger sync",      defaultRoles: ["admin"] },
  { capability: "entitlement_manage", description: "Change workspace plan/entitlements",      defaultRoles: ["admin"] },
  { capability: "automation_execute", description: "Execute automation rules manually",        defaultRoles: ["admin", "supervisor", "coordinator"] },
  { capability: "ai_draft",           description: "Create AI automation drafts",             defaultRoles: ["admin", "supervisor"] },
  { capability: "briefing_generate",  description: "Generate executive briefings",            defaultRoles: ["admin", "supervisor"] },
  { capability: "incident_resolve",   description: "Resolve and close incidents",             defaultRoles: ["admin", "supervisor", "coordinator"] },
  { capability: "document_ingest",    description: "Upload/ingest knowledge documents",       defaultRoles: ["admin", "supervisor", "coordinator"] },
];

// ─── IN-MEMORY CACHE ────────────────────────────────────────────────────────

interface CachedCapabilities {
  roleDefaults: Map<string, Map<string, boolean>>; // role → capability → granted
  userOverrides: Map<number, Map<string, boolean>>; // userId → capability → granted
}

let cache: CachedCapabilities = {
  roleDefaults: new Map(),
  userOverrides: new Map(),
};
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 30_000;

/**
 * Load capability data from storage. Cached with TTL.
 */
async function loadCapabilities(force = false): Promise<CachedCapabilities> {
  const now = Date.now();
  if (!force && now - cacheLoadedAt < CACHE_TTL_MS) {
    return cache;
  }

  const { storage } = await import("../storage.js");
  const allRoleCaps = await storage.getAllRoleCapabilities();

  const roleDefaults = new Map<string, Map<string, boolean>>();
  for (const rc of allRoleCaps) {
    if (!roleDefaults.has(rc.role)) roleDefaults.set(rc.role, new Map());
    roleDefaults.get(rc.role)!.set(rc.capability, rc.granted);
  }

  // User overrides are loaded on-demand per user to avoid loading all users
  cache = { roleDefaults, userOverrides: new Map() };
  cacheLoadedAt = now;
  return cache;
}

/** Force-invalidate capability cache. */
export function invalidateCapabilityCache(): void {
  cacheLoadedAt = 0;
  cache.userOverrides.clear();
}

// ─── RESOLUTION ─────────────────────────────────────────────────────────────

/**
 * Resolve a single capability for a user.
 * Resolution: user_override ?? role_default ?? false
 */
export async function resolveCapability(
  userId: number,
  role: string,
  capability: CapabilityKey,
): Promise<boolean> {
  const caps = await loadCapabilities();

  // Check user override first (load on demand, cache per-user)
  if (!caps.userOverrides.has(userId)) {
    const { storage } = await import("../storage.js");
    const overrides = await storage.getUserCapabilityOverrides(userId);
    const map = new Map<string, boolean>();
    for (const o of overrides) map.set(o.capability, o.granted);
    caps.userOverrides.set(userId, map);
  }

  const userMap = caps.userOverrides.get(userId);
  if (userMap?.has(capability)) {
    return userMap.get(capability)!;
  }

  // Fall back to role default
  const roleMap = caps.roleDefaults.get(role);
  if (roleMap?.has(capability)) {
    return roleMap.get(capability)!;
  }

  // Not configured → deny
  return false;
}

/**
 * Resolve all capabilities for a user.
 */
export async function resolveAllCapabilities(
  userId: number,
  role: string,
): Promise<Record<CapabilityKey, { granted: boolean; source: "user_override" | "role_default" | "default_deny" }>> {
  const caps = await loadCapabilities();

  if (!caps.userOverrides.has(userId)) {
    const { storage } = await import("../storage.js");
    const overrides = await storage.getUserCapabilityOverrides(userId);
    const map = new Map<string, boolean>();
    for (const o of overrides) map.set(o.capability, o.granted);
    caps.userOverrides.set(userId, map);
  }

  const userMap = caps.userOverrides.get(userId) ?? new Map();
  const roleMap = caps.roleDefaults.get(role) ?? new Map();

  const result: Record<string, { granted: boolean; source: string }> = {};
  for (const cap of CAPABILITIES) {
    if (userMap.has(cap)) {
      result[cap] = { granted: userMap.get(cap)!, source: "user_override" };
    } else if (roleMap.has(cap)) {
      result[cap] = { granted: roleMap.get(cap)!, source: "role_default" };
    } else {
      result[cap] = { granted: false, source: "default_deny" };
    }
  }
  return result as Record<CapabilityKey, { granted: boolean; source: "user_override" | "role_default" | "default_deny" }>;
}

// ─── EXPRESS MIDDLEWARE ──────────────────────────────────────────────────────

/**
 * Express middleware factory: deny request if the user lacks the given capability.
 *
 * Usage: `app.post("/api/foo", requireAuth, requireCapability("trust_export"), handler)`
 *
 * Returns 403 with machine-readable JSON:
 * `{ "message": "Capability not granted", "code": "CAPABILITY_REQUIRED", "capability": "trust_export" }`
 */
export function requireCapability(...capabilities: CapabilityKey[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as Express.User | undefined;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      for (const cap of capabilities) {
        const granted = await resolveCapability(user.id, user.role, cap);
        if (!granted) {
          return res.status(403).json({
            message: "Capability not granted",
            code: "CAPABILITY_REQUIRED",
            capability: cap,
          });
        }
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
