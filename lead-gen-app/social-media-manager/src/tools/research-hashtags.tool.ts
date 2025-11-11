/**
 * MCP Tool: Research Hashtags
 * Research and suggest effective hashtags for increased reach
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { logger, logToolExecution } from '../utils/logger.js';
import { researchHashtags } from '../ai/generator.js';
import { socialDb } from '../db/client.js';

export const researchHashtagsTool: Tool = {
  name: 'research_hashtags',
  description: `Research and suggest effective hashtags for increased reach.

AI-powered hashtag research providing relevant, trending, and niche hashtags optimized for your content.

Required parameters:
- topic: Content topic or keyword
- platform: Target platform

Optional parameters:
- count: Number of hashtags to return (default: 10)
- strategy: Hashtag strategy (trending, niche, brand, competitive)
- user_id: User ID for multi-tenant support

Returns:
- hashtags: Suggested hashtags with performance metrics
- top_picks: Best hashtags based on relevance and reach
- strategy_recommendations: How to use the hashtags effectively

Example:
{
  "topic": "digital marketing",
  "platform": "linkedin",
  "count": 15,
  "strategy": "niche"
}`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (optional)' },
      topic: { type: 'string', description: 'Content topic or keyword' },
      platform: {
        type: 'string',
        enum: ['linkedin', 'twitter', 'facebook'],
        description: 'Target platform',
      },
      count: { type: 'number', description: 'Number of hashtags (optional, default: 10)' },
      strategy: {
        type: 'string',
        enum: ['trending', 'niche', 'brand', 'competitive'],
        description: 'Hashtag strategy (optional)',
      },
    },
    required: ['topic', 'platform'],
  },
};

const HashtagSchema = z.object({
  user_id: z.string().optional(),
  topic: z.string().min(2, 'Topic is required'),
  platform: z.enum(['linkedin', 'twitter', 'facebook']),
  count: z.coerce.number().int().min(3).max(25).default(10),
  strategy: z.enum(['trending', 'niche', 'brand', 'competitive']).optional(),
});

export async function handleResearchHashtags(args: unknown, userId?: string) {
  const startTime = Date.now();

  try {
    const input = HashtagSchema.parse(args);
    const effectiveUserId = input.user_id || userId;

    logger.info('Researching hashtags via template engine', {
      userId: effectiveUserId,
      topic: input.topic,
      platform: input.platform,
      strategy: input.strategy,
    });

    const result = researchHashtags({
      topic: input.topic,
      platform: input.platform,
      count: input.count,
      strategy: input.strategy,
    });

    const payload = {
      hashtags: result.hashtags,
      top_picks: result.topPicks,
      strategy_recommendations: result.strategyRecommendations,
    };

    if (socialDb.connected) {
      for (const suggestion of result.hashtags) {
        await socialDb.query(
          `INSERT INTO social_hashtag_library (
            user_id, platform, tag, usage_count, volume, competition,
            relevance_score, strategy, created_at
          ) VALUES ($1, $2, $3, 0, $4, $5, $6, $7, NOW())
          ON CONFLICT (user_id, platform, tag)
          DO UPDATE SET relevance_score = EXCLUDED.relevance_score, strategy = EXCLUDED.strategy, last_used_at = NOW()`,
          [
            effectiveUserId ?? null,
            input.platform,
            suggestion.tag,
            suggestion.volume,
            suggestion.competition,
            suggestion.relevanceScore,
            input.strategy ?? 'trending',
          ],
        );
      }
    }

    const duration = Date.now() - startTime;
    logToolExecution('research_hashtags', effectiveUserId, input, true, duration);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              hashtag_research: payload,
              metadata: {
                topic: input.topic,
                platform: input.platform,
                strategy: input.strategy ?? 'trending',
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
    logToolExecution('research_hashtags', userId, {}, false, duration);

    const message = error instanceof z.ZodError
      ? `Validation error: ${error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ')}`
      : error instanceof Error
        ? error.message
        : String(error);

    logger.error('research_hashtags tool failed', { error: message, durationMs: duration });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: message,
              tool: 'research_hashtags',
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
