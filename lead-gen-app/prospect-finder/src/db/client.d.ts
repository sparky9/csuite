/**
 * PostgreSQL client for Neon database with connection pooling
 */
import pg from 'pg';
export declare class DatabaseClient {
    private static instance;
    private pool;
    private constructor();
    static getInstance(): DatabaseClient;
    /**
     * Initialize connection pool to Neon PostgreSQL
     */
    connect(connectionString: string): Promise<void>;
    /**
     * Ensure required extensions are installed
     */
    private ensureExtensions;
    /**
     * Execute a query with optional parameters
     */
    query<T extends pg.QueryResultRow = any>(text: string, params?: any[]): Promise<pg.QueryResult<T>>;
    /**
     * Execute a query and return a single row
     */
    queryOne<T extends pg.QueryResultRow = any>(text: string, params?: any[]): Promise<T | null>;
    /**
     * Execute multiple queries in a transaction
     */
    transaction<T>(callback: (client: pg.PoolClient) => Promise<T>): Promise<T>;
    /**
     * Check database health
     */
    healthCheck(): Promise<{
        connected: boolean;
        latency_ms: number;
        pool_stats: {
            total: number;
            idle: number;
            waiting: number;
        };
    }>;
    /**
     * Close all database connections
     */
    disconnect(): Promise<void>;
    /**
     * Get the raw pool instance (for advanced use cases)
     */
    getPool(): pg.Pool;
}
export declare const db: DatabaseClient;
//# sourceMappingURL=client.d.ts.map