import type { Request, Response, NextFunction } from "express";

/**
 * Request timeout middleware — prevents long-running requests from
 * hanging the server indefinitely.
 *
 * Default: 30s for normal requests, configurable per-route via
 * `res.locals.timeoutMs`.
 */
export function requestTimeout(defaultMs = 30_000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ms = (res.locals.timeoutMs as number | undefined) ?? defaultMs;

    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({ message: "Request timeout" });
      }
    }, ms);

    res.on("close", () => clearTimeout(timer));
    res.on("finish", () => clearTimeout(timer));
    next();
  };
}

/**
 * Middleware to set a custom timeout for specific routes.
 * Use before the route handler: app.post("/api/exports", extendTimeout(120_000), handler)
 */
export function extendTimeout(ms: number) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.locals.timeoutMs = ms;
    next();
  };
}
