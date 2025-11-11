/**
 * Database Client
 *
 * PostgreSQL connection singleton for VPA Core.
 * Provides connection pooling and graceful shutdown.
 */

import pg from 'pg';
import { logger, logError } from '../utils/logger.js';
import { DatabaseError, ConfigurationError } from '../utils/errors.js';

const { Pool } = pg;

/**
 * Database client singleton
 */
class DatabaseClient {
  private pool: pg.Pool | null = null;
  private isConnected: boolean = false;

  /**
   * Initialize database connection pool
   */
  async connect(): Promise<void> {
    if (this.isConnected && this.pool) {
      logger.debug('Database already connected');
      return;
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new ConfigurationError(
        'DATABASE_URL',
        'DATABASE_URL environment variable is not set'
      );
    }

    try {
      this.pool = new Pool({
        connectionString: databaseUrl,
        ssl: databaseUrl.includes('neon.tech') || databaseUrl.includes('amazonaws.com')
          ? { rejectUnauthorized: false }
          : false,
        max: 20, // Maximum number of clients in pool
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      logger.info('Database connected successfully');
    } catch (error) {
      logError('Database connection failed', error);
      throw new DatabaseError('connect', error as Error);
    }
  }

  /**
   * Disconnect from database (graceful shutdown)
   */
  async disconnect(): Promise<void> {
    if (!this.pool) {
      return;
    }

    try {
      await this.pool.end();
      this.isConnected = false;
      this.pool = null;
      logger.info('Database disconnected');
    } catch (error) {
      logError('Database disconnect failed', error);
    }
  }

  /**
   * Execute a query
   */
  async query<T extends pg.QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<pg.QueryResult<T>> {
    if (!this.pool) {
      throw new DatabaseError('query', new Error('Database not connected'));
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
      throw new DatabaseError('query', error as Error);
    }
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(
    callback: (client: pg.PoolClient) => Promise<T>
  ): Promise<T> {
    if (!this.pool) {
      throw new DatabaseError('transaction', new Error('Database not connected'));
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logError('Transaction failed and rolled back', error);
      throw new DatabaseError('transaction', error as Error);
    } finally {
      client.release();
    }
  }

  /**
   * Get a client from the pool (for advanced usage)
   */
  async getClient(): Promise<pg.PoolClient> {
    if (!this.pool) {
      throw new DatabaseError('getClient', new Error('Database not connected'));
    }

    return this.pool.connect();
  }

  /**
   * Check if database is connected
   */
  isHealthy(): boolean {
    return this.isConnected && this.pool !== null;
  }

  /**
   * Ping database to verify connection
   */
  async ping(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Singleton instance
 */
export const db = new DatabaseClient();

/**
 * Initialize database connection (call this on startup)
 */
export async function initializeDatabase(): Promise<void> {
  await db.connect();
}

/**
 * Gracefully shutdown database (call this on process exit)
 */
export async function shutdownDatabase(): Promise<void> {
  await db.disconnect();
}

/**
 * Export types for convenience
 */
export type { QueryResult, PoolClient } from 'pg';
