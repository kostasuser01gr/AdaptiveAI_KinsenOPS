/**
 * BullMQ-backed task queue — distributed, persistent, multi-instance safe.
 *
 * Mirrors the TaskRunner interface (register, start, stop, trigger, getStates)
 * so it's a drop-in replacement. Uses repeatable jobs for interval scheduling.
 *
 * Falls back to in-process TaskRunner when REDIS_URL is not set.
 */

import { Queue, Worker, type Job } from "bullmq";
import { logger } from "../observability/logger.js";
import type { TaskDefinition, TaskState } from "./types.js";

const QUEUE_NAME = "adaptive-tasks";

export class BullMQRunner {
  private queue: Queue;
  private worker: Worker | null = null;
  private tasks = new Map<string, TaskDefinition>();
  private states = new Map<string, { running: boolean; runCount: number; errorCount: number; lastError: string | null; lastStartedAt: string | null; lastFinishedAt: string | null; lastDurationMs: number | null }>();
  private started = false;
  private connection: { host: string; port: number; password?: string; tls?: object };

  constructor(redisUrl: string) {
    const url = new URL(redisUrl);
    this.connection = {
      host: url.hostname,
      port: parseInt(url.port, 10) || 6379,
      ...(url.password && { password: url.password }),
      ...(url.protocol === "rediss:" && { tls: {} }),
    };

    this.queue = new Queue(QUEUE_NAME, {
      connection: this.connection,
      defaultJobOptions: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    });
  }

  register(def: TaskDefinition): void {
    this.tasks.set(def.id, def);
    this.states.set(def.id, {
      running: false, runCount: 0, errorCount: 0,
      lastError: null, lastStartedAt: null, lastFinishedAt: null, lastDurationMs: null,
    });
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    // Register repeatable jobs for each enabled task
    for (const [id, def] of this.tasks) {
      if (def.enabled === false) continue;

      await this.queue.upsertJobScheduler(
        id,
        { every: def.intervalMs },
        { name: id, data: { taskId: id } },
      );

      if (def.runOnStart) {
        await this.queue.add(id, { taskId: id });
      }
    }

    // Start worker to process jobs
    this.worker = new Worker(
      QUEUE_NAME,
      async (job: Job<{ taskId: string }>) => {
        const taskId = job.data.taskId;
        const def = this.tasks.get(taskId);
        if (!def) throw new Error(`Unknown task: ${taskId}`);

        const state = this.states.get(taskId)!;
        state.running = true;
        state.lastStartedAt = new Date().toISOString();
        state.runCount++;

        const start = Date.now();
        try {
          // Apply task timeout
          const timeoutMs = def.timeoutMs ?? 30_000;
          await Promise.race([
            def.run(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`Task "${taskId}" timed out after ${timeoutMs}ms`)), timeoutMs)
            ),
          ]);
          state.lastDurationMs = Date.now() - start;
          state.lastFinishedAt = new Date().toISOString();
          state.lastError = null;
        } catch (err) {
          state.errorCount++;
          state.lastDurationMs = Date.now() - start;
          state.lastFinishedAt = new Date().toISOString();
          state.lastError = err instanceof Error ? err.message : String(err);
          logger.error("BullMQ task failed", new Error(`${taskId}: ${state.lastError}`));
          throw err; // Let BullMQ handle retries
        } finally {
          state.running = false;
        }
      },
      {
        connection: this.connection,
        concurrency: 3,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    );

    this.worker.on("failed", (job, err) => {
      logger.error("BullMQ job failed", new Error(`${job?.data.taskId}: ${err.message}`));
    });

    logger.info("BullMQ task runner started", { taskCount: this.tasks.size });
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    this.started = false;

    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    await this.queue.close();
    logger.info("BullMQ task runner stopped");
  }

  async trigger(taskId: string): Promise<{ ok: boolean; error?: string }> {
    const def = this.tasks.get(taskId);
    if (!def) return { ok: false, error: "unknown task" };
    if (!def.allowManualTrigger) return { ok: false, error: "manual trigger not allowed" };

    await this.queue.add(taskId, { taskId }, { priority: 1 });
    return { ok: true };
  }

  getStates(): TaskState[] {
    return [...this.tasks.entries()].map(([id, def]) => {
      const s = this.states.get(id)!;
      return {
        id,
        description: def.description,
        enabled: def.enabled !== false,
        running: s.running,
        lastStartedAt: s.lastStartedAt,
        lastFinishedAt: s.lastFinishedAt,
        lastDurationMs: s.lastDurationMs,
        runCount: s.runCount,
        errorCount: s.errorCount,
        lastError: s.lastError,
        nextRunAt: null, // BullMQ manages scheduling internally
      };
    });
  }

  getState(taskId: string): TaskState | undefined {
    const def = this.tasks.get(taskId);
    const s = this.states.get(taskId);
    if (!def || !s) return undefined;
    return {
      id: taskId,
      description: def.description,
      enabled: def.enabled !== false,
      running: s.running,
      lastStartedAt: s.lastStartedAt,
      lastFinishedAt: s.lastFinishedAt,
      lastDurationMs: s.lastDurationMs,
      runCount: s.runCount,
      errorCount: s.errorCount,
      lastError: s.lastError,
      nextRunAt: null,
    };
  }

  isStarted(): boolean { return this.started; }
  taskCount(): number { return this.tasks.size; }
}
