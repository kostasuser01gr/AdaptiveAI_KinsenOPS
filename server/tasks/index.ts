/**
 * Task runner entry point.
 *
 * Registers all known tasks and exports the singleton runner instance.
 * Uses BullMQ (Redis-backed, multi-instance safe) when REDIS_URL is set,
 * falls back to in-process TaskRunner otherwise.
 *
 * Consumer site (server/index.ts) calls `taskRunner.start()` after routes are ready
 * and `taskRunner.stop()` in the shutdown handler.
 */

export { TaskRunner } from "./runner.js";
export type { TaskDefinition, TaskState } from "./types.js";

import { TaskRunner } from "./runner.js";
import { BullMQRunner } from "./bullmq-runner.js";
import { slaBreachTask } from "./slaBreach.js";
import { kpiSnapshotsTask } from "./kpiSnapshots.js";
import { anomalyDetectionTask } from "./anomalyDetection.js";
import { connectorSyncTask } from "./connectorSync.js";
import { exportProcessorTask } from "./exportProcessor.js";
import { exportCleanupTask } from "./exportCleanup.js";
import { predictiveMaintenanceTask } from "./predictiveMaintenance.js";
import { logger } from "../observability/logger.js";

const allTasks = [
  slaBreachTask,
  kpiSnapshotsTask,
  anomalyDetectionTask,
  connectorSyncTask,
  exportProcessorTask,
  exportCleanupTask,
  predictiveMaintenanceTask,
];

function createRunner(): TaskRunner | BullMQRunner {
  // Lazy import to avoid circular dependency at module level
  const redisUrl = process.env.REDIS_URL; // Keep process.env — tasks/index.ts loads early
  if (redisUrl) {
    logger.info("Using BullMQ task runner (Redis-backed)");
    const runner = new BullMQRunner(redisUrl);
    for (const task of allTasks) runner.register(task);
    return runner;
  }
  logger.info("Using in-process task runner (no REDIS_URL)");
  const runner = new TaskRunner();
  for (const task of allTasks) runner.register(task);
  return runner;
}

export const taskRunner = createRunner();
