/** Shared types for the in-process task runner. */

export interface TaskDefinition {
  /** Unique identifier for the task. */
  id: string;
  /** Human-readable description. */
  description: string;
  /** How often to run (ms). */
  intervalMs: number;
  /** The async work to perform. */
  run: () => Promise<void>;
  /** Per-task timeout (ms). Defaults to 30 000. */
  timeoutMs?: number;
  /** Random jitter added to each interval (ms). 0 = none. */
  jitterMs?: number;
  /** Whether the task is enabled on registration. Defaults to true. */
  enabled?: boolean;
  /** Run immediately on start(), before first interval. */
  runOnStart?: boolean;
  /** Allow triggering via the manual-trigger API. */
  allowManualTrigger?: boolean;
}

export interface TaskState {
  id: string;
  description: string;
  enabled: boolean;
  running: boolean;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastDurationMs: number | null;
  runCount: number;
  errorCount: number;
  lastError: string | null;
  nextRunAt: string | null;
}
