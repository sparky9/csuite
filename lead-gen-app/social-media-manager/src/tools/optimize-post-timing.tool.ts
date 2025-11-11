/**
 * MCP Tool: Optimize Post Timing
 * Find the best times to post based on audience engagement data
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { optimizeTiming } from '../ai/generator.js';
import { logger, logToolExecution } from '../utils/logger.js';
import { socialDb } from '../db/client.js';

export const optimizePostTimingTool: Tool = {
  name: 'optimize_post_timing',
  description: `Find the best times to post based on audience engagement data.

Analyzes engagement patterns and recommends optimal posting times for maximum reach.

Required parameters:
- platform: Target platform

Optional parameters:
- audience_timezone: Target audience timezone
- content_type: Type of content to optimize for
- user_id: User ID for multi-tenant support

Returns:
- optimal_times: Best times to post by day of week
- engagement_windows: Peak engagement periods
- recommendations: Strategic timing recommendations

Example:
{
  "platform": "linkedin",
  "audience_timezone": "America/New_York",
  "content_type": "professional"
}`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (optional)' },
      platform: {
        type: 'string',
        enum: ['linkedin', 'twitter', 'facebook'],
        description: 'Target platform',
      },
      audience_timezone: { type: 'string', description: 'Audience timezone (optional)' },
      content_type: {
        type: 'string',
        enum: ['professional', 'casual', 'educational', 'promotional'],
        description: 'Content type (optional)',
      },
    },
    required: ['platform'],
  },
};

const TimingSchema = z.object({
  user_id: z.string().optional(),
  platform: z.enum(['linkedin', 'twitter', 'facebook']),
  audience_timezone: z.string().optional(),
  content_type: z.enum(['professional', 'casual', 'educational', 'promotional']).optional(),
});

export async function handleOptimizePostTiming(args: unknown, userId?: string) {
  const startTime = Date.now();

  try {
    const input = TimingSchema.parse(args);
    const effectiveUserId = input.user_id || userId;

    logger.info('Optimizing post timing deterministically', {
      userId: effectiveUserId,
      platform: input.platform,
      audienceTimezone: input.audience_timezone,
      contentType: input.content_type,
    });

    const optimization = optimizeTiming({
      platform: input.platform,
      audienceTimezone: input.audience_timezone,
      contentType: input.content_type,
    });

    if (socialDb.connected) {
      await socialDb.query(
        `INSERT INTO social_timing_recommendations (
          user_id, platform, audience_timezone, content_type, optimal_times,
          engagement_windows, recommendations, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          effectiveUserId ?? null,
          input.platform,
          input.audience_timezone ?? null,
          input.content_type ?? null,
          optimization.optimalTimes,
          optimization.engagementWindows,
          optimization.recommendations,
        ],
      );
    }

    const duration = Date.now() - startTime;
    logToolExecution('optimize_post_timing', effectiveUserId, input, true, duration);

    const payload = {
      optimal_times: optimization.optimalTimes,
      engagement_windows: optimization.engagementWindows,
      recommendations: optimization.recommendations,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              timing_optimization: payload,
              metadata: {
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
    logToolExecution('optimize_post_timing', userId, {}, false, duration);

    const message = error instanceof z.ZodError
      ? `Validation error: ${error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ')}`
      : error instanceof Error
        ? error.message
        : String(error);

    logger.error('optimize_post_timing tool failed', { error: message, durationMs: duration });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: message,
              tool: 'optimize_post_timing',
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
