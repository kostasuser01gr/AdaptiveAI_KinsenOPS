/**
 * Export processor task — picks approved exports and generates files (Phase 4.1A).
 *
 * Runs every 30 s, processes up to 5 queued exports per cycle.
 */

import { storage } from "../storage.js";
import { logger } from "../observability/logger.js";
import type { TaskDefinition } from "./types.js";
import { generateExport } from "../exports/generators.js";
import { EXPORT_EXPIRY_HOURS, type ExportType, type ExportFormat } from "../exports/policy.js";

export const exportProcessorTask: TaskDefinition = {
  id: "export-processor",
  description: "Process approved export requests and generate files",
  intervalMs: 30_000,
  timeoutMs: 120_000,
  jitterMs: 5_000,
  enabled: true,
  runOnStart: false,
  allowManualTrigger: true,

  async run() {
    const pending = await storage.getProcessableExportRequests();
    if (pending.length === 0) return;

    logger.info(`[export-processor] Processing ${pending.length} queued export(s)`);

    for (const row of pending.slice(0, 5)) {
      try {
        await storage.updateExportRequest(row.id, { status: "processing" });

        const result = await generateExport(
          row.exportType as ExportType,
          (row.format || "csv") as ExportFormat,
          (row.filters as Record<string, unknown>) || undefined,
        );

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + EXPORT_EXPIRY_HOURS);

        await storage.updateExportRequest(row.id, {
          status: "completed",
          storageKey: result.storageKey,
          filename: result.filename,
          mimeType: result.mimeType,
          rowCount: result.rowCount,
          expiresAt,
          completedAt: new Date(),
        });

        logger.info(`[export-processor] Completed export #${row.id}: ${result.filename} (${result.rowCount} rows)`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`[export-processor] Failed export #${row.id}: ${message}`);
        await storage.updateExportRequest(row.id, {
          status: "failed",
          error: message.slice(0, 2000),
        }).catch(() => {});
      }
    }
  },
};
