import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import pg from 'pg';
import { newDb, type IMemoryDb } from 'pg-mem';
import { logger } from '../utils/logger.js';

const { Pool } = pg;
type PoolConstructor = typeof Pool;
const SCHEMA_PATH = path.resolve(process.cwd(), 'src', 'db', 'schema.sql');

export interface TransactionContext {
  client: pg.PoolClient;
  done: () => Promise<void>;
}

function createMemoryPool(memoryDb: IMemoryDb): pg.Pool {
  const adapter = memoryDb.adapters.createPg() as unknown;
  if (!adapter || typeof adapter !== 'object') {
    throw new Error('pg-mem adapter did not return a valid adapter object');
  }

  const maybePool = (adapter as Record<string, unknown>).Pool;
  if (typeof maybePool !== 'function') {
    throw new Error('pg-mem adapter did not expose a Pool constructor');
  }

  const MemoryPool = maybePool as PoolConstructor;
  return new MemoryPool();
}

class DatabaseClient {
  private pool: pg.Pool | null = null;
  private inMemoryDb: IMemoryDb | null = null;

  async connect(): Promise<void> {
    if (this.pool) {
      return;
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      logger.warn('DATABASE_URL not set. Falling back to in-memory pg-mem instance.');
      const memoryDb = newDb({ autoCreateForeignKeyIndices: true });
      this.pool = createMemoryPool(memoryDb);
      this.inMemoryDb = memoryDb;
      await this.applySchema();
      logger.info('Reputation database using in-memory storage');
      return;
    }

    this.pool = new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('neon.tech') || databaseUrl.includes('amazonaws.com')
        ? { rejectUnauthorized: false }
        : false
    });

    const client = await this.pool.connect();
    try {
      await client.query('SELECT NOW()');
      logger.info('Reputation database connected');
    } finally {
      client.release();
    }
  }

  async disconnect(): Promise<void> {
    if (!this.pool) {
      return;
    }

    await this.pool.end();
    this.pool = null;
    logger.info('Reputation database disconnected');
  }

  async query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params?: ReadonlyArray<unknown>
  ): Promise<pg.QueryResult<T>> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    const start = Date.now();
  const values = params ? [...params] : undefined;
  const queryConfig: pg.QueryConfig<unknown[]> = { text, values };
  const result = await this.pool.query<T>(queryConfig);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text: text.slice(0, 80), duration, rows: result.rowCount });
    return result;
  }

  async withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async applySchema(): Promise<void> {
    if (!this.pool) {
      return;
    }

    try {
      const schemaPath = await this.resolveSchemaPath();
      let schemaSql = await fs.readFile(schemaPath, 'utf-8');

      if (this.inMemoryDb) {
        schemaSql = schemaSql.replace(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+pgcrypto;?/gi, '-- skipped pgcrypto for pg-mem');
      }
      const client = await this.pool.connect();
      try {
        await client.query(schemaSql);
        logger.info('Applied database schema', { inMemory: this.inMemoryDb !== null });
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Failed to apply database schema', {
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  private async resolveSchemaPath(): Promise<string> {
    await fs.access(SCHEMA_PATH);
    return SCHEMA_PATH;
  }
}

export const db = new DatabaseClient();

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: ReadonlyArray<unknown>
): Promise<pg.QueryResult<T>> {
  return db.query<T>(text, params);
}

export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  return db.withTransaction(fn);
}
