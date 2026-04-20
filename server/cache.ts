/**
 * Application-level query cache backed by Redis.
 *
 * Uses a cache-aside pattern: check cache first, fall through to DB,
 * then populate cache. Invalidate on writes via `invalidate()`.
 *
 * Gracefully degrades when Redis is unavailable — all calls pass through
 * to the underlying function with zero overhead.
 */
import { redis } from "./redis.js";
import { logger } from "./observability/logger.js";

/** Default TTL values in seconds by cache category */
export const CacheTTL = {
  /** Dashboard stats, fleet overview — refreshed frequently */
  SHORT: 15,
  /** Analytics summaries, KPI snapshots */
  MEDIUM: 60,
  /** Trends, historical data — rarely changes */
  LONG: 300,
} as const;

const CACHE_PREFIX = "cache:";

/**
 * Wraps an async function with Redis caching.
 *
 * @param key    - Cache key (will be prefixed with "cache:")
 * @param ttl    - Time-to-live in seconds
 * @param fn     - The async function to cache
 * @returns The cached or freshly computed result
 */
export async function cached<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>,
): Promise<T> {
  if (!redis) return fn();

  const fullKey = CACHE_PREFIX + key;

  try {
    const hit = await redis.get(fullKey);
    if (hit !== null) {
      return JSON.parse(hit) as T;
    }
  } catch (err) {
    logger.warn("Cache read error, falling through to DB", { key, err });
  }

  const result = await fn();

  try {
    await redis.set(fullKey, JSON.stringify(result), "EX", ttl);
  } catch (err) {
    logger.warn("Cache write error", { key, err });
  }

  return result;
}

/**
 * Invalidate one or more cache keys by exact match or glob pattern.
 *
 * @param patterns - Key(s) or glob patterns (e.g. "vehicles:*")
 */
export async function invalidate(...patterns: string[]): Promise<void> {
  if (!redis) return;

  for (const pattern of patterns) {
    const fullPattern = CACHE_PREFIX + pattern;

    try {
      if (pattern.includes("*")) {
        // Glob-based invalidation using SCAN (non-blocking)
        let cursor = "0";
        do {
          const [nextCursor, keys] = await redis.scan(
            cursor,
            "MATCH",
            fullPattern,
            "COUNT",
            100,
          );
          cursor = nextCursor;
          if (keys.length > 0) {
            await redis.del(...keys);
          }
        } while (cursor !== "0");
      } else {
        await redis.del(fullPattern);
      }
    } catch (err) {
      logger.warn("Cache invalidation error", { pattern, err });
    }
  }
}
