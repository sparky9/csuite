/**
 * MCP Tool: Generate Report
 * Generate financial reports including profit & loss, cash flow, and balance sheets
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';
import { buildFinancialReport } from '../ai/generator.js';
import { loadLedger } from '../utils/ledger.js';
import { bookkeepingDb } from '../db/client.js';
import { BASE_CURRENCY } from '../utils/currency.js';
import type { GenerateReportParams, ReportResult } from '../types/bookkeeping.types.js';

export const generateReportTool: Tool = {
  name: 'generate_report',
  description: `Generate financial reports including profit & loss, cash flow, and balance sheets.

Creates comprehensive financial reports based on transaction data.

Required parameters:
- type: Report type (profit_loss, cash_flow, balance_sheet, tax_summary)
- period: Report period (monthly, quarterly, yearly)
- start_date: Start date in YYYY-MM-DD format
- end_date: End date in YYYY-MM-DD format

Optional parameters:
- include_details: Whether to include detailed transaction breakdowns
- user_id: User ID for multi-tenant support

Returns:
- type: Report type
- period: Report period
- start_date: Start date
- end_date: End date
- summary: Summary financial data
- details: Detailed breakdowns (if requested)
- recommendations: AI-generated recommendations

Example:
{
  "type": "profit_loss",
  "period": "monthly",
  "start_date": "2024-01-01",
  "end_date": "2024-01-31",
  "include_details": true
}`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (optional)' },
      type: {
        type: 'string',
        enum: ['profit_loss', 'cash_flow', 'balance_sheet', 'tax_summary'],
        description: 'Report type',
      },
      period: {
        type: 'string',
        enum: ['monthly', 'quarterly', 'yearly'],
        description: 'Report period',
      },
      start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
      end_date: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      include_details: { type: 'boolean', description: 'Include detailed breakdowns (optional)' },
    },
    required: ['type', 'period', 'start_date', 'end_date'],
  },
};

export async function handleGenerateReport(args: unknown, userId?: string) {
  const startTime = Date.now();

  try {
    // Validate parameters
    const params = args as GenerateReportParams;

    logger.info('Generating report', {
      userId: params.user_id || userId,
      type: params.type,
      period: params.period,
      startDate: params.start_date,
      endDate: params.end_date,
    });

    const ledger = await loadLedger({
      userId: params.user_id || userId,
      startDate: params.start_date,
      endDate: params.end_date,
      fallbackSeed: `${params.type}:${params.start_date}:${params.end_date}`,
      fallbackMonths: 6,
    });

    const report: ReportResult = buildFinancialReport(params, ledger);

    if (bookkeepingDb.connected) {
      const inserted = await bookkeepingDb.query<{ id: string }>(
        `INSERT INTO bk_reports (user_id, report_type, period, start_date, end_date, summary, details, recommendations)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
         RETURNING id`,
        [
          params.user_id || userId || null,
          report.type,
          report.period,
          report.start_date,
          report.end_date,
          JSON.stringify(report.summary),
          JSON.stringify(report.details ?? []),
          report.recommendations ?? [],
        ],
      );

      if (inserted.rows[0]?.id) {
        report.metadata = {
          database_id: inserted.rows[0].id,
          ledger_rows: ledger.length,
          base_currency: BASE_CURRENCY,
        };
      }
    } else {
      report.metadata = {
        ...(report.metadata ?? {}),
        base_currency: BASE_CURRENCY,
        ledger_rows: ledger.length,
      };
    }

    const duration = Date.now() - startTime;

    logger.info('Report generated successfully', {
      userId: params.user_id || userId,
      type: params.type,
      durationMs: duration,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              report,
              metadata: {
                type: params.type,
                period: params.period,
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

    logger.error('generate_report tool failed', {
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
              tool: 'generate_report',
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
