/**
 * MCP Tool: Analyze Market Position
 * Compare your pricing against stored competitor averages.
 */
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { socialDb } from '../db/client.js';
import { logger, logToolExecution } from '../utils/logger.js';
import {
  deriveDeterministicId,
  determinePositionRecommendation,
  formatPriceRange,
  generatePricingSnapshot,
} from '../analytics/pricing-intelligence.js';

interface PricingRow {
  price_low: string | number | null;
  price_high: string | number | null;
}

const AnalyzeMarketPositionSchema = z.object({
  user_id: z.string().min(2, 'user_id is required'),
  service: z.string().min(2, 'service name must contain at least 2 characters'),
  your_price: z.number().positive('your_price must be greater than zero'),
});

type AnalyzeMarketPositionInput = z.infer<typeof AnalyzeMarketPositionSchema>;

interface MarketMetrics {
  marketAverage: number;
  marketLow: number;
  marketHigh: number;
  competitorCount: number;
  source: 'database' | 'fallback';
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === 'number') {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

async function getMarketMetrics(userId: string, service: string): Promise<MarketMetrics> {
  if (!socialDb.connected) {
    const base = generatePricingSnapshot('Baseline Competitor', service);
    const challenger = generatePricingSnapshot('Reference Collective', service);
    const mid = generatePricingSnapshot('Growth Agency', service);

    const lows = [base.priceLow, challenger.priceLow, mid.priceLow];
    const highs = [base.priceHigh, challenger.priceHigh, mid.priceHigh];
    const averages = [base, challenger, mid].map((item) => (item.priceLow + item.priceHigh) / 2);

    return {
      marketAverage: averages.reduce((acc, value) => acc + value, 0) / averages.length,
      marketLow: Math.min(...lows),
      marketHigh: Math.max(...highs),
      competitorCount: averages.length,
      source: 'fallback',
    };
  }

  const result = await socialDb.query<PricingRow>(
    `SELECT price_low, price_high
     FROM social_competitor_pricing
     WHERE user_id = $1 AND LOWER(service_name) = LOWER($2)`,
    [userId, service],
  );

  if (result.rowCount === 0) {
    const baseline = generatePricingSnapshot(`${userId}-baseline`, service);
    const alternate = generatePricingSnapshot(`${userId}-reference`, service);
    return {
      marketAverage: ((baseline.priceLow + baseline.priceHigh) / 2 + (alternate.priceLow + alternate.priceHigh) / 2) / 2,
      marketLow: Math.min(baseline.priceLow, alternate.priceLow),
      marketHigh: Math.max(baseline.priceHigh, alternate.priceHigh),
      competitorCount: 2,
      source: 'fallback',
    };
  }

  const averages: number[] = [];
  const lows: number[] = [];
  const highs: number[] = [];

  for (const row of result.rows) {
    const low = toNumber(row.price_low);
    const high = toNumber(row.price_high);

    if (low === 0 && high === 0) {
      continue;
    }

    lows.push(low);
    highs.push(high);
    averages.push((low + high) / 2);
  }

  if (averages.length === 0) {
    const guard = generatePricingSnapshot('Guardrail Competitor', service);
    return {
      marketAverage: (guard.priceLow + guard.priceHigh) / 2,
      marketLow: guard.priceLow,
      marketHigh: guard.priceHigh,
      competitorCount: 1,
      source: 'fallback',
    };
  }

  return {
    marketAverage: averages.reduce((acc, val) => acc + val, 0) / averages.length,
    marketLow: Math.min(...lows),
    marketHigh: Math.max(...highs),
    competitorCount: averages.length,
    source: 'database',
  };
}

export const analyzeMarketPositionTool: Tool = {
  name: 'analyze_market_position',
  description: `Compare your pricing against competitor averages stored in the pricing intelligence database.
Required parameters:
- user_id: User identifier linked to stored competitor pricing
- service: Service name to compare
- your_price: Your current price for the service
Returns market averages, price ranges, and actionable recommendation.`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User identifier' },
      service: { type: 'string', description: 'Service name (case-insensitive)' },
      your_price: { type: 'number', description: 'Current price you charge for the service' },
    },
    required: ['user_id', 'service', 'your_price'],
  },
};

export async function handleAnalyzeMarketPosition(args: unknown, userId?: string) {
  const startTime = Date.now();

  try {
    const input = AnalyzeMarketPositionSchema.parse(args);
    const effectiveUserId = input.user_id || userId;

    if (!effectiveUserId) {
      throw new Error('User ID is required to analyze market position.');
    }

    const metrics = await getMarketMetrics(effectiveUserId, input.service);

    const roundedAverage = roundCurrency(metrics.marketAverage);
    const roundedLow = roundCurrency(metrics.marketLow);
    const roundedHigh = roundCurrency(metrics.marketHigh);

    const { position, recommendation } = determinePositionRecommendation(input.your_price, roundedAverage);

    const payload = {
      service: input.service,
      yourPrice: roundCurrency(input.your_price),
      marketAverage: roundedAverage,
      marketRange: {
        low: roundedLow,
        high: roundedHigh,
      },
      yourPosition: position,
      recommendation,
      competitorCount: metrics.competitorCount,
      metadata: {
        dataSource: metrics.source,
        referenceCompetitorId: deriveDeterministicId(effectiveUserId, input.service),
        priceRangeFormatted: formatPriceRange(roundedLow, roundedHigh, 'USD'),
        dbBacked: socialDb.connected,
      },
    };

    const duration = Date.now() - startTime;
    logToolExecution('analyze_market_position', effectiveUserId, input, true, duration);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, analysis: payload }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    logger.error('analyze_market_position failed', {
      error: error.message,
      stack: error.stack,
    });

    const duration = Date.now() - startTime;
    logToolExecution('analyze_market_position', userId, {}, false, duration);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: error.message,
            },
            null,
            2,
          ),
        },
      ],
    };
  }
}
