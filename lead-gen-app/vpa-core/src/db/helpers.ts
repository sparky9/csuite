/**
 * Database Helper Functions
 *
 * Convenience wrappers for common database operations.
 */

import { db } from './client.js';
import type { QueryResult } from 'pg';

/**
 * Query and return a single row (or null if not found)
 */
export async function queryOne<T = any>(
  text: string,
  params?: any[]
): Promise<T | null> {
  const result = await db.query<T>(text, params);
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Query and return all rows
 */
export async function queryAll<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const result = await db.query<T>(text, params);
  return result.rows;
}

/**
 * Execute query and return row count
 */
export async function execute(
  text: string,
  params?: any[]
): Promise<number> {
  const result = await db.query(text, params);
  return result.rowCount || 0;
}

/**
 * Check if a record exists
 */
export async function exists(
  text: string,
  params?: any[]
): Promise<boolean> {
  const result = await db.query(text, params);
  return result.rowCount !== null && result.rowCount > 0;
}
