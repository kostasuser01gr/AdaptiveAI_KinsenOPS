import type { Request, Response, NextFunction } from "express";

interface MetricData {
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  userId?: number;
}

// ─── Week-1 operational counters (monotonic, survive metric window rotation) ─
interface Week1Counters {
  authFailures: number;
  publicFlowErrors: number;
  importFailures: number;
  aiRequestFailures: number;
  wsDisconnects: number;
  proposalApplyFailures: number;
  exportFailures: number;
  feedbackSubmitted: number;
}

class MetricsCollector {
  private metrics: MetricData[] = [];
  private readonly maxSize = 1000;

  /** Monotonic counters — never reset, always grow */
  readonly week1: Week1Counters = {
    authFailures: 0,
    publicFlowErrors: 0,
    importFailures: 0,
    aiRequestFailures: 0,
    wsDisconnects: 0,
    proposalApplyFailures: 0,
    exportFailures: 0,
    feedbackSubmitted: 0,
  };

  recordRequest(data: MetricData): void {
    this.metrics.push(data);

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
  }

  recordFeedback(): void {
    this.week1.feedbackSubmitted++;
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

  getWeek1Counters(): Week1Counters {
    return { ...this.week1 };
  }

  reset(): void {
    this.metrics = [];
  }
}

export const metricsCollector = new MetricsCollector();

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
