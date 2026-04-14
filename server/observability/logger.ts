import { randomUUID } from "crypto";
import type { Request, Response, NextFunction } from "express";

interface LogContext {
  userId?: number;
  requestId?: string;
  path?: string;
  method?: string;
  duration?: number;
  statusCode?: number;
  [key: string]: unknown;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class StructuredLogger {
  private isDevelopment = process.env.NODE_ENV !== 'production'; // Keep process.env — logger loads before config

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...context,
    };

    if (this.isDevelopment) {
      const contextStr = context ? ` ${JSON.stringify(context)}` : '';
      return `${timestamp} [${level.toUpperCase()}] ${message}${contextStr}`;
    }

    return JSON.stringify(logEntry);
  }

  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      // eslint-disable-next-line no-console
      console.debug(this.formatMessage('debug', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    console.info(this.formatMessage('info', message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('warn', message, context));
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const errorContext = error ? {
      ...context,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    } : context;

    console.error(this.formatMessage('error', message, errorContext));
  }
}

export const logger = new StructuredLogger();

/**
 * Middleware that assigns a unique request ID to every request.
 * The ID is attached to `res.locals.requestId` and returned in the
 * `X-Request-Id` response header so operators can correlate logs.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string) || randomUUID();
  res.locals.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
