/**
 * CSRF Double-Submit Cookie Protection.
 *
 * On every response, sets a `csrf-token` cookie with a random token.
 * State-changing requests (POST, PUT, PATCH, DELETE) must include the
 * token in the `x-csrf-token` header. The middleware compares the two
 * using timingSafeEqual to prevent timing attacks.
 *
 * GET/HEAD/OPTIONS are exempt (safe methods).
 * Routes under /api/public/ are exempt (unauthenticated public endpoints).
 */
import type { Request, Response, NextFunction } from "express";
import { randomBytes, timingSafeEqual } from "crypto";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const EXEMPT_PREFIXES = ["/api/public/", "/healthz", "/api/webhooks/", "/api/client-errors"];
const COOKIE_NAME = "csrf-token";
const HEADER_NAME = "x-csrf-token";

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function tokensMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

function getCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const pair of header.split(";")) {
    const idx = pair.indexOf("=");
    if (idx > 0 && pair.slice(0, idx).trim() === name) {
      try { return decodeURIComponent(pair.slice(idx + 1).trim()); } catch { return pair.slice(idx + 1).trim(); }
    }
  }
  return undefined;
}

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Always emit a CSRF token cookie so the client can read it
  if (!getCookie(req, COOKIE_NAME)) {
    const token = generateToken();
    res.cookie(COOKIE_NAME, token, {
      httpOnly: false, // Client JS must read this
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production", // Keep process.env — csrf loads before config
      path: "/",
    });
  }

  // Safe methods and exempt paths skip validation
  if (SAFE_METHODS.has(req.method)) return next();
  if (EXEMPT_PREFIXES.some((p) => req.originalUrl.startsWith(p) || req.path.startsWith(p))) return next();

  const cookieToken = getCookie(req, COOKIE_NAME);
  const headerToken = req.get(HEADER_NAME);

  if (!cookieToken || !headerToken || !tokensMatch(cookieToken, headerToken)) {
    return res.status(403).json({ message: "CSRF token missing or invalid" });
  }

  next();
}
