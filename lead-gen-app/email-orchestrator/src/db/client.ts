/**
 * PostgreSQL client for Neon database with connection pooling
 * Uses same database as ProspectFinder and LeadTracker Pro
 */

import pg from 'pg';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

export class DatabaseClient {
  private static instance: DatabaseClient;
  private pool: pg.Pool | null = null;

  private constructor() {}

  public static getInstance(): DatabaseClient {
    if (!DatabaseClient.instance) {
      DatabaseClient.instance = new DatabaseClient();
    }
    return DatabaseClient.instance;
  }

  /**
   * Initialize connection pool to Neon PostgreSQL
   */
  public async connect(connectionString: string): Promise<void> {
    if (this.pool) {
      logger.warn('Database already connected');
      return;
    }

    try {
      this.pool = new Pool({
        connectionString,
        ssl: {
          rejectUnauthorized: false, // Neon requires SSL
        },
        max: 10, // Maximum pool size
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      // Test connection
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
      client.release();

      logger.info('Database connected successfully', {
        timestamp: result.rows[0].current_time,
        version: result.rows[0].pg_version.split(' ')[1], // Extract version number
      });

      // Check for required extensions
      await this.ensureExtensions();
    } catch (error) {
      logger.error('Database connection failed', { error });
      throw new Error(`Failed to connect to database: ${error}`);
    }
  }

  /**
   * Ensure required extensions are installed
   */
  private async ensureExtensions(): Promise<void> {
    try {
      await this.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      logger.info('Database extensions verified (uuid-ossp)');
    } catch (error) {
      logger.error('Failed to create extensions', { error });
      throw error;
    }
  }

  /**
   * Execute a query with optional parameters
   */
  public async query<T extends pg.QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<pg.QueryResult<T>> {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }

    const start = Date.now();
    try {
      const result = await this.pool.query<T>(text, params);
      const duration = Date.now() - start;

      logger.debug('Query executed', {
        duration_ms: duration,
        rows_affected: result.rowCount,
      });

      return result;
    } catch (error) {
      logger.error('Query failed', { error, query: text });
      throw error;
    }
  }

  /**
   * Execute a query and return a single row
   */
  public async queryOne<T extends pg.QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<T | null> {
    const result = await this.query<T>(text, params);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Execute multiple queries in a transaction
   */
  public async transaction<T>(
    callback: (client: pg.PoolClient) => Promise<T>
  ): Promise<T> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      logger.debug('Transaction committed');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction rolled back', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check database health
   */
  public async healthCheck(): Promise<{
    connected: boolean;
    latency_ms: number;
    pool_stats: {
      total: number;
      idle: number;
      waiting: number;
    };
  }> {
    if (!this.pool) {
      return {
        connected: false,
        latency_ms: -1,
        pool_stats: { total: 0, idle: 0, waiting: 0 },
      };
    }

    const start = Date.now();
    try {
      await this.pool.query('SELECT 1');
      const latency = Date.now() - start;

      return {
        connected: true,
        latency_ms: latency,
        pool_stats: {
          total: this.pool.totalCount,
          idle: this.pool.idleCount,
          waiting: this.pool.waitingCount,
        },
      };
    } catch (error) {
      logger.error('Health check failed', { error });
      return {
        connected: false,
        latency_ms: -1,
        pool_stats: { total: 0, idle: 0, waiting: 0 },
      };
    }
  }

  /**
   * Close all database connections
   */
  public async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('Database disconnected');
    }
  }

  /**
   * Get the raw pool instance (for advanced use cases)
   */
  public getPool(): pg.Pool {
    if (!this.pool) {
      throw new Error('Database not connected');
    }
    return this.pool;
  }
}

// Export singleton instance
export const db = DatabaseClient.getInstance();
