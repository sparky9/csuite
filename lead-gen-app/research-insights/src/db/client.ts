/**
 * PostgreSQL client for Research Insights.
 */

import pg from 'pg';
import { logger, logError } from '../utils/logger.js';

const { Pool } = pg;

class DatabaseClient {
  private pool: pg.Pool | null = null;
  private isConnected = false;

  async connect(): Promise<void> {
    if (this.isConnected && this.pool) {
      logger.debug('Database already connected');
      return;
    }

    const env = (globalThis as any)?.process?.env ?? {};
    const databaseUrl = env.DATABASE_URL as string | undefined;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    try {
      this.pool = new Pool({
        connectionString: databaseUrl,
        ssl: databaseUrl.includes('neon.tech') || databaseUrl.includes('amazonaws.com')
          ? { rejectUnauthorized: false }
          : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
      });

      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      logger.info('Research Insights database connected successfully');
    } catch (error) {
      logError('Research Insights database connection failed', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.pool) {
      return;
    }

    try {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
      logger.info('Research Insights database disconnected');
    } catch (error) {
      logError('Failed to disconnect Research Insights database', error);
    }
  }

  async query<T extends pg.QueryResultRow = any>(text: string, params?: any[]): Promise<pg.QueryResult<T>> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    try {
      const start = Date.now();
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;

      logger.debug('Query executed', {
        query: text.substring(0, 100),
        params: params?.length || 0,
        rows: result.rowCount,
        duration
      });

      return result;
    } catch (error) {
      logError('Query execution failed', error, { query: text, params });
      throw error;
    }
  }
}

export const db = new DatabaseClient();

export type { QueryResult, PoolClient } from 'pg';
