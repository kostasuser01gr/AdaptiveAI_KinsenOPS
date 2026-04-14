/**
 * Backward-compatible re-export.
 * All table definitions have been decomposed into domain modules under ./schema/.
 * Import from here for convenience, or from a specific domain file for a smaller dependency graph.
 */
export * from "./schema/index.js";
