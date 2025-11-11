/**
 * PostgreSQL client for Social Media Manager
 * Mirrors the shared connection pattern used by other MCP modules.
 */

import pg from 'pg';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

class SocialDatabaseClient {
  private pool: pg.Pool | null = null;
  private isConnected = false;

  async connect(connectionString: string): Promise<void> {
    if (this.isConnected && this.pool) {
      logger.debug('Database already connected');
      return;
    }

    try {
      this.pool = new Pool({
        connectionString,
        ssl: connectionString.includes('neon.tech')
          ? { rejectUnauthorized: false }
          : undefined,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      logger.info('Social media database connected');
    } catch (error) {
      logger.error('Social media database connection failed', { error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.pool) {
      return;
    }

    await this.pool.end();
    this.pool = null;
    this.isConnected = false;
    logger.info('Social media database disconnected');
  }

  async query<T extends pg.QueryResultRow = any>(
    text: string,
    params?: any[],
  ): Promise<pg.QueryResult<T>> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    return this.pool.query<T>(text, params);
  }

  async queryOne<T extends pg.QueryResultRow = any>(
    text: string,
    params?: any[],
  ): Promise<T | null> {
    const result = await this.query<T>(text, params);
    return result.rows[0] ?? null;
  }

  get connected(): boolean {
    return this.isConnected;
  }
}

export const socialDb = new SocialDatabaseClient();

export async function initializeSocialDb(connectionString?: string): Promise<boolean> {
  const dbUrl = connectionString || process.env.DATABASE_URL;
  if (!dbUrl) {
    logger.warn('DATABASE_URL not set. Social media data will be in-memory only.');
    return false;
  }

  try {
    await socialDb.connect(dbUrl);
    return true;
  } catch (error) {
    logger.error('Failed to initialize social media database', { error });
    return false;
  }
}

export async function shutdownSocialDb(): Promise<void> {
  if (!socialDb.connected) {
    return;
  }
  await socialDb.disconnect();
}
