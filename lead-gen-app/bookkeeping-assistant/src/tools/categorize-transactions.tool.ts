/**
 * MCP Tool: Categorize Transactions
 * AI-powered categorization of transactions for better organization
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { categorizeTransactions } from '../ai/generator.js';
import { logger } from '../utils/logger.js';
import { bookkeepingDb } from '../db/client.js';
import type { CategorizedTransactionSuggestion } from '../types/bookkeeping.types.js';

export const categorizeTransactionsTool: Tool = {
  name: 'categorize_transactions',
  description: `AI-powered categorization of transactions for better organization.

Uses AI to suggest appropriate categories for transactions based on descriptions and amounts.

Required parameters:
- transactions: Array of transaction descriptions to categorize

Optional parameters:
- user_id: User ID for multi-tenant support

Returns:
- categorized_transactions: Array of transactions with suggested categories
- confidence_scores: AI confidence in each categorization
- recommendations: Suggestions for new categories if needed

Example:
{
  "transactions": [
    "Office supplies from Amazon - $45.67",
    "Software subscription payment - $29.99",
    "Client payment received - $1500.00"
  ]
}`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (optional)' },
      transactions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of transaction descriptions',
      },
    },
    required: ['transactions'],
  },
};

export async function handleCategorizeTransactions(args: unknown, userId?: string) {
  const startTime = Date.now();

  try {
    // Validate parameters
    const params = args as { transactions: string[]; user_id?: string };

    logger.info('Categorizing transactions', {
      userId: params.user_id || userId,
      transactionCount: params.transactions.length,
    });

    const suggestions: CategorizedTransactionSuggestion[] = categorizeTransactions(params.transactions);

    if (bookkeepingDb.connected) {
      const persisted = await Promise.all(
        suggestions.map(suggestion =>
          bookkeepingDb.query<{ id: string }>(
            `INSERT INTO bk_categorization_suggestions (user_id, raw_transaction, suggested_category, confidence, reasoning)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [
              params.user_id || userId || null,
              suggestion.raw,
              suggestion.category,
              suggestion.confidence,
              suggestion.reasoning,
            ],
          ),
        ),
      );

      persisted.forEach((row, index) => {
        if (row.rows[0]?.id) {
          suggestions[index].metadata = {
            database_id: row.rows[0].id,
          };
        }
      });
    }

    const duration = Date.now() - startTime;

    logger.info('Transactions categorized successfully', {
      userId: params.user_id || userId,
      durationMs: duration,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              categorized_transactions: suggestions,
              metadata: {
                transaction_count: params.transactions.length,
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

    logger.error('categorize_transactions tool failed', {
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
              tool: 'categorize_transactions',
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
