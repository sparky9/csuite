import { z } from 'zod';
import { getReputationMetrics } from '../services/metrics.js';
import { ensureUserId } from './helpers.js';
import type { ReputationTimeframe } from '../types/reputation.js';
import { registerTool } from './tooling.js';

const statsSchema = z.object({
  userId: z.string().trim().optional(),
  timeframe: z.enum(['30d', '90d', '1y', 'all']).optional()
});

function formatPercent(value: number): string {
  const percent = Number.isFinite(value) ? value * 100 : 0;
  return `${Math.round(percent)}%`;
}

export const getStatsTool = registerTool({
  name: 'reputation_get_stats',
  description: 'Return reputation KPIs for dashboards and reporting.',
  schema: statsSchema,
  execute: async (input) => {
  const userId = ensureUserId(input.userId);
    const timeframe: ReputationTimeframe = input.timeframe ?? '90d';

    const metrics = await getReputationMetrics({ userId, timeframe });

    return {
      testimonials: {
        total: metrics.testimonials.total,
        avgRating: metrics.testimonials.avgRating,
        publicUseApproved: metrics.testimonials.publicUseApproved
      },
      publicReviews: metrics.publicReviews,
      negativeFeedback: metrics.negativeFeedback,
      conversionRate: formatPercent(metrics.conversionRate)
    };
  }
});
