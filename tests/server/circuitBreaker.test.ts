import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CircuitBreaker,
  CircuitBreakerOpenError,
} from "../../server/circuitBreaker.js";

// Suppress logger output during tests
vi.mock("../../server/observability/logger.js", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

describe("CircuitBreaker", () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker("test", {
      failureThreshold: 3,
      resetTimeoutMs: 100,
      halfOpenMax: 1,
    });
  });

  // ─── CLOSED state ─────────────────────────────────────────────────────────
  it("starts in CLOSED state", () => {
    expect(breaker.getState()).toBe("CLOSED");
  });

  it("passes through successful calls in CLOSED state", async () => {
    const result = await breaker.execute(() => Promise.resolve("ok"));
    expect(result).toBe("ok");
    expect(breaker.getState()).toBe("CLOSED");
  });

  it("resets failure count on success", async () => {
    // 2 failures (below threshold)
    for (let i = 0; i < 2; i++) {
      await breaker.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    }
    // Then a success — should reset
    await breaker.execute(() => Promise.resolve("ok"));
    // 2 more failures should not open (count was reset)
    for (let i = 0; i < 2; i++) {
      await breaker.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    }
    expect(breaker.getState()).toBe("CLOSED");
  });

  // ─── CLOSED → OPEN transition ─────────────────────────────────────────────
  it("opens after reaching failure threshold", async () => {
    for (let i = 0; i < 3; i++) {
      await breaker.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    }
    expect(breaker.getState()).toBe("OPEN");
  });

  it("throws CircuitBreakerOpenError when open", async () => {
    // Drive the breaker to OPEN via actual failures (so lastFailureTime is set)
    for (let i = 0; i < 3; i++) {
      await breaker.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    }
    expect(breaker.getState()).toBe("OPEN");
    await expect(breaker.execute(() => Promise.resolve("ok"))).rejects.toThrow(
      CircuitBreakerOpenError,
    );
  });

  it("CircuitBreakerOpenError includes breaker name", async () => {
    breaker.forceState("OPEN");
    try {
      await breaker.execute(() => Promise.resolve("ok"));
    } catch (err) {
      expect(err).toBeInstanceOf(CircuitBreakerOpenError);
      expect((err as CircuitBreakerOpenError).breakerName).toBe("test");
    }
  });

  // ─── OPEN → HALF_OPEN transition ──────────────────────────────────────────
  it("transitions to HALF_OPEN after resetTimeoutMs", async () => {
    breaker.forceState("OPEN");
    // Wait for reset timeout
    await new Promise((r) => setTimeout(r, 150));
    expect(breaker.getState()).toBe("HALF_OPEN");
  });

  // ─── HALF_OPEN → CLOSED on success ────────────────────────────────────────
  it("closes on successful probe in HALF_OPEN", async () => {
    breaker.forceState("OPEN");
    await new Promise((r) => setTimeout(r, 150));
    await breaker.execute(() => Promise.resolve("recovered"));
    expect(breaker.getState()).toBe("CLOSED");
  });

  // ─── HALF_OPEN → OPEN on failure ──────────────────────────────────────────
  it("re-opens on failed probe in HALF_OPEN", async () => {
    breaker.forceState("OPEN");
    await new Promise((r) => setTimeout(r, 150));
    await breaker.execute(() => Promise.reject(new Error("still broken"))).catch(() => {});
    expect(breaker.getState()).toBe("OPEN");
  });

  // ─── HALF_OPEN max attempts ───────────────────────────────────────────────
  it("rejects excess requests in HALF_OPEN", async () => {
    breaker.forceState("OPEN");
    await new Promise((r) => setTimeout(r, 150));
    // First request allowed (halfOpenMax=1)
    await breaker.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    // Re-opened now, so next request should fail immediately
    await expect(breaker.execute(() => Promise.resolve("ok"))).rejects.toThrow(
      CircuitBreakerOpenError,
    );
  });

  // ─── getStats ─────────────────────────────────────────────────────────────
  it("returns stats with correct structure", async () => {
    await breaker.execute(() => Promise.resolve("ok"));
    const stats = breaker.getStats();
    expect(stats).toMatchObject({
      name: "test",
      state: "CLOSED",
      failureCount: 0,
      successCount: 1,
    });
  });

  // ─── forceState ───────────────────────────────────────────────────────────
  it("forceState CLOSED resets failure count", async () => {
    for (let i = 0; i < 3; i++) {
      await breaker.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    }
    expect(breaker.getState()).toBe("OPEN");
    breaker.forceState("CLOSED");
    expect(breaker.getState()).toBe("CLOSED");
    // Should not open after 2 failures (count was reset)
    for (let i = 0; i < 2; i++) {
      await breaker.execute(() => Promise.reject(new Error("fail"))).catch(() => {});
    }
    expect(breaker.getState()).toBe("CLOSED");
  });

  // ─── onStateChange callback ───────────────────────────────────────────────
  it("calls onStateChange callback on transitions", async () => {
    const transitions: Array<[string, string]> = [];
    const cb = new CircuitBreaker("cb-test", {
      failureThreshold: 2,
      resetTimeoutMs: 100,
      halfOpenMax: 1,
      onStateChange: (_name, from, to) => transitions.push([from, to]),
    });

    await cb.execute(() => Promise.reject(new Error("f1"))).catch(() => {});
    await cb.execute(() => Promise.reject(new Error("f2"))).catch(() => {});
    expect(transitions).toEqual([["CLOSED", "OPEN"]]);
  });

  // ─── Error propagation ────────────────────────────────────────────────────
  it("propagates the original error from fn", async () => {
    const original = new TypeError("custom error");
    await expect(breaker.execute(() => Promise.reject(original))).rejects.toBe(original);
  });
});
