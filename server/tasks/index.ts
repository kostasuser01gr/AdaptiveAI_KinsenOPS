/**
 * Task runner entry point.
 *
 * Registers all known tasks and exports the singleton runner instance.
 * Consumer site (server/index.ts) calls `taskRunner.start()` after routes are ready
 * and `taskRunner.stop()` in the shutdown handler.
 */

export { TaskRunner } from "./runner.js";
export type { TaskDefinition, TaskState } from "./types.js";

import { TaskRunner } from "./runner.js";
import { slaBreachTask } from "./slaBreach.js";
import { kpiSnapshotsTask } from "./kpiSnapshots.js";
import { anomalyDetectionTask } from "./anomalyDetection.js";
import { connectorSyncTask } from "./connectorSync.js";
import { exportProcessorTask } from "./exportProcessor.js";
import { exportCleanupTask } from "./exportCleanup.js";

export const taskRunner = new TaskRunner();

taskRunner.register(slaBreachTask);
taskRunner.register(kpiSnapshotsTask);
taskRunner.register(anomalyDetectionTask);
taskRunner.register(connectorSyncTask);
taskRunner.register(exportProcessorTask);
taskRunner.register(exportCleanupTask);
