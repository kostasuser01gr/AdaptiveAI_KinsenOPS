import rateLimit, { ipKeyGenerator, type Store } from "express-rate-limit";
import type { Request } from "express";
import { redis } from "../redis.js";

// Conditional Redis store — falls back to in-memory when Redis is unavailable
let redisStore: Store | undefined;
if (redis) {
  try {
    const { default: RedisStore } = await import("rate-limit-redis");
    redisStore = new RedisStore({ sendCommand: ((...args: string[]) => redis!.call(...(args as [string, ...string[]]))) as any });
  } catch {
    // rate-limit-redis unavailable — fall back to in-memory
  }
}

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Too many authentication attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  store: redisStore,
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { message: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
  keyGenerator: (req: Request) => {
    if (req.user) {
      return `user-${(req.user as Express.User).id}`;
    }
    return ipKeyGenerator(req.ip!, 48);
  },
});

export const aiChatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: "Too many AI chat requests, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
  keyGenerator: (req: Request) => {
    if (req.user) {
      return `ai-${(req.user as Express.User).id}`;
    }
    return ipKeyGenerator(req.ip!, 48);
  },
});

export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { message: "Too many search requests, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
});

export const publicWashQueueReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { message: "Too many wash queue requests, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
});

export const publicWashQueueWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: "Too many wash queue submissions, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
});

export const publicEvidenceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { message: "Too many evidence uploads, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
});

export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { message: "Too many webhook requests, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore,
});
