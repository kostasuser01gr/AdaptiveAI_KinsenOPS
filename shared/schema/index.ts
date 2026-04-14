/**
 * Barrel re-export — provides backward-compatible `@shared/schema` imports.
 *
 * Each domain module is self-contained; import from a specific domain file
 * for smaller dependency graphs, or from this index for convenience.
 */
export * from "./core.js";
export * from "./chat.js";
export * from "./shifts.js";
export * from "./notifications.js";
export * from "./automation.js";
export * from "./audit.js";
export * from "./workspace.js";
export * from "./analytics.js";
export * from "./integrations.js";
export * from "./incidents.js";
export * from "./fleet.js";
export * from "./entitlements.js";
export * from "./imports.js";
export * from "./ai.js";
export * from "./channels.js";
export * from "./widgets.js";
export * from "./ideas.js";
export * from "./workshop.js";
