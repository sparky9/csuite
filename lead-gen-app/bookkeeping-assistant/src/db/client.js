/**
 * PostgreSQL client for Bookkeeping Assistant
 * Mirrors the shared connection pattern used across MCP modules.
 */
import pg from 'pg';
import { logger } from '../utils/logger.js';
const { Pool } = pg;
class BookkeepingDatabaseClient {
    pool = null;
    isConnected = false;
    async connect(connectionString) {
        if (this.isConnected && this.pool) {
            logger.debug('Bookkeeping database already connected');
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
            logger.info('Bookkeeping database connected');
        }
        catch (error) {
            logger.error('Bookkeeping database connection failed', { error });
            throw error;
        }
    }
    async disconnect() {
        if (!this.pool) {
            return;
        }
        await this.pool.end();
        this.pool = null;
        this.isConnected = false;
        logger.info('Bookkeeping database disconnected');
    }
    async query(text, params) {
        if (!this.pool) {
            throw new Error('Database not connected');
        }
        return this.pool.query(text, params);
    }
    async queryOne(text, params) {
        const result = await this.query(text, params);
        return result.rows[0] ?? null;
    }
    get connected() {
        return this.isConnected;
    }
}
export const bookkeepingDb = new BookkeepingDatabaseClient();
export async function initializeBookkeepingDb(connectionString) {
    const dbUrl = connectionString || process.env.DATABASE_URL;
    if (!dbUrl) {
        logger.warn('DATABASE_URL not set. Bookkeeping data will be stored in memory only.');
        return false;
    }
    try {
        await bookkeepingDb.connect(dbUrl);
        return true;
    }
    catch (error) {
        logger.error('Failed to initialize bookkeeping database', { error });
        return false;
    }
}
export async function shutdownBookkeepingDb() {
    if (!bookkeepingDb.connected) {
        return;
    }
    await bookkeepingDb.disconnect();
}
