/**
 * In-process task runner with concurrency guard, timeout, jitter, and graceful shutdown.
 *
 * Design goals:
 * - No external dependencies (no Redis / BullMQ / cron SaaS)
 * - Production-safe on a single Railway service
 * - A failing task never crashes the process
 */

import { logger } from "../observability/logger.js";
import type { TaskDefinition, TaskState } from "./types.js";

// ─── Internal bookkeeping per registered task ────────────────────────────────
interface TaskEntry {
  def: TaskDefinition;
  timer: ReturnType<typeof setTimeout> | null;
  running: boolean;
  lastStartedAt: Date | null;
  lastFinishedAt: Date | null;
  lastDurationMs: number | null;
  runCount: number;
  errorCount: number;
  lastError: string | null;
  nextRunAt: Date | null;
}

const DEFAULT_TIMEOUT_MS = 30_000;

export class TaskRunner {
  private tasks = new Map<string, TaskEntry>();
  private started = false;
  private shuttingDown = false;
  /** Tracks in-flight task runs so shutdown can await them. */
  private inflightSet = new Set<Promise<void>>();

  // ── Registration ─────────────────────────────────────────────────────────

  register(def: TaskDefinition): void {
    if (this.tasks.has(def.id)) {
      throw new Error(`Task "${def.id}" is already registered`);
    }
    this.tasks.set(def.id, {
      def: { enabled: true, timeoutMs: DEFAULT_TIMEOUT_MS, jitterMs: 0, ...def },
      timer: null,
      running: false,
      lastStartedAt: null,
      lastFinishedAt: null,
      lastDurationMs: null,
      runCount: 0,
      errorCount: 0,
      lastError: null,
      nextRunAt: null,
    });
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  start(): void {
    if (this.started) return;
    this.started = true;
    this.shuttingDown = false;
    logger.info("TaskRunner starting", { taskCount: this.tasks.size });

    for (const entry of this.tasks.values()) {
      if (!entry.def.enabled) continue;
      if (entry.def.runOnStart) {
        this.executeTask(entry);
      }
      this.scheduleNext(entry);
    }
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    this.shuttingDown = true;
    this.started = false;

    // Clear all pending timers
    for (const entry of this.tasks.values()) {
      if (entry.timer) {
        clearTimeout(entry.timer);
        entry.timer = null;
      }
      entry.nextRunAt = null;
    }

    // Wait for in-flight tasks (with a hard 10 s ceiling)
    if (this.inflightSet.size > 0) {
      logger.info("TaskRunner waiting for in-flight tasks", { count: this.inflightSet.size });
      const deadline = new Promise<void>((r) => setTimeout(r, 10_000));
      await Promise.race([Promise.allSettled([...this.inflightSet]), deadline]);
    }

    logger.info("TaskRunner stopped");
  }

  // ── Manual trigger ───────────────────────────────────────────────────────

  async trigger(taskId: string): Promise<{ ok: boolean; error?: string }> {
    const entry = this.tasks.get(taskId);
    if (!entry) return { ok: false, error: "unknown task" };
    if (!entry.def.allowManualTrigger) return { ok: false, error: "manual trigger not allowed" };
    if (entry.running) return { ok: false, error: "task already running" };
    await this.executeTask(entry);
    return { ok: true };
  }

  // ── Observability ────────────────────────────────────────────────────────

  getStates(): TaskState[] {
    return [...this.tasks.values()].map((e) => ({
      id: e.def.id,
      description: e.def.description,
      enabled: e.def.enabled !== false,
      running: e.running,
      lastStartedAt: e.lastStartedAt?.toISOString() ?? null,
      lastFinishedAt: e.lastFinishedAt?.toISOString() ?? null,
      lastDurationMs: e.lastDurationMs,
      runCount: e.runCount,
      errorCount: e.errorCount,
      lastError: e.lastError,
      nextRunAt: e.nextRunAt?.toISOString() ?? null,
    }));
  }

  getState(taskId: string): TaskState | undefined {
    const e = this.tasks.get(taskId);
    if (!e) return undefined;
    return {
      id: e.def.id,
      description: e.def.description,
      enabled: e.def.enabled !== false,
      running: e.running,
      lastStartedAt: e.lastStartedAt?.toISOString() ?? null,
      lastFinishedAt: e.lastFinishedAt?.toISOString() ?? null,
      lastDurationMs: e.lastDurationMs,
      runCount: e.runCount,
      errorCount: e.errorCount,
      lastError: e.lastError,
      nextRunAt: e.nextRunAt?.toISOString() ?? null,
    };
  }

  isStarted(): boolean {
    return this.started;
  }

  taskCount(): number {
    return this.tasks.size;
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private scheduleNext(entry: TaskEntry): void {
    if (this.shuttingDown || !this.started) return;
    if (!entry.def.enabled) return;

    const jitter = entry.def.jitterMs ? Math.round(Math.random() * entry.def.jitterMs) : 0;
    const delay = entry.def.intervalMs + jitter;
    entry.nextRunAt = new Date(Date.now() + delay);

    entry.timer = setTimeout(() => {
      entry.timer = null;
      this.executeTask(entry);
      this.scheduleNext(entry);
    }, delay);

    // Prevent timer from keeping the process alive during shutdown
    if (entry.timer && typeof entry.timer === "object" && "unref" in entry.timer) {
      (entry.timer as NodeJS.Timeout).unref();
    }
  }

  private executeTask(entry: TaskEntry): Promise<void> {
    // Concurrency guard: skip if already running
    if (entry.running) {
      logger.warn("Task skipped (already running)", { taskId: entry.def.id });
      return Promise.resolve();
    }

    entry.running = true;
    entry.lastStartedAt = new Date();
    entry.runCount++;

    const timeoutMs = entry.def.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const work = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Task "${entry.def.id}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      // Unref so it doesn't keep the process alive
      if (typeof timer === "object" && "unref" in timer) {
        (timer as NodeJS.Timeout).unref();
      }

      entry.def
        .run()
        .then(() => {
          clearTimeout(timer);
          resolve();
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });

    const tracked = work
      .then(() => {
        entry.lastFinishedAt = new Date();
        entry.lastDurationMs = entry.lastFinishedAt.getTime() - (entry.lastStartedAt?.getTime() ?? 0);
        entry.running = false;
      })
      .catch((err: unknown) => {
        entry.lastFinishedAt = new Date();
        entry.lastDurationMs = entry.lastFinishedAt.getTime() - (entry.lastStartedAt?.getTime() ?? 0);
        entry.running = false;
        entry.errorCount++;
        const msg = err instanceof Error ? err.message : String(err);
        entry.lastError = msg;
        logger.error("Task failed", new Error(msg), { taskId: entry.def.id });
      })
      .finally(() => {
        this.inflightSet.delete(tracked);
      });

    this.inflightSet.add(tracked);
    return tracked;
  }
}
