/**
 * MCP Tool: Schedule Post
 * Schedule posts for optimal engagement times across multiple platforms
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { logger, logToolExecution } from '../utils/logger.js';
import type { SocialPlatform, SocialPost } from '../types/social.types.js';
import { optimizeTiming } from '../ai/generator.js';
import { socialDb } from '../db/client.js';

export const schedulePostTool: Tool = {
  name: 'schedule_post',
  description: `Schedule posts for optimal engagement times across multiple platforms.

Schedules social media posts with smart timing recommendations based on platform best practices.

Required parameters:
- content: Post content text
- platforms: Array of target platforms
- schedule_time: When to post (ISO date string or 'optimal' for AI suggestion)

Optional parameters:
- hashtags: Array of hashtags to include
- media_urls: Array of image/video URLs
- thread_posts: Additional posts for threads
- user_id: User ID for multi-tenant support

Returns:
- scheduled_post: Post details with ID and scheduled time
- optimal_time_suggestion: If not using optimal timing
- platform_specific_details: Platform-specific posting information

Example:
{
  "content": "Excited to announce our new product!",
  "platforms": ["linkedin", "twitter"],
  "schedule_time": "optimal",
  "hashtags": ["ProductLaunch", "Innovation"],
  "media_urls": ["https://example.com/image.jpg"]
}`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (optional)' },
      content: { type: 'string', description: 'Post content' },
      platforms: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['linkedin', 'twitter', 'facebook'],
        },
        description: 'Target platforms',
      },
      schedule_time: { type: 'string', description: 'Schedule time (ISO date or "optimal")' },
      hashtags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Hashtags (optional)',
      },
      media_urls: {
        type: 'array',
        items: { type: 'string' },
        description: 'Media URLs (optional)',
      },
      thread_posts: {
        type: 'array',
        items: { type: 'string' },
        description: 'Additional posts for threads (optional)',
      },
    },
    required: ['content', 'platforms', 'schedule_time'],
  },
};

const SchedulePostSchema = z.object({
  user_id: z.string().optional(),
  content: z.string().min(10, 'Content must be at least 10 characters'),
  platforms: z.array(z.enum(['linkedin', 'twitter', 'facebook'])).min(1, 'At least one platform is required'),
  schedule_time: z.union([z.literal('optimal'), z.string().datetime()]),
  hashtags: z.array(z.string()).optional(),
  media_urls: z.array(z.string().url()).optional(),
  thread_posts: z.array(z.string()).optional(),
});

export async function handleSchedulePost(args: unknown, userId?: string) {
  const startTime = Date.now();

  try {
    const input = SchedulePostSchema.parse(args);
    const effectiveUserId = input.user_id || userId;

    logger.info('Scheduling social content', {
      userId: effectiveUserId,
      platforms: input.platforms,
      scheduleTime: input.schedule_time,
    });

    let scheduledTime: Date;
    let optimalWindow: string | null = null;

    if (input.schedule_time === 'optimal') {
      const nextOptimisation = optimizeTiming({
        platform: input.platforms[0] as SocialPlatform,
      });

      const candidate = nextOptimisation.optimalTimes.Monday?.[0] ?? nextOptimisation.engagementWindows.peak[0];
      optimalWindow = candidate;
      const [hours, minutes] = candidate.split(':').map(Number);

      const now = new Date();
      scheduledTime = new Date(now);
      scheduledTime.setHours(hours, minutes, 0, 0);

      if (scheduledTime <= now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }
    } else {
      scheduledTime = new Date(input.schedule_time);
    }

    const scheduledPost: Partial<SocialPost> = {
      id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      user_id: effectiveUserId || 'anonymous',
      platforms: input.platforms as SocialPlatform[],
      content: input.content,
      media_urls: input.media_urls,
      scheduled_time: scheduledTime,
      status: 'scheduled',
      hashtags: input.hashtags ?? [],
      categories: [],
      priority: 'medium',
      generated_by_ai: true,
      created_at: new Date(),
    };

    if (socialDb.connected) {
      await socialDb.query(
        `INSERT INTO social_schedules (
          user_id, platforms, schedule_time, schedule_window, strategy, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())`,
        [
          effectiveUserId ?? null,
          input.platforms,
          scheduledTime.toISOString(),
          optimalWindow,
          input.schedule_time === 'optimal' ? 'auto' : 'manual',
        ],
      );
    }

    const platformDetails = input.platforms.map((platform) => {
      const optimisation = optimizeTiming({ platform: platform as SocialPlatform });
      return {
        platform,
        scheduled_time: scheduledTime.toISOString(),
        suggested_windows: optimisation.engagementWindows.peak,
        character_count: input.content.length,
        character_limit: platform === 'twitter' ? 280 : platform === 'linkedin' ? 3000 : 63206,
        hashtag_count: input.hashtags?.length ?? 0,
      };
    });

    const duration = Date.now() - startTime;
    logToolExecution('schedule_post', effectiveUserId, input, true, duration);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              scheduled_post: scheduledPost,
              platform_details: platformDetails,
              metadata: {
                scheduled_time: scheduledTime.toISOString(),
                optimal_window: optimalWindow,
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
    logToolExecution('schedule_post', userId, {}, false, duration);

    const message = error instanceof z.ZodError
      ? `Validation error: ${error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ')}`
      : error instanceof Error
        ? error.message
        : String(error);

    logger.error('schedule_post tool failed', { error: message, durationMs: duration });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: message,
              tool: 'schedule_post',
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
