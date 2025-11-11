/**
 * MCP Tool: Reconcile Accounts
 * Reconcile bank statements with recorded transactions
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';
import { bookkeepingDb } from '../db/client.js';

export const reconcileAccountsTool: Tool = {
  name: 'reconcile_accounts',
  description: `Reconcile bank statements with recorded transactions.

Compares bank statement entries with recorded transactions to identify discrepancies and ensure accuracy.

Required parameters:
- bank_statement: Array of bank statement entries
- recorded_transactions: Array of recorded transactions

Optional parameters:
- user_id: User ID for multi-tenant support

Returns:
- matched_transactions: Transactions that match between bank and records
- unmatched_bank: Bank entries not found in records
- unmatched_records: Recorded transactions not found in bank
- discrepancies: Potential issues or adjustments needed
- reconciliation_status: Overall reconciliation status

Example:
{
  "bank_statement": [
    {"date": "2024-01-15", "description": "Office supplies", "amount": -45.67},
    {"date": "2024-01-16", "description": "Client payment", "amount": 1500.00}
  ],
  "recorded_transactions": [
    {"date": "2024-01-15", "description": "Office supplies purchase", "amount": 45.67, "category": "office_supplies"},
    {"date": "2024-01-16", "description": "Invoice payment", "amount": 1500.00, "category": "service_revenue"}
  ]
}`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (optional)' },
      bank_statement: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string' },
            description: { type: 'string' },
            amount: { type: 'number' },
          },
          required: ['date', 'description', 'amount'],
        },
        description: 'Bank statement entries',
      },
      recorded_transactions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string' },
            description: { type: 'string' },
            amount: { type: 'number' },
            category: { type: 'string' },
          },
          required: ['date', 'description', 'amount'],
        },
        description: 'Recorded transactions',
      },
    },
    required: ['bank_statement', 'recorded_transactions'],
  },
};

export async function handleReconcileAccounts(args: unknown, userId?: string) {
  const startTime = Date.now();

  try {
    // Validate parameters
    const params = args as {
      bank_statement: Array<{ date: string; description: string; amount: number }>;
      recorded_transactions: Array<{ date: string; description: string; amount: number; category?: string }>;
      user_id?: string;
    };

    logger.info('Reconciling accounts', {
      userId: params.user_id || userId,
      bankEntries: params.bank_statement.length,
      recordedTransactions: params.recorded_transactions.length,
    });

    // Simple reconciliation logic (in real implementation, would use more sophisticated matching)
    const matched: Array<{ bank: any; record: any; match_type: string }> = [];
    const unmatchedBank: Array<{ entry: any; reason: string }> = [];
    const unmatchedRecords: Array<{ entry: any; reason: string }> = [];

    // Create maps for faster lookup
    const bankMap = new Map();
    const recordMap = new Map();

    params.bank_statement.forEach((entry, index) => {
      const key = `${entry.date}_${entry.amount}_${entry.description.toLowerCase().trim()}`;
      bankMap.set(key, { ...entry, index });
    });

    params.recorded_transactions.forEach((entry, index) => {
      const key = `${entry.date}_${entry.amount}_${entry.description.toLowerCase().trim()}`;
      recordMap.set(key, { ...entry, index });
    });

    // Find matches
    for (const [key, bankEntry] of bankMap) {
      if (recordMap.has(key)) {
        matched.push({
          bank: bankEntry,
          record: recordMap.get(key),
          match_type: 'exact'
        });
        recordMap.delete(key);
      } else {
        unmatchedBank.push({
          entry: bankEntry,
          reason: 'No matching recorded transaction found'
        });
      }
    }

    // Remaining records are unmatched
    for (const [key, recordEntry] of recordMap) {
      unmatchedRecords.push({
        entry: recordEntry,
        reason: 'No matching bank entry found'
      });
    }

    // Calculate totals
    const bankTotal = params.bank_statement.reduce((sum, entry) => sum + entry.amount, 0);
    const recordTotal = params.recorded_transactions.reduce((sum, entry) => sum + entry.amount, 0);
    const difference = bankTotal - recordTotal;

    const reconciliationStatus = Math.abs(difference) < 0.01 ? 'balanced' : 'discrepancy_found';

    const discrepancies: string[] = [];
    if (Math.abs(difference) >= 0.01) {
      discrepancies.push(`Difference of $${difference.toFixed(2)} between bank and records`);
    }
    if (unmatchedBank.length > 0) {
      discrepancies.push(`${unmatchedBank.length} bank entries not matched`);
    }
    if (unmatchedRecords.length > 0) {
      discrepancies.push(`${unmatchedRecords.length} recorded transactions not matched`);
    }

    const result = {
      matched_transactions: matched,
      unmatched_bank: unmatchedBank,
      unmatched_records: unmatchedRecords,
      discrepancies,
      reconciliation_status: reconciliationStatus,
      totals: {
        bank_total: bankTotal,
        record_total: recordTotal,
        difference: difference
      },
      metadata: undefined as { database_id: string } | undefined,
    };

    if (bookkeepingDb.connected) {
      const inserted = await bookkeepingDb.query<{ id: string }>(
        `INSERT INTO bk_reconciliations (user_id, reconciliation_status, totals, discrepancies, matched, unmatched_bank, unmatched_records)
         VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, $6::jsonb, $7::jsonb)
         RETURNING id`,
        [
          params.user_id || userId || null,
          reconciliationStatus,
          JSON.stringify(result.totals),
          discrepancies,
          JSON.stringify(matched),
          JSON.stringify(unmatchedBank),
          JSON.stringify(unmatchedRecords),
        ],
      );

      if (inserted.rows[0]?.id) {
        result.metadata = { database_id: inserted.rows[0].id };
      }
    }

    const duration = Date.now() - startTime;

    logger.info('Accounts reconciled successfully', {
      userId: params.user_id || userId,
      status: reconciliationStatus,
      matched: matched.length,
      unmatchedBank: unmatchedBank.length,
      unmatchedRecords: unmatchedRecords.length,
      durationMs: duration,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              reconciliation: result,
              metadata: {
                bank_entries: params.bank_statement.length,
                recorded_transactions: params.recorded_transactions.length,
                generation_time_ms: duration,
                database_id: result.metadata?.database_id,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error('reconcile_accounts tool failed', {
      error: error.message,
      durationMs: duration,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: error.message,
              tool: 'reconcile_accounts',
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}
