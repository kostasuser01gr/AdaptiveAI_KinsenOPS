/**
 * Shared database access and helpers for storage domain modules.
 */
export { db } from "../db.js";
export { eq, desc, and, sql, isNull, or, gte, lt } from "drizzle-orm";
export { getWorkspaceScope } from "../middleware/workspaceContext.js";

/**
 * Phase 4.3 — workspace filter shorthand.
 * Usage: `wsFilter(table)` returns `eq(table.workspaceId, currentScope)`.
 */
export function wsFilter<T extends { workspaceId: { name: string } }>(table: T) {
  const { eq: eqFn } = require("drizzle-orm");
  const { getWorkspaceScope: gws } = require("../middleware/workspaceContext.js");
  return eqFn(table.workspaceId, gws());
}

/**
 * Phase 4.3 — inject workspaceId into insert data.
 * Usage: `wsInsert(data)` returns `{ ...data, workspaceId: currentScope }`.
 */
export function wsInsert<T extends Record<string, unknown>>(data: T): T & { workspaceId: string } {
  const { getWorkspaceScope: gws } = require("../middleware/workspaceContext.js");
  return { ...data, workspaceId: gws() };
}

/**
 * Helper: build a filtered + ordered query with optional conditions.
 * Avoids the repeated pattern of checking `conditions.length === 0/1/N`.
 */
export function buildWhere(...conditions: (ReturnType<typeof import("drizzle-orm").eq> | undefined)[]) {
  const valid = conditions.filter((c): c is NonNullable<typeof c> => c !== undefined);
  if (valid.length === 0) return undefined;
  if (valid.length === 1) return valid[0];
  const { and } = require("drizzle-orm");
  return and(...valid);
}

/**
 * Helper: strip `id` from a partial update payload (used in multi-field updates
 * where the caller might accidentally pass `id` from a spread).
 */
export function stripId<T extends Record<string, unknown>>(data: T): Omit<T, "id"> {
  const { id: _id, ...rest } = data;
  return rest as Omit<T, "id">;
}
