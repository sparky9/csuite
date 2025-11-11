/**
 * PostgreSQL client helper for the calendar meeting agent.
 */

import pg from 'pg';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

class CalendarDatabaseClient {
  private pool: pg.Pool | null = null;
  private isConnected = false;

  async connect(connectionString: string, useSsl: boolean): Promise<void> {
    if (this.pool && this.isConnected) {
      logger.debug('Calendar DB already connected');
      return;
    }

    try {
      this.pool = new Pool({
        connectionString,
        ssl: useSsl ? { rejectUnauthorized: false } : undefined,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      logger.info('Calendar database connection established');
    } catch (error) {
      logger.error('Failed to connect to calendar database', { error });
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
    logger.info('Calendar database connection closed');
  }

  async query<T extends pg.QueryResultRow = any>(sql: string, params?: any[]): Promise<pg.QueryResult<T>> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    return this.pool.query<T>(sql, params);
  }

  get connected(): boolean {
    return this.isConnected;
  }
}

export const calendarDb = new CalendarDatabaseClient();

export async function initializeCalendarDb(connectionString?: string, sslFlag?: string): Promise<boolean> {
  const dbUrl = connectionString || process.env.DATABASE_URL;
  if (!dbUrl) {
    logger.warn('DATABASE_URL not set. Calendar data will be ephemeral.');
    return false;
  }

  const useSsl = (sslFlag ?? process.env.DATABASE_SSL ?? 'true').toLowerCase() === 'true';

  try {
    await calendarDb.connect(dbUrl, useSsl);
    return true;
  } catch (error) {
    logger.error('Calendar DB initialization failed', { error });
    return false;
  }
}

export async function shutdownCalendarDb(): Promise<void> {
  if (!calendarDb.connected) {
    return;
  }

  await calendarDb.disconnect();
}
