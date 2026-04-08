/**
 * Connector health-check task (stub).
 *
 * No existing periodic connector sync exists — this is registration-ready only.
 * Enabled=false so it does nothing unless explicitly activated.
 */

import { storage } from "../storage.js";
import { logger } from "../observability/logger.js";
import type { TaskDefinition } from "./types.js";

export const connectorSyncTask: TaskDefinition = {
  id: "connector-sync",
  description: "Periodic health check for integration connectors (stub — enable when auto-sync is needed)",
  intervalMs: 10 * 60_000, // 10 minutes
  timeoutMs: 120_000,
  jitterMs: 15_000,
  enabled: false,
  runOnStart: false,
  allowManualTrigger: true,

  async run() {
    const connectors = await storage.getIntegrationConnectors();
    const active = connectors.filter((c) => c.status === "active");

    for (const c of active) {
      // Lightweight: just log status. Full sync is still triggered via POST /api/connectors/:id/sync.
      logger.info("Connector health check", { connectorId: c.id, name: c.name, type: c.type });
    }
  },
};
