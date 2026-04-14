/**
 * Export generators — produce CSV / JSON files from database tables (Phase 4.1A).
 *
 * Each generator queries the database, writes the file to LOCAL_UPLOAD_DIR/exports/,
 * and returns metadata about the generated file.
 */
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { db, desc, and, eq, gte, lt } from "../storage/base.js";
import {
  auditLog,
  incidents,
  reservations,
  repairOrders,
  downtimeEvents,
  kpiSnapshots,
  vehicles,
  executiveBriefings,
} from "../../shared/schema.js";
import type { ExportType, ExportFormat } from "./policy.js";
import { getMaxExportRows } from "./policy.js";

const LOCAL_UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
const _EXPORTS_DIR = path.join(LOCAL_UPLOAD_DIR, "exports");

export interface GeneratedExport {
  storageKey: string;
  filename: string;
  mimeType: string;
  rowCount: number;
  filepath: string;
}

// ─── helpers ───

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = typeof val === "object" ? JSON.stringify(val) : String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvString(columns: string[], rows: Record<string, unknown>[]): string {
  const header = columns.map(csvEscape).join(",");
  const lines = rows.map((r) => columns.map((c) => csvEscape(r[c])).join(","));
  return [header, ...lines].join("\n");
}

function generateKey(exportType: string, format: string): { storageKey: string; filename: string } {
  const ts = Date.now();
  const rand = crypto.randomBytes(4).toString("hex");
  const ext = format === "json" ? "json" : "csv";
  const filename = `${exportType}_${ts}_${rand}.${ext}`;
  const storageKey = `exports/${filename}`;
  return { storageKey, filename };
}

async function writeExport(
  storageKey: string,
  content: string,
  _format: ExportFormat,
): Promise<string> {
  const filepath = path.resolve(LOCAL_UPLOAD_DIR, storageKey);
  // Security: ensure resolved path stays within uploads
  if (!filepath.startsWith(path.resolve(LOCAL_UPLOAD_DIR))) {
    throw new Error("Path traversal detected");
  }
  await ensureDir(path.dirname(filepath));
  await fs.writeFile(filepath, content, "utf-8");
  return filepath;
}

// ─── query helpers (shared filter parsing) ───

function parseDateFilters(filters?: Record<string, unknown>): { from?: Date; to?: Date } {
  const from = filters?.from ? new Date(String(filters.from)) : undefined;
  const to = filters?.to ? new Date(String(filters.to)) : undefined;
  return { from, to };
}

// ─── table-specific generators ───

