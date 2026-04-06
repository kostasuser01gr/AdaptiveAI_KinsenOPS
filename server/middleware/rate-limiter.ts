import rateLimit from "express-rate-limit";
import type { Request } from "express";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Too many authentication attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { message: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    if (req.user) {
      return `user-${(req.user as Express.User).id}`;
    }
    return req.ip || 'unknown';
  },
});

export const aiChatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: "Too many AI chat requests, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    if (req.user) {
      return `ai-${(req.user as Express.User).id}`;
    }
    return req.ip || 'unknown';
  },
});

export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { message: "Too many search requests, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const publicWashQueueReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { message: "Too many wash queue requests, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const publicWashQueueWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { message: "Too many wash queue submissions, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
});

export const publicEvidenceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { message: "Too many evidence uploads, please slow down" },
  standardHeaders: true,
  legacyHeaders: false,
});
