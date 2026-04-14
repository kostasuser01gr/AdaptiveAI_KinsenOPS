import { describe, it, expect } from "vitest";
import { insertFeedbackSchema } from "../../shared/schema.js";

// ─── Week-1 stabilization tests ──────────────────────────────────────────────
// These validate the new observability, feedback, and metrics additions
// without hitting the DB.

describe("Feedback schema validation", () => {
  it("accepts valid feedback", () => {
    const valid = {
      page: "/imports",
      category: "bug",
      message: "Import stuck in processing state for 10 minutes",
    };
    const result = insertFeedbackSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("accepts all valid categories", () => {
    for (const cat of ["bug", "usability", "data", "other"]) {
      const result = insertFeedbackSchema.safeParse({
        page: "/fleet",
        category: cat,
        message: "Test feedback message here",
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid category", () => {
    const result = insertFeedbackSchema.safeParse({
      page: "/fleet",
      category: "feature-request",
      message: "Please add dark mode",
    });
    expect(result.success).toBe(false);
  });

  it("rejects message shorter than 5 chars", () => {
    const result = insertFeedbackSchema.safeParse({
      page: "/fleet",
      category: "bug",
      message: "hi",
    });
    expect(result.success).toBe(false);
  });

  it("rejects message longer than 2000 chars", () => {
    const result = insertFeedbackSchema.safeParse({
      page: "/fleet",
      category: "bug",
      message: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty page", () => {
    const result = insertFeedbackSchema.safeParse({
      page: "",
      category: "bug",
      message: "Something is broken",
    });
    expect(result.success).toBe(false);
  });

  it("allows optional userId and role fields", () => {
    const result = insertFeedbackSchema.safeParse({
      page: "/analytics",
      category: "data",
      message: "Chart data looks wrong for last week",
      userId: 42,
      role: "admin",
    });
    expect(result.success).toBe(true);
  });
});

describe("Week-1 metrics collector", () => {
  // Import the actual collector for unit testing
  it("classifies auth failures by path", async () => {
    // Dynamic import to avoid module-level side effects
    const { metricsCollector } = await import("../../server/observability/metrics.js");
    metricsCollector.reset();

    metricsCollector.recordRequest({
      method: "POST",
      path: "/api/auth/login",
      statusCode: 401,
      duration: 50,
    });

    const counters = metricsCollector.getWeek1Counters();
    expect(counters.authFailures).toBe(1);
    expect(counters.publicFlowErrors).toBe(0);
  });

  it("classifies public flow errors", async () => {
    const { metricsCollector } = await import("../../server/observability/metrics.js");
    metricsCollector.reset();

    metricsCollector.recordRequest({
      method: "POST",
      path: "/api/public/rooms/resolve",
      statusCode: 400,
      duration: 30,
    });

    const counters = metricsCollector.getWeek1Counters();
    expect(counters.publicFlowErrors).toBe(1);
  });

  it("classifies import failures", async () => {
    const { metricsCollector } = await import("../../server/observability/metrics.js");
    metricsCollector.reset();

    metricsCollector.recordRequest({
      method: "POST",
      path: "/api/imports/5/confirm",
      statusCode: 500,
      duration: 200,
    });

    const counters = metricsCollector.getWeek1Counters();
    expect(counters.importFailures).toBe(1);
  });

  it("does not count successful requests as failures", async () => {
    const { metricsCollector } = await import("../../server/observability/metrics.js");
    metricsCollector.reset();

    metricsCollector.recordRequest({
      method: "POST",
      path: "/api/auth/login",
      statusCode: 200,
      duration: 80,
    });

    const counters = metricsCollector.getWeek1Counters();
    expect(counters.authFailures).toBe(0);
  });

  it("tracks WS disconnects via recordWsDisconnect", async () => {
    const { metricsCollector } = await import("../../server/observability/metrics.js");
    metricsCollector.reset();

    metricsCollector.recordWsDisconnect();
    metricsCollector.recordWsDisconnect();

    const counters = metricsCollector.getWeek1Counters();
    expect(counters.wsDisconnects).toBe(2);
  });

  it("tracks feedback submissions", async () => {
    const { metricsCollector } = await import("../../server/observability/metrics.js");
    metricsCollector.reset();

    metricsCollector.recordFeedback();

    const counters = metricsCollector.getWeek1Counters();
    expect(counters.feedbackSubmitted).toBe(1);
  });
});

describe("Request ID middleware", () => {
  it("generates a UUID when no X-Request-Id header is provided", async () => {
    const { requestIdMiddleware } = await import("../../server/observability/logger.js");

    const req = { headers: {} } as any;
    const headers: Record<string, string> = {};
    const res = {
      locals: {} as Record<string, unknown>,
      setHeader(name: string, value: string) {
        headers[name] = value;
      },
    } as any;
    let called = false;
    const next = () => { called = true; };

    requestIdMiddleware(req, res, next);

    expect(called).toBe(true);
    expect(res.locals.requestId).toBeDefined();
    expect(typeof res.locals.requestId).toBe("string");
    expect(res.locals.requestId.length).toBeGreaterThan(0);
    expect(headers["X-Request-Id"]).toBe(res.locals.requestId);
  });

  it("uses existing X-Request-Id header when provided", async () => {
    const { requestIdMiddleware } = await import("../../server/observability/logger.js");

    const req = { headers: { "x-request-id": "test-correlation-123" } } as any;
    const res = {
      locals: {} as Record<string, unknown>,
      setHeader: function (name: string, value: string) {
        (this as any)[`_header_${name}`] = value;
      },
    } as any;
    const next = () => {};

    requestIdMiddleware(req, res, next);

    expect(res.locals.requestId).toBe("test-correlation-123");
  });
});
