/**
 * Circuit Breaker — Protects against cascading failures from external services.
 *
 * States:
 *   CLOSED  → Normal operation. Requests flow through.
 *   OPEN    → Failures exceeded threshold. Requests fail-fast.
 *   HALF_OPEN → Probe mode. Limited requests allowed to test recovery.
 *
 * Usage:
 *   const breaker = new CircuitBreaker("anthropic", { failureThreshold: 5 });
 *   const result = await breaker.execute(() => client.messages.create(params));
 */
import { logger } from "./observability/logger.js";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit */
  failureThreshold: number;
  /** Time in ms before transitioning from OPEN → HALF_OPEN */
  resetTimeoutMs: number;
  /** Max requests allowed through in HALF_OPEN state */
  halfOpenMax: number;
  /** Optional callback when state changes */
  onStateChange?: (name: string, from: CircuitState, to: CircuitState) => void;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  halfOpenMax: 2,
};

export class CircuitBreakerOpenError extends Error {
  constructor(public readonly breakerName: string) {
    super(`Circuit breaker "${breakerName}" is OPEN — request rejected`);
    this.name = "CircuitBreakerOpenError";
  }
}

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private halfOpenAttempts = 0;
  private readonly opts: CircuitBreakerOptions;

  constructor(
    public readonly name: string,
    options?: Partial<CircuitBreakerOptions>,
  ) {
    this.opts = { ...DEFAULT_OPTIONS, ...options };
  }

  getState(): CircuitState {
    // Check if OPEN should transition to HALF_OPEN
    if (this.state === "OPEN") {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.opts.resetTimeoutMs) {
        this.transition("HALF_OPEN");
      }
    }
    return this.state;
  }

  getStats() {
    return {
      name: this.name,
      state: this.getState(),
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
    };
  }

  /**
   * Execute a function through the circuit breaker.
   * Throws CircuitBreakerOpenError if the circuit is open.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === "OPEN") {
      throw new CircuitBreakerOpenError(this.name);
    }

    if (currentState === "HALF_OPEN" && this.halfOpenAttempts >= this.opts.halfOpenMax) {
      throw new CircuitBreakerOpenError(this.name);
    }

    if (currentState === "HALF_OPEN") {
      this.halfOpenAttempts++;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  /** Force the breaker to a specific state (for admin/testing) */
  forceState(state: CircuitState): void {
    this.transition(state);
    if (state === "CLOSED") {
      this.failureCount = 0;
      this.halfOpenAttempts = 0;
    }
  }

  private onSuccess(): void {
    this.successCount++;
    if (this.state === "HALF_OPEN") {
      // Successful probe → close the circuit
      this.transition("CLOSED");
      this.failureCount = 0;
      this.halfOpenAttempts = 0;
    } else if (this.state === "CLOSED") {
      // Reset consecutive failure count on success
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === "HALF_OPEN") {
      // Failed probe → re-open
      this.transition("OPEN");
      this.halfOpenAttempts = 0;
    } else if (this.state === "CLOSED" && this.failureCount >= this.opts.failureThreshold) {
      this.transition("OPEN");
    }
  }

  private transition(to: CircuitState): void {
    if (this.state === to) return;
    const from = this.state;
    this.state = to;
    logger.warn(`Circuit breaker "${this.name}": ${from} → ${to}`, { breaker: this.name, from, to });
    this.opts.onStateChange?.(this.name, from, to);
  }
}

// ─── Singleton breakers for known external services ─────────────────────────

const breakerRegistry = new Map<string, CircuitBreaker>();

/**
 * Get or create a named circuit breaker. Returns the same instance for the same name.
 */
export function getCircuitBreaker(name: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
  let breaker = breakerRegistry.get(name);
  if (!breaker) {
    breaker = new CircuitBreaker(name, options);
    breakerRegistry.set(name, breaker);
  }
  return breaker;
}

/** Get stats for all registered circuit breakers (for /api/system-health) */
export function getAllBreakerStats() {
  return Array.from(breakerRegistry.values()).map((b) => b.getStats());
}
