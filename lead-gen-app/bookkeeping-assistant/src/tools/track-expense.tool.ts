/**
 * MCP Tool: Track Expense
 * Track business expenses with categories and receipts
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';
import { createExpenseRecord } from '../ai/generator.js';
import { bookkeepingDb } from '../db/client.js';
import type { TrackExpenseParams, ExpenseResult, TransactionResult, AddTransactionParams } from '../types/bookkeeping.types.js';
import { persistTransactionWithAudit } from '../utils/transactions.js';

export const trackExpenseTool: Tool = {
  name: 'track_expense',
  description: `Track business expenses with categories, receipts, and notes for tax purposes.

Records detailed expense information for accurate bookkeeping and tax preparation.

Required parameters:
- amount: Expense amount (positive number)
- description: Description of the expense
- category: Expense category (office_supplies, software, marketing, travel, meals, utilities, professional_services, other)
- date: Expense date in YYYY-MM-DD format

Optional parameters:
- receipt_url: URL to receipt image or document
- notes: Additional notes about the expense
- user_id: User ID for multi-tenant support

Returns:
- id: Unique expense ID
- amount: Expense amount
- description: Expense description
- category: Expense category
- date: Expense date
- receipt_url: Receipt URL (if provided)
- notes: Notes (if provided)

Example:
{
  "amount": 45.99,
  "description": "Software subscription",
  "category": "software",
  "date": "2024-01-20",
  "receipt_url": "https://example.com/receipt.pdf",
  "notes": "Monthly Adobe subscription"
}`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (optional)' },
      amount: { type: 'number', description: 'Expense amount' },
      description: { type: 'string', description: 'Expense description' },
      category: {
        type: 'string',
        enum: ['office_supplies', 'software', 'marketing', 'travel', 'meals', 'utilities', 'professional_services', 'other'],
        description: 'Expense category',
      },
      date: { type: 'string', description: 'Expense date (YYYY-MM-DD)' },
      receipt_url: { type: 'string', description: 'Receipt URL (optional)' },
      notes: { type: 'string', description: 'Additional notes (optional)' },
      currency: { type: 'string', description: 'Currency code (optional, defaults to USD)' },
      exchange_rate: { type: 'number', description: 'Exchange rate to USD (optional)' },
      base_currency: { type: 'string', description: 'Base currency for reporting (optional)' },
    },
    required: ['amount', 'description', 'category', 'date'],
  },
};

export async function handleTrackExpense(args: unknown, userId?: string) {
  const startTime = Date.now();

  try {
    // Validate parameters
    const params = args as TrackExpenseParams;

    logger.info('Tracking expense', {
      userId: params.user_id || userId,
      amount: params.amount,
      category: params.category,
      description: params.description,
      currency: params.currency ?? 'USD',
    });

    const { transaction, expense } = createExpenseRecord({
      ...params,
      user_id: params.user_id || userId,
    });

    const transactionParams: AddTransactionParams = {
      type: 'expense',
      amount: params.amount,
      description: params.description,
      category: params.category,
      date: params.date,
      reference: params.receipt_url,
      user_id: params.user_id || userId,
      currency: params.currency,
      exchange_rate: params.exchange_rate,
      base_currency: params.base_currency,
    };

    const persistence = await persistTransactionWithAudit({
      transaction,
      params: transactionParams,
      userId: params.user_id || userId || null,
      metadata: transaction.metadata ?? {},
      source: 'tool:track_expense',
    });

    transaction.metadata = {
      ...(transaction.metadata ?? {}),
      ...persistence.metadata,
      ...(persistence.databaseId ? { database_id: persistence.databaseId } : {}),
    };

    if (bookkeepingDb.connected && persistence.databaseId) {
      const expenseInsert = await bookkeepingDb.query<{ id: string }>(
        `INSERT INTO bk_expenses (transaction_id, receipt_url, notes)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [
          persistence.databaseId,
          params.receipt_url ?? null,
          params.notes ?? null,
        ],
      );

      if (expenseInsert.rows[0]?.id) {
        expense.metadata = {
          ...(expense.metadata ?? {}),
          database_id: expenseInsert.rows[0].id,
          transaction_database_id: persistence.databaseId,
        };
      }
    }

    const duration = Date.now() - startTime;

    logger.info('Expense tracked successfully', {
      userId: params.user_id || userId,
      expenseId: expense.id,
      amount: params.amount,
      durationMs: duration,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              expense,
              transaction,
              metadata: {
                category: params.category,
                amount: params.amount,
                generation_time_ms: duration,
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

    logger.error('track_expense tool failed', {
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
              tool: 'track_expense',
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
