/**
 * MCP Tool: Add Transaction
 * Add income or expense transactions to bookkeeping records
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { createTransactionRecord } from '../ai/generator.js';
import { logger } from '../utils/logger.js';
import { persistTransactionWithAudit } from '../utils/transactions.js';
import type { AddTransactionParams, TransactionResult } from '../types/bookkeeping.types.js';

export const addTransactionTool: Tool = {
  name: 'add_transaction',
  description: `Add income or expense transactions to your bookkeeping records.

Records financial transactions with proper categorization for accurate bookkeeping.

Required parameters:
- type: Transaction type (income, expense, transfer)
- amount: Transaction amount (positive number)
- description: Description of the transaction
- category: Category for the transaction (expense or income category)
- date: Transaction date in YYYY-MM-DD format

Optional parameters:
- reference: Reference number or ID
- user_id: User ID for multi-tenant support

Returns:
- id: Unique transaction ID
- type: Transaction type
- amount: Transaction amount
- description: Transaction description
- category: Transaction category
- date: Transaction date
- reference: Reference (if provided)

Example:
{
  "type": "expense",
  "amount": 150.00,
  "description": "Office supplies purchase",
  "category": "office_supplies",
  "date": "2024-01-15",
  "reference": "INV-001"
}`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (optional)' },
      type: {
        type: 'string',
        enum: ['income', 'expense', 'transfer'],
        description: 'Transaction type',
      },
      amount: { type: 'number', description: 'Transaction amount' },
      description: { type: 'string', description: 'Transaction description' },
      category: { type: 'string', description: 'Transaction category' },
      date: { type: 'string', description: 'Transaction date (YYYY-MM-DD)' },
      reference: { type: 'string', description: 'Reference number (optional)' },
      currency: { type: 'string', description: 'Currency code (optional, defaults to USD)' },
      exchange_rate: { type: 'number', description: 'Exchange rate to USD (optional)' },
      base_currency: { type: 'string', description: 'Base currency for reporting (optional)' },
    },
    required: ['type', 'amount', 'description', 'category', 'date'],
  },
};

export async function handleAddTransaction(args: unknown, userId?: string) {
  const startTime = Date.now();

  try {
    // Validate parameters
    const params = args as AddTransactionParams;

    logger.info('Adding transaction', {
      userId: params.user_id || userId,
      type: params.type,
      amount: params.amount,
      category: params.category,
      currency: params.currency ?? 'USD',
    });

    const transaction: TransactionResult = createTransactionRecord({
      ...params,
      user_id: params.user_id || userId,
    });

    const persistence = await persistTransactionWithAudit({
      transaction,
      params: {
        ...params,
        user_id: params.user_id || userId,
      },
      userId: params.user_id || userId || null,
      metadata: transaction.metadata ?? {},
      source: 'tool:add_transaction',
    });

    transaction.metadata = {
      ...(transaction.metadata ?? {}),
      ...persistence.metadata,
      ...(persistence.databaseId ? { database_id: persistence.databaseId } : {}),
    };

    const duration = Date.now() - startTime;

    logger.info('Transaction added successfully', {
      userId: params.user_id || userId,
      transactionId: transaction.id,
      durationMs: duration,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              transaction,
              metadata: {
                type: params.type,
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

    logger.error('add_transaction tool failed', {
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
              tool: 'add_transaction',
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
