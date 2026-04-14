/**
 * Vercel serverless function entry point.
 * Wraps the Express app for deployment on Vercel's Node.js runtime.
 * All API routes (/api/*) are routed here via vercel.json rewrites.
 */
import type express from "express";
import { createConfiguredApp, registerConfiguredRoutes, installGlobalErrorHandler } from "../server/app.js";

let configuredApp = createConfiguredApp();

// Lazy initialization — runs once per cold start, cached for warm invocations.
// Failures are cached too so we return 503 on every subsequent call instead of
// crashing the function process.
let initPromise: Promise<void> | null = null;

function ensureReady(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await registerConfiguredRoutes(configuredApp, {
        seedDatabaseOnInit: process.env.SEED_DATABASE === "true",
      });
      installGlobalErrorHandler(configuredApp.app);
    })().catch((err) => {
      initPromise = null;
      configuredApp = createConfiguredApp();
      throw err;
    });
  }
  return initPromise;
}

export default async function handler(
  req: express.Request,
  res: express.Response
) {
  try {
    await ensureReady();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Service unavailable";
    console.error("Startup error:", message);
    if (!res.headersSent) {
      res.status(503).json({ message: "Service temporarily unavailable" });
    }
    return;
  }
  return configuredApp.app(req, res);
}
