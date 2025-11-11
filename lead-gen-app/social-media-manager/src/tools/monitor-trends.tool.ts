/**
 * MCP Tool: Monitor Trends
 * Monitor trending topics and conversations relevant to your brand
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { monitorTrends } from '../ai/generator.js';
import { logger, logToolExecution } from '../utils/logger.js';
import { socialDb } from '../db/client.js';

export const monitorTrendsTool: Tool = {
  name: 'monitor_trends',
  description: `Monitor trending topics and conversations relevant to your brand.

Identifies trending topics, hashtags, and conversations in your industry.

Required parameters:
- industry: Your industry or niche
- platform: Target platform

Optional parameters:
- keywords: Specific keywords to monitor
- include_competitors: Include competitor mentions
- user_id: User ID for multi-tenant support

Returns:
- trending_topics: Current trending topics
- relevant_hashtags: Trending hashtags in your niche
- opportunities: Content opportunities based on trends
- alerts: Important trends requiring immediate attention

Example:
{
  "industry": "SaaS",
  "platform": "twitter",
  "keywords": ["AI", "automation"],
  "include_competitors": true
}`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (optional)' },
      industry: { type: 'string', description: 'Industry or niche' },
      platform: {
        type: 'string',
        enum: ['linkedin', 'twitter', 'facebook'],
        description: 'Target platform',
      },
      keywords: {
        type: 'array',
        items: { type: 'string' },
        description: 'Keywords to monitor (optional)',
      },
      include_competitors: { type: 'boolean', description: 'Include competitor mentions (optional)' },
    },
    required: ['industry', 'platform'],
  },
};

const TrendSchema = z.object({
  user_id: z.string().optional(),
  industry: z.string().min(2),
  platform: z.enum(['linkedin', 'twitter', 'facebook']),
  keywords: z.array(z.string().min(2)).optional(),
  include_competitors: z.boolean().optional(),
});

export async function handleMonitorTrends(args: unknown, userId?: string) {
  const startTime = Date.now();

  try {
    const input = TrendSchema.parse(args);
    const effectiveUserId = input.user_id || userId;

    logger.info('Monitoring trends deterministically', {
      userId: effectiveUserId,
      industry: input.industry,
      platform: input.platform,
      keywords: input.keywords,
      includeCompetitors: input.include_competitors,
    });

    const trends = monitorTrends({
      industry: input.industry,
      platform: input.platform,
      keywords: input.keywords,
      includeCompetitors: input.include_competitors,
    });

    if (socialDb.connected) {
      const snapshotResult = await socialDb.query(
        `INSERT INTO social_trend_snapshots (
          user_id, industry, platform, keywords, include_competitors,
          opportunities, alerts, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id`,
        [
          effectiveUserId ?? null,
          input.industry,
          input.platform,
          input.keywords ?? [],
          input.include_competitors ?? false,
          trends.opportunities,
          trends.alerts,
        ],
      );

      const snapshotId = snapshotResult.rows[0]?.id;

      if (snapshotId) {
        for (const topic of trends.trendingTopics) {
          await socialDb.query(
            `INSERT INTO social_trend_topics (
              snapshot_id, topic, volume, relevance_score, growth_rate, description
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              snapshotId,
              topic.topic,
              topic.volume,
              topic.relevanceScore,
              topic.growthRate,
              topic.description,
            ],
          );
        }

        for (const hashtag of trends.relevantHashtags) {
          await socialDb.query(
            `INSERT INTO social_trend_hashtags (
              snapshot_id, hashtag, volume, trending
            ) VALUES ($1, $2, $3, $4)`,
            [snapshotId, hashtag.hashtag, hashtag.volume, hashtag.trending],
          );
        }
      }
    }

    const duration = Date.now() - startTime;
    logToolExecution('monitor_trends', effectiveUserId, input, true, duration);

    const payload = {
      trending_topics: trends.trendingTopics.map((topic) => ({
        topic: topic.topic,
        volume: topic.volume,
        relevance_score: topic.relevanceScore,
        growth_rate: topic.growthRate,
        description: topic.description,
      })),
      relevant_hashtags: trends.relevantHashtags,
      opportunities: trends.opportunities,
      alerts: trends.alerts,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              trends: payload,
              metadata: {
                industry: input.industry,
                platform: input.platform,
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
    logToolExecution('monitor_trends', userId, {}, false, duration);

    const message = error instanceof z.ZodError
      ? `Validation error: ${error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ')}`
      : error instanceof Error
        ? error.message
        : String(error);

    logger.error('monitor_trends tool failed', { error: message, durationMs: duration });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: message,
              tool: 'monitor_trends',
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
