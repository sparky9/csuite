/**
 * MCP Tool: Calculate Tax
 * Calculate estimated taxes based on income, expenses, and deductions
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';
import { estimateTax } from '../ai/generator.js';
import { loadLedger } from '../utils/ledger.js';
import { bookkeepingDb } from '../db/client.js';
import type { CalculateTaxParams, TaxResult } from '../types/bookkeeping.types.js';

export const calculateTaxTool: Tool = {
  name: 'calculate_tax',
  description: `Calculate estimated taxes based on income, expenses, and deductions.

Provides tax calculations and recommendations for business owners.

Required parameters:
- year: Tax year (e.g., 2023, 2024)

Optional parameters:
- include_deductions: Whether to include common business deductions
- user_id: User ID for multi-tenant support

Returns:
- year: Tax year
- total_income: Total business income
- total_expenses: Total business expenses
- taxable_income: Income after expenses
- estimated_tax: Estimated tax liability
- deductions: Breakdown of deductions
- recommendations: Tax optimization suggestions

Example:
{
  "year": 2023,
  "include_deductions": true
}`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (optional)' },
      year: { type: 'number', description: 'Tax year' },
      include_deductions: { type: 'boolean', description: 'Include deductions (optional)' },
    },
    required: ['year'],
  },
};

export async function handleCalculateTax(args: unknown, userId?: string) {
  const startTime = Date.now();

  try {
    // Validate parameters
    const params = args as CalculateTaxParams;

    logger.info('Calculating tax', {
      userId: params.user_id || userId,
      year: params.year,
      includeDeductions: params.include_deductions,
    });

    const ledger = await loadLedger({
      userId: params.user_id || userId,
      fallbackSeed: `tax:${params.year}`,
      fallbackMonths: 12,
    });

    const result: TaxResult = estimateTax(params, ledger);

    if (bookkeepingDb.connected) {
      const inserted = await bookkeepingDb.query<{ id: string }>(
        `INSERT INTO bk_tax_estimations (user_id, tax_year, include_deductions, total_income, total_expenses, taxable_income, estimated_tax, deductions, recommendations)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
         RETURNING id`,
        [
          params.user_id || userId || null,
          result.year,
          params.include_deductions ?? false,
          result.total_income,
          result.total_expenses,
          result.taxable_income,
          result.estimated_tax,
          JSON.stringify(result.deductions),
          result.recommendations,
        ],
      );

      if (inserted.rows[0]?.id) {
        result.metadata = {
          database_id: inserted.rows[0].id,
          ledger_rows: ledger.length,
        };
      }
    }

    const duration = Date.now() - startTime;

    logger.info('Tax calculated successfully', {
      userId: params.user_id || userId,
      year: params.year,
      estimatedTax: result.estimated_tax,
      durationMs: duration,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              tax: result,
              metadata: {
                year: params.year,
                estimated_tax: result.estimated_tax,
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

    logger.error('calculate_tax tool failed', {
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
              tool: 'calculate_tax',
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
