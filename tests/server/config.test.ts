import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Config reads process.env at module scope, so we must set env BEFORE importing.
// We test by dynamically importing with different env setups.

describe("config.ts", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  async function loadConfig() {
    const mod = await import("../../server/config.js");
    return mod.config;
  }

  it("loads with valid DATABASE_URL", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.NODE_ENV = "test";
    const cfg = await loadConfig();
    expect(cfg.databaseUrl).toBe("postgresql://localhost:5432/test");
    expect(cfg.nodeEnv).toBe("test");
    expect(cfg.isTest).toBe(true);
    expect(cfg.isProduction).toBe(false);
  });

  it("applies default values for optional fields", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.NODE_ENV = "test";
    const cfg = await loadConfig();
    expect(cfg.port).toBe(5000);
    expect(cfg.trustProxyHops).toBe(1);
    expect(cfg.logLevel).toBe("info");
    expect(cfg.sessionSecret).toBe("dev-secret-not-for-production");
    expect(cfg.redisUrl).toBeNull();
    expect(cfg.anthropicApiKey).toBeNull();
  });

  it("parses numeric env vars", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.NODE_ENV = "test";
    process.env.PORT = "3000";
    process.env.TRUST_PROXY_HOPS = "2";
    process.env.RATE_LIMIT_AUTH = "50";
    const cfg = await loadConfig();
    expect(cfg.port).toBe(3000);
    expect(cfg.trustProxyHops).toBe(2);
    expect(cfg.rateLimits.auth).toBe(50);
  });

  it("parses CORS_ORIGIN as comma-separated list", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.NODE_ENV = "test";
    process.env.CORS_ORIGIN = "http://localhost:3000, https://app.example.com";
    const cfg = await loadConfig();
    expect(cfg.corsOrigins).toEqual(["http://localhost:3000", "https://app.example.com"]);
  });

  it("parses boolean-like env vars", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.NODE_ENV = "test";
    process.env.SEED_DATABASE = "true";
    process.env.OPEN_REGISTRATION = "true";
    const cfg = await loadConfig();
    expect(cfg.seedDatabase).toBe(true);
    expect(cfg.openRegistration).toBe(true);
  });

  it("config object is frozen (immutable)", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.NODE_ENV = "test";
    const cfg = await loadConfig();
    expect(Object.isFrozen(cfg)).toBe(true);
  });

  it("includes circuit breaker defaults", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.NODE_ENV = "test";
    const cfg = await loadConfig();
    expect(cfg.circuitBreaker).toMatchObject({
      failureThreshold: 5,
      resetTimeoutMs: 30_000,
      halfOpenMax: 2,
    });
  });

  it("includes rate limit defaults", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.NODE_ENV = "test";
    const cfg = await loadConfig();
    expect(cfg.rateLimits).toMatchObject({
      auth: 20,
      ai: 10,
      api: 120,
      search: 30,
    });
  });
});
