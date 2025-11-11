import path from 'path';
import dotenv from 'dotenv';
import pg from 'pg';

const { Pool } = pg;

let pool: any = null;

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export async function initializeRetentionDb(): Promise<void> {
  if (pool) {
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Add it to your environment before starting the server.');
  }

  pool = new Pool({ connectionString });
  await pool.query('SELECT 1');
}

export function getDbPool(): any {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeRetentionDb first.');
  }
  return pool;
}

export async function withTransaction<T>(handler: (client: any) => Promise<T>): Promise<T> {
  const client = await getDbPool().connect();
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
}

export async function shutdownRetentionDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
