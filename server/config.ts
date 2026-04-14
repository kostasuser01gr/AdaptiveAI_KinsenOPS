/**
 * Typed, Zod-validated environment configuration.
 * Import `config` from this module instead of reading process.env directly.
 *
 * Fails fast at import time if required variables are missing.
 */
import { z } from "zod/v4";

const envSchema = z.object({
  // ─── Required ──────────────────────────────────────────────────────────
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // ─── Required in production ────────────────────────────────────────────
  SESSION_SECRET: z.string().optional(),

  // ─── Server ────────────────────────────────────────────────────────────
  PORT: z.coerce.number().int().positive().default(5000),
  TRUST_PROXY_HOPS: z.coerce.number().int().nonnegative().default(1),
  CORS_ORIGIN: z.string().optional(),

  // ─── Redis (optional — graceful degradation) ───────────────────────────
  REDIS_URL: z.string().optional(),

  // ─── AI providers (optional) ───────────────────────────────────────────
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),

  // ─── External services ─────────────────────────────────────────────────
  SENTRY_DSN: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default("eu-central-1"),

  // ─── Feature / operational ─────────────────────────────────────────────
  SEED_DATABASE: z.string().optional(),
  OPEN_REGISTRATION: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // ─── Rate limiter thresholds (configurable without redeploy) ──────────
  RATE_LIMIT_AUTH: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_AI: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_API: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_SEARCH: z.coerce.number().int().positive().default(30),

  // ─── Circuit breaker thresholds ────────────────────────────────────────
  CB_FAILURE_THRESHOLD: z.coerce.number().int().positive().default(5),
  CB_RESET_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  CB_HALF_OPEN_MAX: z.coerce.number().int().positive().default(2),
});

// In test mode, provide a dummy DATABASE_URL so config doesn't crash for import-level tests
const envInput = { ...process.env };
if (envInput.NODE_ENV === "test" && !envInput.DATABASE_URL) {
  envInput.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
}

const parsed = envSchema.safeParse(envInput);

if (!parsed.success) {
  console.error("❌ Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`   ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

const env = parsed.data;

// Production-specific enforcement
if (env.NODE_ENV === "production" && !env.SESSION_SECRET) {
  console.error("❌ SESSION_SECRET is required in production");
  process.exit(1);
}

export const config = Object.freeze({
  // Core
  databaseUrl: env.DATABASE_URL,
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === "production",
  isDevelopment: env.NODE_ENV === "development",
  isTest: env.NODE_ENV === "test",

  // Server
  port: env.PORT,
  trustProxyHops: env.TRUST_PROXY_HOPS,
  corsOrigins: env.CORS_ORIGIN
    ? env.CORS_ORIGIN.split(",").map((s) => s.trim())
    : [],
  sessionSecret: env.SESSION_SECRET ?? "dev-secret-not-for-production",

  // Redis
  redisUrl: env.REDIS_URL ?? null,

  // AI
  anthropicApiKey: env.ANTHROPIC_API_KEY ?? null,
  openaiApiKey: env.OPENAI_API_KEY ?? null,
  googleAiApiKey: env.GOOGLE_AI_API_KEY ?? null,

  // External
  sentryDsn: env.SENTRY_DSN ?? null,
  s3Bucket: env.S3_BUCKET ?? null,
  s3Region: env.S3_REGION,

  // Features
  seedDatabase: env.SEED_DATABASE === "true",
  openRegistration: env.OPEN_REGISTRATION === "true",
  logLevel: env.LOG_LEVEL,

  // Rate limits (per window)
  rateLimits: {
    auth: env.RATE_LIMIT_AUTH,
    ai: env.RATE_LIMIT_AI,
    api: env.RATE_LIMIT_API,
    search: env.RATE_LIMIT_SEARCH,
  },

  // Circuit breaker
  circuitBreaker: {
    failureThreshold: env.CB_FAILURE_THRESHOLD,
    resetTimeoutMs: env.CB_RESET_TIMEOUT_MS,
    halfOpenMax: env.CB_HALF_OPEN_MAX,
  },
});

export type Config = typeof config;
