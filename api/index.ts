/**
 * Vercel serverless function entry point.
 * Wraps the Express app for deployment on Vercel's Node.js runtime.
 * All API routes (/api/*) are routed here via vercel.json rewrites.
 */
import express, { type Request, type Response, type NextFunction } from "express";
import helmet from "helmet";
import compression from "compression";
import { createServer } from "http";
import { registerRoutes } from "../server/routes.js";
import { seedDatabase } from "../server/seed.js";

const app = express();
const httpServer = createServer(app);

// Required for secure cookies when the function runs behind Vercel's proxy.
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// Lazy initialization — runs once per cold start, cached for warm invocations.
// Failures are cached too so we return 503 on every subsequent call instead of
// crashing the function process.
let initPromise: Promise<void> | null = null;

function ensureReady(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await registerRoutes(httpServer, app);

      // Error-handler middleware — must be added after routes
      app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
        const status = err.status ?? err.statusCode ?? 500;
        const message = err.message || "Internal Server Error";
        console.error(`Server Error [${status}]: ${message}`);
        if (!res.headersSent) res.status(status).json({ message });
      });

      if (process.env.SEED_DATABASE === "true") {
        await seedDatabase().catch(() => {});
      }
    })();
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
  return app(req, res);
}
