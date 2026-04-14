/**
 * Export policy — defines which export types require approval, role access,
 * and validation rules (Phase 4.1A).
 */

/** Recognised export types. */
export const EXPORT_TYPES = [
  "audit_log",
  "incidents",
  "reservations",
  "repair_orders",
  "downtime_events",
  "kpi_snapshots",
  "vehicles",
  "executive_summaries",
] as const;
export type ExportType = (typeof EXPORT_TYPES)[number];

export const EXPORT_FORMATS = ["csv", "json"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** Export types that always require admin approval. */
const SENSITIVE_TYPES = new Set<ExportType>(["audit_log", "incidents"]);

/** Minimum role required to request each export type. */
const ROLE_REQUIREMENTS: Record<ExportType, readonly string[]> = {
  audit_log: ["admin"],
  incidents: ["admin", "supervisor"],
  reservations: ["admin", "supervisor"],
  repair_orders: ["admin", "supervisor"],
  downtime_events: ["admin", "supervisor"],
  kpi_snapshots: ["admin", "supervisor"],
  vehicles: ["admin", "supervisor"],
  executive_summaries: ["admin"],
};

import { configResolver } from "../config/resolver.js";

/** How many hours until a completed export file expires. (default — prefer configResolver at runtime) */
export const EXPORT_EXPIRY_HOURS = 48;

/** Maximum rows per single export to prevent resource exhaustion. (default — prefer configResolver at runtime) */
export const MAX_EXPORT_ROWS = 50_000;

/** Runtime-resolved export expiry hours. */
export async function getExportExpiryHours(): Promise<number> {
  return configResolver.getNumber("operational.export_expiry_hours");
}

/** Runtime-resolved max export rows. */
export async function getMaxExportRows(): Promise<number> {
  return configResolver.getNumber("operational.max_export_rows");
}

/**
 * Check if a given export type requires admin approval before processing.
 */
export function requiresApproval(exportType: ExportType): boolean {
  return SENSITIVE_TYPES.has(exportType);
}

/**
 * Determine the initial status for a new export request.
 *   - Sensitive types → pending_approval
 *   - Everything else → approved (ready to process immediately)
 */
export function initialStatus(exportType: ExportType): "pending_approval" | "approved" {
  return requiresApproval(exportType) ? "pending_approval" : "approved";
}

/**
 * Check if a user role is allowed to request a given export type.
 */
export function canRequestExport(exportType: ExportType, role: string): boolean {
  const allowed = ROLE_REQUIREMENTS[exportType];
  return allowed ? allowed.includes(role) : false;
}

/**
 * Validate export parameters. Returns an error message or null if valid.
 */
export function validateExportParams(
  exportType: string,
  format: string,
): string | null {
  if (!EXPORT_TYPES.includes(exportType as ExportType)) {
    return `Invalid export type: ${exportType}. Allowed: ${EXPORT_TYPES.join(", ")}`;
  }
  if (!EXPORT_FORMATS.includes(format as ExportFormat)) {
    return `Invalid format: ${format}. Allowed: ${EXPORT_FORMATS.join(", ")}`;
  }
  return null;
}
