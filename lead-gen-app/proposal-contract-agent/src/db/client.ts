import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import process from 'process';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

let pool: Pool | null = null;

export async function initializeProposalContractDb(): Promise<boolean> {
  if (pool) {
    return true;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Add it to your environment before starting the server.');
  }

  pool = new Pool({ connectionString });
  await pool.query('SELECT 1');
  return true;
}

export function getDbPool(): Pool {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeProposalContractDb first.');
  }
  return pool;
}

export async function withTransaction<T>(handler: (client: PoolClient) => Promise<T>): Promise<T> {
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

export async function shutdownProposalContractDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
