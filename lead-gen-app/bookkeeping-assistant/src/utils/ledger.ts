/**
 * Helper utilities for retrieving ledger data in a deterministic way.
 */

import type { TransactionType } from '../types/bookkeeping.types.js';
import { bookkeepingDb } from '../db/client.js';
import {
  ledgerFromTransactions,
  synthesizeLedger,
  type LedgerEntry,
} from '../ai/generator.js';
import { logger } from './logger.js';

interface LoadLedgerOptions {
  userId?: string;
  startDate?: string;
  endDate?: string;
  fallbackSeed: string;
  fallbackMonths?: number;
}

interface TransactionRow {
  type: TransactionType;
  amount: string;
  category: string;
  transaction_date: string | Date;
  currency?: string;
  exchange_rate?: string | number | null;
}

function normalizeDate(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value;
}

/**
 * Load transactions from the database if available, otherwise synthesize
 * deterministic ledger entries so that downstream tooling has stable input.
 */
export async function loadLedger(options: LoadLedgerOptions): Promise<LedgerEntry[]> {
  const { userId, startDate, endDate, fallbackSeed, fallbackMonths = 6 } = options;

  if (bookkeepingDb.connected) {
    const conditions: string[] = [];
    const params: Array<string | number> = [];
    let index = 1;

    if (userId) {
      conditions.push(`user_id = $${index++}`);
      params.push(userId);
    }

    if (startDate) {
      conditions.push(`transaction_date >= $${index++}`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`transaction_date <= $${index++}`);
      params.push(endDate);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT type,
        amount::numeric::text AS amount,
        category,
        transaction_date,
        currency,
        exchange_rate::numeric::text AS exchange_rate
      FROM bk_transactions
      ${whereClause}
      ORDER BY transaction_date ASC
    `;

    const result = await bookkeepingDb.query<TransactionRow>(query, params);

    if (result.rowCount && result.rows.length) {
      logger.debug('Ledger loaded from database', {
        rows: result.rowCount,
        userId: userId ?? 'anonymous',
        startDate,
        endDate,
      });

      return ledgerFromTransactions(
  result.rows.map((row: TransactionRow) => ({
          type: row.type,
          amount: Number(row.amount),
          category: row.category,
          transaction_date: normalizeDate(row.transaction_date),
          currency: row.currency,
          exchange_rate: row.exchange_rate ? Number(row.exchange_rate) : undefined,
        })),
      );
    }

    logger.debug('Ledger query returned no rows, falling back to synthetic data', {
      userId: userId ?? 'anonymous',
      startDate,
      endDate,
    });
  }

  return synthesizeLedger(fallbackSeed, fallbackMonths);
}
