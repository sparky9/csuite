/**
 * MCP Tool: Get Analytics
 * Retrieve performance analytics and insights for social media posts
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { buildAnalyticsSnapshot } from '../ai/generator.js';
import { logger, logToolExecution } from '../utils/logger.js';
import type { SocialPlatform } from '../types/social.types.js';
import { socialDb } from '../db/client.js';

export const getAnalyticsTool: Tool = {
  name: 'get_analytics',
  description: `Retrieve performance analytics and insights for social media posts.

Provides comprehensive analytics data with AI-generated insights and recommendations.

Required parameters:
- date_range: Analytics period (7d, 30d, 90d, or custom)

Optional parameters:
- platform: Specific platform to analyze (or all if not specified)
- start_date: Start date for custom range (ISO date)
- end_date: End date for custom range (ISO date)
- metrics: Specific metrics to include
- user_id: User ID for multi-tenant support

Returns:
- summary: Overall performance summary
- platform_breakdown: Metrics by platform
- top_posts: Best performing posts
- insights: AI-generated insights and recommendations
- trends: Performance trends over time

Example:
{
  "date_range": "30d",
  "platform": "linkedin",
  "metrics": ["impressions", "engagement", "followers"]
}`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (optional)' },
      date_range: {
        type: 'string',
        enum: ['7d', '30d', '90d', 'custom'],
        description: 'Analytics period',
      },
      platform: {
        type: 'string',
        enum: ['linkedin', 'twitter', 'facebook'],
        description: 'Specific platform (optional)',
      },
      start_date: { type: 'string', description: 'Start date for custom range (optional)' },
      end_date: { type: 'string', description: 'End date for custom range (optional)' },
      metrics: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['impressions', 'engagement', 'followers', 'growth', 'reach'],
        },
        description: 'Specific metrics (optional)',
      },
    },
    required: ['date_range'],
  },
};

const AnalyticsSchema = z.object({
  user_id: z.string().optional(),
  date_range: z.enum(['7d', '30d', '90d', 'custom']),
  platform: z.enum(['linkedin', 'twitter', 'facebook']).optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  metrics: z.array(z.enum(['impressions', 'engagement', 'followers', 'growth', 'reach'])).optional(),
});

export async function handleGetAnalytics(args: unknown, userId?: string) {
  const startTime = Date.now();

  try {
    const input = AnalyticsSchema.parse(args);
    const effectiveUserId = input.user_id || userId;

    logger.info('Building analytics snapshot', {
      userId: effectiveUserId,
      dateRange: input.date_range,
      platform: input.platform,
    });

    const snapshot = buildAnalyticsSnapshot({
      dateRange: input.date_range,
      platform: input.platform as SocialPlatform | undefined,
      metrics: input.metrics,
    });

    if (socialDb.connected) {
      for (const platform of snapshot.platformBreakdown) {
        await socialDb.query(
          `INSERT INTO social_analytics_snapshots (
            user_id, platform, date_range, impressions, engagement, followers,
            follower_growth, engagement_rate, created_at, metrics, insights
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10)`
          , [
            effectiveUserId ?? null,
            platform.platform,
            input.date_range,
            platform.totalImpressions,
            platform.totalEngagement,
            platform.followers,
            platform.followerGrowth,
            platform.averageEngagementRate,
            JSON.stringify(platform),
            JSON.stringify({ insights: snapshot.insights, recommendations: snapshot.recommendations }),
          ],
        );
      }
    }

    const duration = Date.now() - startTime;
    logToolExecution('get_analytics', effectiveUserId, input, true, duration);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              analytics: snapshot,
              metadata: {
                date_range: input.date_range,
                platforms: snapshot.platformBreakdown.map((p) => p.platform),
                generation_time_ms: duration,
              },
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logToolExecution('get_analytics', userId, {}, false, duration);

    const message = error instanceof z.ZodError
      ? `Validation error: ${error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ')}`
      : error instanceof Error
        ? error.message
        : String(error);

    logger.error('get_analytics tool failed', { error: message, durationMs: duration });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: message,
              tool: 'get_analytics',
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }
}
