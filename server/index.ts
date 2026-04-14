import { serveStatic } from "./static.js";
import { setupVite } from "./vite.js";
import { createConfiguredApp, registerConfiguredRoutes, installGlobalErrorHandler, Sentry } from "./app.js";
import { logger } from "./observability/logger.js";
import { wsManager } from "./websocket.js";
import { pool } from "./db.js";
import { taskRunner } from "./tasks/index.js";
import { eventBus } from "./events/eventBus.js";
import { config } from "./config.js";
const configuredApp = createConfiguredApp();
const { app, httpServer } = configuredApp;

export function log(message: string, source = "express") {
  logger.info(message, { source });
}

(async () => {
  wsManager.initialize(httpServer);

  await registerConfiguredRoutes(configuredApp, { seedDatabaseOnInit: !config.isProduction });

  await eventBus.connectRedis();

  taskRunner.start();

  const SHUTDOWN_TIMEOUT_MS = 15_000;
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('Shutdown initiated');

    // Force exit if drain takes too long
    const forceTimer = setTimeout(() => {
      logger.error(`Shutdown timed out after ${SHUTDOWN_TIMEOUT_MS}ms — forcing exit`);
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceTimer.unref(); // Don't keep process alive just for the timer

    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await taskRunner.stop();
    await eventBus.destroy();
    wsManager.destroy();
    await pool.end();
    clearTimeout(forceTimer);
    logger.info('Graceful shutdown complete');
    process.exit(0);
  };
  process.on('SIGTERM', () => { shutdown().catch((err) => { logger.error('Shutdown error', err); process.exit(1); }); });
  process.on('SIGINT', () => { shutdown().catch((err) => { logger.error('Shutdown error', err); process.exit(1); }); });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', reason instanceof Error ? reason : new Error(String(reason)));
    Sentry.captureException(reason);
  });
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception — shutting down', err);
    Sentry.captureException(err);
    shutdown().catch(() => process.exit(1));
  });

  if (config.isProduction) {
    serveStatic(app);
  } else {
    await setupVite(httpServer, app);
  }

  installGlobalErrorHandler(app);

  const port = config.port;
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})().catch((err) => {
  console.error("FATAL: startup failed", err);
  process.exit(1);
});
