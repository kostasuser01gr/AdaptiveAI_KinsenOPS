/**
 * Export cleanup task — marks expired exports, deletes files (Phase 4.1A).
 *
 * Runs every 15 minutes. Marks completed exports past expiresAt as "expired"
 * and removes the file from disk.
 */

import { storage } from "../storage.js";
import { logger } from "../observability/logger.js";
import type { TaskDefinition } from "./types.js";
import { deleteExportFile } from "../exports/generators.js";

export const exportCleanupTask: TaskDefinition = {
  id: "export-cleanup",
  description: "Mark expired exports and delete associated files",
  intervalMs: 15 * 60_000, // 15 min
  timeoutMs: 60_000,
  jitterMs: 10_000,
  enabled: true,
  runOnStart: false,
  allowManualTrigger: true,

  async run() {
    const expired = await storage.getExpiredExportRequests();
    if (expired.length === 0) return;

    logger.info(`[export-cleanup] Found ${expired.length} expired export(s)`);

    for (const row of expired) {
      try {
        if (row.storageKey) {
          await deleteExportFile(row.storageKey);
        }
        await storage.updateExportRequest(row.id, { status: "expired" });
        logger.info(`[export-cleanup] Expired export #${row.id}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`[export-cleanup] Error cleaning export #${row.id}: ${message}`);
      }
    }
  },
};
