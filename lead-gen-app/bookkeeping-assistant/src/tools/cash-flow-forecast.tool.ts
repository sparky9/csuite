/**
 * MCP Tool: Cash Flow Forecast
 * Forecast future cash flow based on historical data and trends
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { forecastCashFlow, type LedgerEntry, type HistoricalDatum } from '../ai/generator.js';
import { logger } from '../utils/logger.js';
import { loadLedger } from '../utils/ledger.js';
import { bookkeepingDb } from '../db/client.js';

export const cashFlowForecastTool: Tool = {
  name: 'cash_flow_forecast',
  description: `Forecast future cash flow based on historical data and trends.

Predicts future cash inflows and outflows to help with financial planning and decision making.

Required parameters:
- forecast_period: Number of periods to forecast (e.g., 3 for 3 months)
- period_type: Type of period (monthly, quarterly, yearly)

Optional parameters:
- historical_data: Historical cash flow data
- assumptions: Business assumptions that might affect cash flow
- user_id: User ID for multi-tenant support

Returns:
- forecast_periods: Array of forecasted periods with cash flow projections
- total_forecast: Total projected cash flow over the period
- key_insights: Important trends and insights
- recommendations: Actions to improve cash flow

Example:
{
  "forecast_period": 6,
  "period_type": "monthly",
  "historical_data": [
    {"period": "2024-01", "inflows": 15000, "outflows": 8000, "net": 7000},
    {"period": "2024-02", "inflows": 12000, "outflows": 9000, "net": 3000}
  ],
  "assumptions": ["New client acquisition in Q2", "Seasonal business slowdown in summer"]
}`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (optional)' },
      forecast_period: { type: 'number', description: 'Number of periods to forecast' },
      period_type: {
        type: 'string',
        enum: ['monthly', 'quarterly', 'yearly'],
        description: 'Type of period',
      },
      historical_data: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            period: { type: 'string' },
            inflows: { type: 'number' },
            outflows: { type: 'number' },
            net: { type: 'number' },
          },
        },
        description: 'Historical cash flow data (optional)',
      },
      assumptions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Business assumptions (optional)',
      },
    },
    required: ['forecast_period', 'period_type'],
  },
};

function ledgerToHistorical(ledger: LedgerEntry[], periodType: string): HistoricalDatum[] {
  const buckets = new Map<string, { inflows: number; outflows: number }>();

  const periodKey = (date: string): string => {
    const year = date.slice(0, 4);
    if (periodType === 'yearly') {
      return year;
    }

    const month = Number(date.slice(5, 7));
    if (periodType === 'quarterly') {
      const quarter = Math.floor((month - 1) / 3) + 1;
      return `${year}-Q${quarter}`;
    }

    return `${year}-${String(month).padStart(2, '0')}`;
  };

  for (const entry of ledger) {
    const key = periodKey(entry.date);
    if (!buckets.has(key)) {
      buckets.set(key, { inflows: 0, outflows: 0 });
    }

    const bucket = buckets.get(key)!;
    if (entry.type === 'income') {
      bucket.inflows += entry.amount;
    } else if (entry.type === 'expense') {
      bucket.outflows += entry.amount;
    }
  }

  return Array.from(buckets.entries())
    .map(([period, value]) => ({
      period,
      inflows: Number(value.inflows.toFixed(2)),
      outflows: Number(value.outflows.toFixed(2)),
      net: Number((value.inflows - value.outflows).toFixed(2)),
    }))
    .sort((a, b) => (a.period > b.period ? 1 : -1));
}

export async function handleCashFlowForecast(args: unknown, userId?: string) {
  const startTime = Date.now();

  try {
    // Validate parameters
    const params = args as {
      forecast_period: number;
      period_type: string;
      historical_data?: Array<{ period: string; inflows: number; outflows: number; net: number }>;
      assumptions?: string[];
      user_id?: string;
    };

    logger.info('Forecasting cash flow', {
      userId: params.user_id || userId,
      periods: params.forecast_period,
      periodType: params.period_type,
    });

    const ledger = await loadLedger({
      userId: params.user_id || userId,
      fallbackSeed: `forecast:${params.period_type}:${params.forecast_period}`,
      fallbackMonths: Math.max(params.forecast_period, 6),
    });

    const providedHistorical: HistoricalDatum[] | undefined = params.historical_data?.map(item => ({
      period: item.period,
      inflows: item.inflows,
      outflows: item.outflows,
      net: item.net,
    }));

    const historicalSource = providedHistorical && providedHistorical.length > 0
      ? providedHistorical
      : ledgerToHistorical(ledger, params.period_type);

    const result = forecastCashFlow(
      params.period_type,
      params.forecast_period,
      historicalSource,
      params.assumptions,
    );

    if (bookkeepingDb.connected) {
      const inserted = await bookkeepingDb.query<{ id: string }>(
        `INSERT INTO bk_cashflow_forecasts (user_id, period_type, forecast_period, forecast_periods, total_forecast, key_insights, recommendations, risk_factors)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
         RETURNING id`,
        [
          params.user_id || userId || null,
          params.period_type,
          params.forecast_period,
          JSON.stringify(result.forecast_periods),
          result.total_forecast,
          result.key_insights,
          result.recommendations,
          result.risk_factors,
        ],
      );

      if (inserted.rows[0]?.id) {
        result.metadata = {
          database_id: inserted.rows[0].id,
          ledger_rows: ledger.length,
          historical_source: providedHistorical && providedHistorical.length > 0 ? 'provided' : 'ledger',
        };
      }
    }

    const duration = Date.now() - startTime;

    logger.info('Cash flow forecasted successfully', {
      userId: params.user_id || userId,
      periods: params.forecast_period,
      totalForecast: result.total_forecast,
      durationMs: duration,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              forecast: result,
              metadata: {
                forecast_periods: params.forecast_period,
                period_type: params.period_type,
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

    logger.error('cash_flow_forecast tool failed', {
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
              tool: 'cash_flow_forecast',
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
