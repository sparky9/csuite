import { Pool, PoolClient } from 'pg';
import { getEnv } from '../utils/env.js';

let pool: Pool | null = null;

export const getPool = (): Pool => {
  if (!pool) {
    pool = new Pool({
      connectionString: getEnv('DATABASE_URL'),
      max: Number(getEnv('PG_POOL_MAX', '10')),
      idleTimeoutMillis: Number(getEnv('PG_IDLE_TIMEOUT_MS', '10000')),
      connectionTimeoutMillis: Number(getEnv('PG_CONNECTION_TIMEOUT_MS', '10000')),
    });
  }

  return pool;
};

export const withTransaction = async <T>(handler: (client: PoolClient) => Promise<T>): Promise<T> => {
  const poolInstance = getPool();
  const client = await poolInstance.connect();

  try {
    await client.query('BEGIN');
    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const initializeOnboardingDb = async () => {
  getPool();
};

export const shutdownOnboardingDb = async () => {
  if (pool) {
    await pool.end();
    pool = null;
  }
};