const TABLE_GENERATORS: Record<ExportType, (maxRows: number, filters?: Record<string, unknown>) => Promise<{ columns: string[]; rows: Record<string, unknown>[] }>> = {
  audit_log: async (maxRows, filters) => {
    const columns = ["id", "userId", "action", "entityType", "entityId", "details", "ipAddress", "createdAt"];
    const { from, to } = parseDateFilters(filters);
    const conds = [];
    if (from) conds.push(gte(auditLog.createdAt, from));
    if (to) conds.push(lt(auditLog.createdAt, to));
    const where = conds.length ? (conds.length === 1 ? conds[0] : and(...conds)) : undefined;
    const rows = await db.select().from(auditLog).where(where).orderBy(desc(auditLog.createdAt)).limit(maxRows);
    return { columns, rows };
  },

  incidents: async (maxRows, filters) => {
    const columns = ["id", "title", "severity", "status", "category", "reportedBy", "assignedTo", "vehicleId", "stationId", "resolvedAt", "closedAt", "createdAt", "updatedAt"];
    const conds = [];
    const { from, to } = parseDateFilters(filters);
    if (from) conds.push(gte(incidents.createdAt, from));
    if (to) conds.push(lt(incidents.createdAt, to));
    if (filters?.stationId) conds.push(eq(incidents.stationId, Number(filters.stationId)));
    if (filters?.status) conds.push(eq(incidents.status, String(filters.status)));
    const where = conds.length ? (conds.length === 1 ? conds[0] : and(...conds)) : undefined;
    const rows = await db.select().from(incidents).where(where).orderBy(desc(incidents.createdAt)).limit(maxRows);
    return { columns, rows };
  },

  reservations: async (maxRows, filters) => {
    const columns = ["id", "vehicleId", "stationId", "customerName", "customerEmail", "status", "source", "pickupDate", "returnDate", "notes", "createdAt"];
    const conds = [];
    const { from, to } = parseDateFilters(filters);
    if (from) conds.push(gte(reservations.createdAt, from));
    if (to) conds.push(lt(reservations.createdAt, to));
    if (filters?.stationId) conds.push(eq(reservations.stationId, Number(filters.stationId)));
    if (filters?.status) conds.push(eq(reservations.status, String(filters.status)));
    const where = conds.length ? (conds.length === 1 ? conds[0] : and(...conds)) : undefined;
    const rows = await db.select().from(reservations).where(where).orderBy(desc(reservations.createdAt)).limit(maxRows);
    return { columns, rows };
  },

  repair_orders: async (maxRows, filters) => {
    const columns = ["id", "vehicleId", "incidentId", "stationId", "title", "status", "priority", "assignedTo", "estimatedCost", "actualCost", "estimatedCompletion", "completedAt", "createdAt"];
    const conds = [];
    const { from, to } = parseDateFilters(filters);
    if (from) conds.push(gte(repairOrders.createdAt, from));
    if (to) conds.push(lt(repairOrders.createdAt, to));
    if (filters?.stationId) conds.push(eq(repairOrders.stationId, Number(filters.stationId)));
    if (filters?.status) conds.push(eq(repairOrders.status, String(filters.status)));
    const where = conds.length ? (conds.length === 1 ? conds[0] : and(...conds)) : undefined;
    const rows = await db.select().from(repairOrders).where(where).orderBy(desc(repairOrders.createdAt)).limit(maxRows);
    return { columns, rows };
  },

  downtime_events: async (maxRows, filters) => {
    const columns = ["id", "vehicleId", "reason", "incidentId", "repairOrderId", "stationId", "startedAt", "endedAt", "notes", "createdAt"];
    const conds = [];
    const { from, to } = parseDateFilters(filters);
    if (from) conds.push(gte(downtimeEvents.createdAt, from));
    if (to) conds.push(lt(downtimeEvents.createdAt, to));
    if (filters?.stationId) conds.push(eq(downtimeEvents.stationId, Number(filters.stationId)));
    const where = conds.length ? (conds.length === 1 ? conds[0] : and(...conds)) : undefined;
    const rows = await db.select().from(downtimeEvents).where(where).orderBy(desc(downtimeEvents.createdAt)).limit(maxRows);
    return { columns, rows };
  },

  kpi_snapshots: async (maxRows, filters) => {
    const columns = ["id", "kpiSlug", "value", "date", "stationId", "metadata", "createdAt"];
    const conds = [];
    const { from, to } = parseDateFilters(filters);
    if (from) conds.push(gte(kpiSnapshots.createdAt, from));
    if (to) conds.push(lt(kpiSnapshots.createdAt, to));
    if (filters?.stationId) conds.push(eq(kpiSnapshots.stationId, Number(filters.stationId)));
    if (filters?.kpiSlug) conds.push(eq(kpiSnapshots.kpiSlug, String(filters.kpiSlug)));
    const where = conds.length ? (conds.length === 1 ? conds[0] : and(...conds)) : undefined;
    const rows = await db.select().from(kpiSnapshots).where(where).orderBy(desc(kpiSnapshots.createdAt)).limit(maxRows);
    return { columns, rows };
  },

  vehicles: async (maxRows, filters) => {
    const columns = ["id", "plate", "model", "category", "stationId", "status", "sla", "mileage", "fuelLevel"];
    const conds = [];
    if (filters?.stationId) conds.push(eq(vehicles.stationId, Number(filters.stationId)));
    if (filters?.status) conds.push(eq(vehicles.status, String(filters.status)));
    const where = conds.length ? (conds.length === 1 ? conds[0] : and(...conds)) : undefined;
    const rows = await db.select().from(vehicles).where(where).limit(maxRows);
    return { columns, rows };
  },

  executive_summaries: async (maxRows, filters) => {
    const columns = ["id", "title", "summary", "date", "kpiSummary", "anomalySummary", "recommendations", "generatedBy", "stationId", "createdAt"];
    const conds = [];
    const { from, to } = parseDateFilters(filters);
    if (from) conds.push(gte(executiveBriefings.createdAt, from));
    if (to) conds.push(lt(executiveBriefings.createdAt, to));
    if (filters?.stationId) conds.push(eq(executiveBriefings.stationId, Number(filters.stationId)));
    const where = conds.length ? (conds.length === 1 ? conds[0] : and(...conds)) : undefined;
    const rows = await db.select().from(executiveBriefings).where(where).orderBy(desc(executiveBriefings.createdAt)).limit(maxRows);
    return { columns, rows };
  },
};

// ─── public API ───

/**
 * Generate an export file (CSV or JSON) for the given type and filters.
 * Returns metadata and the filesystem path of the generated file.
 */
export async function generateExport(
  exportType: ExportType,
  format: ExportFormat,
  filters?: Record<string, unknown>,
): Promise<GeneratedExport> {
  const generator = TABLE_GENERATORS[exportType];
  if (!generator) throw new Error(`No generator for export type: ${exportType}`);

  const maxRows = await getMaxExportRows();
  const { columns, rows } = await generator(maxRows, filters);
  const { storageKey, filename } = generateKey(exportType, format);

  let content: string;
  let mimeType: string;
  if (format === "json") {
    content = JSON.stringify(rows, null, 2);
    mimeType = "application/json";
  } else {
    content = toCsvString(columns, rows as Record<string, unknown>[]);
    mimeType = "text/csv";
  }

  const filepath = await writeExport(storageKey, content, format);

  return {
    storageKey,
    filename,
    mimeType,
    rowCount: rows.length,
    filepath,
  };
}

/**
 * Delete an export file from disk.
 */
export async function deleteExportFile(storageKey: string): Promise<void> {
  const filepath = path.resolve(LOCAL_UPLOAD_DIR, storageKey);
  if (!filepath.startsWith(path.resolve(LOCAL_UPLOAD_DIR))) {
    throw new Error("Path traversal detected");
  }
  try {
    await fs.unlink(filepath);
  } catch {
    // File may already be gone
  }
}

/**
 * Get the absolute filepath for an export storage key.
 * Returns null if file doesn't exist.
 */
export async function getExportFilepath(storageKey: string): Promise<string | null> {
  const filepath = path.resolve(LOCAL_UPLOAD_DIR, storageKey);
  if (!filepath.startsWith(path.resolve(LOCAL_UPLOAD_DIR))) {
    return null;
  }
  try {
    await fs.access(filepath);
    return filepath;
  } catch {
    return null;
  }
}
