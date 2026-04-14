import Redis from "ioredis";
import { logger } from "./observability/logger.js";
import { config } from "./config.js";

/**
 * Optional Redis client — connects only when REDIS_URL is set.
 * All consumers must check `redis !== null` before use.
 */
let redis: Redis | null = null;

const redisUrl = config.redisUrl;
if (redisUrl) {
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 5) return null; // stop retrying after 5 attempts
      return Math.min(times * 200, 2000);
    },
    lazyConnect: false,
  });

  redis.on("connect", () => logger.info("Redis connected"));
  redis.on("error", (err) => logger.error("Redis error", err));
}

export { redis };
