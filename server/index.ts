import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import compression from "compression";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedDatabase } from "./seed";
import { logger, requestIdMiddleware } from "./observability/logger.js";
import { metricsMiddleware } from "./observability/metrics.js";
import { wsManager } from "./websocket.js";
import { pool } from "./db.js";
import { apiLimiter } from "./middleware/rate-limiter.js";
import { taskRunner } from "./tasks/index.js";

const app = express();
const httpServer = createServer(app);

// Required for secure cookies when the app runs behind Railway/Vercel proxies.
app.set("trust proxy", 1);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    xFrameOptions: { action: "deny" },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    // @ts-expect-error -- permissionsPolicy is supported by helmet but not in current type defs
    permissionsPolicy: {
      features: {
        camera: ["self"],
        microphone: ["none"],
        geolocation: ["self"],
        payment: ["none"],
      },
    },
  })
);

// Additional security headers
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});

// Response compression
app.use(compression());

// Metrics collection
app.use(metricsMiddleware);

// Request correlation IDs for operator tracing
app.use(requestIdMiddleware);

app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// API rate limiting
app.use("/api", apiLimiter);

app.get("/healthz", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  let dbOk = false;
  try {
    const client = await pool.connect();
    try { await client.query("SELECT 1"); dbOk = true; } finally { client.release(); }
  } catch { /* db unreachable */ }

  const status = dbOk ? "ok" : "degraded";
  const code = dbOk ? 200 : 503;
  res.status(code).json({
    status,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    checks: { database: dbOk ? "connected" : "unreachable" },
  });
});

export function log(message: string, source = "express") {
  logger.info(message, { source });
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      logger.info(`${req.method} ${path}`, {
        method: req.method,
        path,
        statusCode: res.statusCode,
        duration,
        requestId: res.locals.requestId as string | undefined,
        userId: req.user ? (req.user as Express.User).id : undefined,
      });
    }
  });

  next();
});

(async () => {
  // Initialize WebSocket server
  wsManager.initialize(httpServer);

  await registerRoutes(httpServer, app);

  // Only seed in development or when explicitly requested
  if (process.env.NODE_ENV !== "production" || process.env.SEED_DATABASE === "true") {
    await seedDatabase();
  }

  // Start centralised task runner (SLA breach check, KPI snapshots, anomaly detection, etc.)
  taskRunner.start();

  // Graceful shutdown: stop accepting → drain tasks → close WS → close DB → exit
  const shutdown = async () => {
    logger.info('Shutdown initiated');
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await taskRunner.stop();
    wsManager.destroy();
    await pool.end();
    logger.info('Graceful shutdown complete');
    process.exit(0);
  };
  process.on('SIGTERM', () => { shutdown().catch((err) => { logger.error('Shutdown error', err); process.exit(1); }); });
  process.on('SIGINT', () => { shutdown().catch((err) => { logger.error('Shutdown error', err); process.exit(1); }); });

  app.use((err: Error & { status?: number; statusCode?: number }, req: Request, res: Response, next: NextFunction) => {
    const status = err.status ?? err.statusCode ?? 500;
    const message = err.message || "Internal Server Error";

    const requestId = res.locals.requestId as string | undefined;

    logger.error("Server error", err, {
      status,
      path: req.path,
      method: req.method,
      requestId,
      userId: req.user ? (req.user as Express.User).id : undefined,
    });

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({
      message: process.env.NODE_ENV === "production" ? "Internal Server Error" : message,
      ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
      requestId,
    });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
