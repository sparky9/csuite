import pg from 'pg';
import { Logger } from '../utils/logger.js';

const { Pool } = pg;

let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    pool = new Pool({
      connectionString,
      ssl: connectionString.includes('neon.tech') || connectionString.includes('amazonaws.com')
        ? { rejectUnauthorized: false }
        : undefined,
      max: 15,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });

    pool.on('error', (error) => {
      Logger.error('Unexpected PG pool error', { error });
    });
  }

  return pool;
}

export async function initializeTaskDatabase(connectionString?: string): Promise<boolean> {
  const dbUrl = connectionString || process.env.DATABASE_URL;

  if (!dbUrl) {
    Logger.warn('DATABASE_URL not set. Task manager data will not persist.');
    return false;
  }

  try {
    // Ensure the pool is created using the provided connection string.
    if (connectionString && process.env.DATABASE_URL !== connectionString) {
      process.env.DATABASE_URL = connectionString;
    }

    const activePool = getPool();
    const client = await activePool.connect();
    await client.query('SELECT NOW()');
    client.release();
    Logger.info('Task manager database connected');
    return true;
  } catch (error) {
    Logger.error('Failed to initialize task manager database', { error });
    throw error;
  }
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<pg.QueryResult<T>> {
  const activePool = getPool();
  const start = Date.now();

  try {
    const result = await activePool.query<T>(text, params);
    const durationMs = Date.now() - start;

    Logger.debug('DB query executed', {
      text: text.slice(0, 100),
      durationMs,
      rowCount: result.rowCount,
    });

    return result;
  } catch (error) {
    Logger.error('DB query failed', { error, text, params });
    throw error;
  }
}

export async function withTransaction<T>(callback: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const activePool = getPool();
  const client = await activePool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = undefined;
  Logger.info('Task manager database connection closed');
}
