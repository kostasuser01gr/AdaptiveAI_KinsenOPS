import type { Request, Response, NextFunction } from "express";
import { redis } from "../redis.js";

const IDEMPOTENCY_HEADER = "idempotency-key";
const TTL_SECONDS = 86_400; // 24 hours

/**
 * Idempotency middleware — prevents duplicate mutations.
 *
 * When a client sends a mutating request with an `Idempotency-Key` header,
 * the first response is cached and replayed for any repeat with the same key.
 * Without Redis, the header is accepted but not enforced (graceful degradation).
 */
export function idempotencyGuard(req: Request, res: Response, next: NextFunction) {
  // Only applies to mutating methods
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }

  const key = req.headers[IDEMPOTENCY_HEADER] as string | undefined;
  if (!key || !redis) {
    return next();
  }

  // Validate key format — must be 8-128 chars, alphanumeric + hyphens
  if (!/^[\w-]{8,128}$/.test(key)) {
    return res.status(400).json({ message: "Invalid Idempotency-Key format" });
  }

  const cacheKey = `idem:${req.path}:${key}`;

  redis.get(cacheKey).then((cached) => {
    if (cached) {
      // Replay cached response
      try {
        const { status, body } = JSON.parse(cached);
        res.status(status).json(body);
      } catch {
        // Corrupted cache entry — proceed normally
        handleRequest(cacheKey, res, next);
      }
      return;
    }
    handleRequest(cacheKey, res, next);
  }).catch(() => {
    // Redis error — proceed without idempotency
    next();
  });
}

function handleRequest(cacheKey: string, res: Response, next: NextFunction) {
  const originalJson = res.json.bind(res);

  res.json = function idempotentJson(body?: unknown) {
    // Cache the response for replay
    if (redis) {
      const entry = JSON.stringify({ status: res.statusCode, body });
      redis.set(cacheKey, entry, "EX", TTL_SECONDS).catch(() => {});
    }
    return originalJson(body);
  } as Response["json"];

  next();
}
