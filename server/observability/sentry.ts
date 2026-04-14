import * as Sentry from "@sentry/node";
import { config } from "../config.js";

export function initSentry() {
  if (!config.sentryDsn) return;

  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.nodeEnv,
    tracesSampleRate: config.isProduction ? 0.2 : 1.0,
  });
}

export { Sentry };
