/**
 * Shared helpers for persisting transactions and recording audit details.
 */

import type { AddTransactionParams, TransactionResult } from '../types/bookkeeping.types.js';
import { bookkeepingDb } from '../db/client.js';
import { recordTransactionAuditLog } from './audit-log.js';
import { logger } from './logger.js';

interface PersistTransactionOptions {
  transaction: TransactionResult;
  params: AddTransactionParams;
  userId?: string | null;
  metadata?: Record<string, unknown>;
  source?: string;
}

interface PersistTransactionResult {
  databaseId?: string;
  metadata: Record<string, unknown>;
}

export async function persistTransactionWithAudit(options: PersistTransactionOptions): Promise<PersistTransactionResult> {
  const { transaction, params } = options;
  const userId = options.userId ?? params.user_id ?? null;

  const metadataPayload: Record<string, unknown> = {
    ...(options.metadata ?? {}),
    deterministic_id: transaction.id,
    normalized_category: transaction.normalized_category,
    base_amount: transaction.base_amount,
    currency: transaction.currency,
    exchange_rate: transaction.exchange_rate,
    base_currency: transaction.base_currency,
    source: options.source ?? 'manual-entry',
  };

  if (!bookkeepingDb.connected) {
    return {
      metadata: metadataPayload,
    };
  }

  try {
    const inserted = await bookkeepingDb.query<{ id: string }>(
      `INSERT INTO bk_transactions (user_id, type, category, description, amount, reference, transaction_date, currency, exchange_rate, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
       RETURNING id`,
      [
        userId,
        transaction.type,
        params.category,
        transaction.description,
        transaction.amount,
        params.reference ?? null,
        params.date,
        transaction.currency ?? 'USD',
        transaction.exchange_rate ?? 1,
        JSON.stringify(metadataPayload),
      ],
    );

    const databaseId = inserted.rows[0]?.id;

    if (databaseId) {
      await recordTransactionAuditLog({
        transactionId: databaseId,
        userId: userId ?? 'system',
        changes: {
          operation: 'create',
          values: {
            type: transaction.type,
            category: params.category,
            amount: transaction.amount,
            base_amount: transaction.base_amount,
            currency: transaction.currency,
            exchange_rate: transaction.exchange_rate,
            base_currency: transaction.base_currency,
            description: transaction.description,
            reference: params.reference ?? null,
            transaction_date: params.date,
            source: options.source ?? 'manual-entry',
          },
        },
      });
    }

    return {
      databaseId,
      metadata: metadataPayload,
    };
  } catch (error: any) {
    logger.error('Failed to persist transaction', {
      userId,
      type: transaction.type,
      error: error.message,
    });

    return {
      metadata: metadataPayload,
    };
  }
}
