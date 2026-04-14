import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema.js";
import { metricsCollector } from "./observability/metrics.js";
import { config } from "./config.js";

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  statement_timeout: 30000,
});

// CC-2: Handle idle client errors to prevent unhandled 'error' events crashing the process
pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
  metricsCollector.week1.dbPoolErrors++;
});

export const db = drizzle(pool, { schema });

// Dedicated pool for AI tool executions — isolated from main app traffic
export const aiPool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
  statement_timeout: 60000,
});

aiPool.on('error', (err) => {
  console.error('Unexpected error on idle AI database client', err);
  metricsCollector.week1.dbPoolErrors++;
});

export const aiDb = drizzle(aiPool, { schema });

/**
 * Run a callback inside a database transaction.
 * Automatically rolls back on error, commits on success.
 * The callback receives the same `db` instance scoped to the transaction.
 */
export async function withTransaction<T>(
  fn: (tx: typeof db) => Promise<T>,
): Promise<T> {
  return db.transaction(fn as any);
}
