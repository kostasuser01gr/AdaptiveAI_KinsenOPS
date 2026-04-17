import type { Request, Response, NextFunction } from "express";
import client from "prom-client";

// ─── Prometheus registry & default metrics ───
export const promRegistry = new client.Registry();
client.collectDefaultMetrics({ register: promRegistry });

const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [promRegistry],
});

const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status_code"] as const,
  registers: [promRegistry],
});

const wsDisconnectsTotal = new client.Counter({
  name: "ws_disconnects_total",
  help: "Total WebSocket disconnections",
  registers: [promRegistry],
});

const feedbackTotal = new client.Counter({
  name: "feedback_submitted_total",
  help: "Total feedback submissions",
  registers: [promRegistry],
});

interface MetricData {
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  userId?: number;
}

// ─── Week-1 operational counters — backed by Prometheus Counters ─────────────
// These replace the old plain-number Week1Counters interface.
// Each counter is now a real Prometheus counter exported via /metrics.

const week1Counters = {
  authFailures: new client.Counter({
    name: "week1_auth_failures_total",
    help: "Authentication failures",
    registers: [promRegistry],
  }),
  publicFlowErrors: new client.Counter({
    name: "week1_public_flow_errors_total",
    help: "Public flow errors",
    registers: [promRegistry],
  }),
  importFailures: new client.Counter({
    name: "week1_import_failures_total",
    help: "Import processing failures",
    registers: [promRegistry],
  }),
  aiRequestFailures: new client.Counter({
    name: "week1_ai_request_failures_total",
    help: "AI request failures",
    registers: [promRegistry],
  }),
  wsDisconnects: new client.Counter({
    name: "week1_ws_disconnects_total",
    help: "WebSocket disconnections",
    registers: [promRegistry],
  }),
  proposalApplyFailures: new client.Counter({
    name: "week1_proposal_apply_failures_total",
    help: "Proposal apply/revert failures",
    registers: [promRegistry],
  }),
  exportFailures: new client.Counter({
    name: "week1_export_failures_total",
    help: "Export failures",
    registers: [promRegistry],
  }),
  feedbackSubmitted: new client.Counter({
    name: "week1_feedback_submitted_total",
    help: "Feedback submissions",
    registers: [promRegistry],
  }),
  dbPoolErrors: new client.Counter({
    name: "week1_db_pool_errors_total",
    help: "Database pool errors",
    registers: [promRegistry],
  }),
} as const;

/** Backward-compatible shape for code that reads counter values */
interface Week1CounterValues {
  authFailures: number;
  publicFlowErrors: number;
  importFailures: number;
  aiRequestFailures: number;
  wsDisconnects: number;
  proposalApplyFailures: number;
  exportFailures: number;
  feedbackSubmitted: number;
  dbPoolErrors: number;
}

class MetricsCollector {
  private metrics: MetricData[] = [];
  private readonly maxSize = 1000;

  /**
   * Increment-only accessors compatible with the old `week1.x++` pattern.
   * Uses a Proxy so `metricsCollector.week1.authFailures++` still works,
   * but internally increments the Prometheus counter.
   */
  readonly week1 = new Proxy({} as Record<string, number>, {
    get(_target, prop: string) {
      const counter = week1Counters[prop as keyof typeof week1Counters];
      if (!counter) return 0;
      return (counter as unknown as { hashMap: Record<string, { value: number }> }).hashMap?.[""]?.value ?? 0;
    },
    set(_target, prop: string, value: number) {
      const counter = week1Counters[prop as keyof typeof week1Counters];
      if (counter) counter.inc();
      return true;
    },
  }) as unknown as Week1CounterValues;

  recordRequest(data: MetricData): void {
    this.metrics.push(data);

    // Feed Prometheus
    const route = normalizeRoute(data.path);
    httpRequestDuration.observe(
      { method: data.method, route, status_code: String(data.statusCode) },
      data.duration / 1000,
    );
    httpRequestsTotal.inc({ method: data.method, route, status_code: String(data.statusCode) });

    // Classify into week-1 counters based on path + status
    if (data.statusCode >= 400) {
      const p = data.path;
      if (p.startsWith('/api/auth/')) this.week1.authFailures++;
      else if (p.startsWith('/api/public/')) this.week1.publicFlowErrors++;
      else if (p.includes('/imports') && (p.includes('/confirm') || p.includes('/fail') || p.includes('/retry') || p.includes('/process'))) this.week1.importFailures++;
      else if (p === '/api/ai/chat') this.week1.aiRequestFailures++;
      else if (p.includes('/proposals') && (p.includes('/apply') || p.includes('/revert'))) this.week1.proposalApplyFailures++;
      else if (p.includes('/export')) this.week1.exportFailures++;
    }

    if (this.metrics.length > this.maxSize) {
      this.metrics.shift();
    }
  }

  recordWsDisconnect(): void {
    this.week1.wsDisconnects++;
    wsDisconnectsTotal.inc();
  }

  recordFeedback(): void {
    this.week1.feedbackSubmitted++;
    feedbackTotal.inc();
  }

  getMetrics(): {
    totalRequests: number;
    avgResponseTime: number;
    errorRate: number;
    requestsByPath: Record<string, number>;
    requestsByStatus: Record<number, number>;
  } {
    const total = this.metrics.length;
    if (total === 0) {
      return {
        totalRequests: 0,
        avgResponseTime: 0,
        errorRate: 0,
        requestsByPath: {},
        requestsByStatus: {},
      };
    }

    const avgResponseTime = this.metrics.reduce((sum, m) => sum + m.duration, 0) / total;
    const errors = this.metrics.filter(m => m.statusCode >= 400).length;
    const errorRate = errors / total;

    const requestsByPath: Record<string, number> = {};
    const requestsByStatus: Record<number, number> = {};

    for (const metric of this.metrics) {
      requestsByPath[metric.path] = (requestsByPath[metric.path] || 0) + 1;
      requestsByStatus[metric.statusCode] = (requestsByStatus[metric.statusCode] || 0) + 1;
    }

    return {
      totalRequests: total,
      avgResponseTime: Math.round(avgResponseTime),
      errorRate: Math.round(errorRate * 10000) / 100,
      requestsByPath,
      requestsByStatus,
    };
  }

  getWeek1Counters(): Week1CounterValues {
    const result: Record<string, number> = {};
    for (const [key, counter] of Object.entries(week1Counters)) {
      const hashMap = (counter as unknown as { hashMap: Record<string, { value: number }> }).hashMap;
      result[key] = hashMap?.[""]?.value ?? 0;
    }
    return result as unknown as Week1CounterValues;
  }

  reset(): void {
    this.metrics = [];
    // Reset Prometheus week1 counters (needed for test isolation)
    for (const counter of Object.values(week1Counters)) {
      counter.reset();
    }
  }
}

export const metricsCollector = new MetricsCollector();

/** Collapse path params to reduce cardinality (e.g. /api/vehicles/42 → /api/vehicles/:id) */
function normalizeRoute(path: string): string {
  return path.replace(/\/\d+/g, "/:id");
}

/** Returns Prometheus exposition format text for scraping */
export async function getPrometheusMetrics(): Promise<string> {
  return promRegistry.metrics();
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const user = req.user as Express.User | undefined;

    metricsCollector.recordRequest({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userId: user?.id,
    });
  });

  next();
}
