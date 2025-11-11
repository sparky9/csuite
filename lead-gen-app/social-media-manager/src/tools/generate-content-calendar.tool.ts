/**
 * MCP Tool: Generate Content Calendar
 * Create a strategic content calendar for consistent posting
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { buildContentCalendar } from '../ai/generator.js';
import { logger, logToolExecution } from '../utils/logger.js';
import { socialDb } from '../db/client.js';

export const generateContentCalendarTool: Tool = {
  name: 'generate_content_calendar',
  description: `Create a strategic content calendar for consistent posting.

Generates a comprehensive posting schedule with content themes, optimal timing, and platform distribution.

Required parameters:
- duration_weeks: Number of weeks to plan (1-12)
- platforms: Array of target platforms
- posts_per_week: Desired number of posts per week

Optional parameters:
- content_themes: Specific themes to include
- business_goals: Business objectives to align with
- user_id: User ID for multi-tenant support

Returns:
- calendar: Week-by-week content schedule
- content_mix: Distribution of content types
- posting_schedule: Optimal posting times
- theme_distribution: How themes are spread across calendar

Example:
{
  "duration_weeks": 4,
  "platforms": ["linkedin", "twitter"],
  "posts_per_week": 5,
  "content_themes": ["product updates", "industry insights", "team culture"]
}`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (optional)' },
      duration_weeks: { type: 'number', description: 'Number of weeks to plan' },
      platforms: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['linkedin', 'twitter', 'facebook'],
        },
        description: 'Target platforms',
      },
      posts_per_week: { type: 'number', description: 'Posts per week' },
      content_themes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Content themes (optional)',
      },
      business_goals: {
        type: 'array',
        items: { type: 'string' },
        description: 'Business goals (optional)',
      },
    },
    required: ['duration_weeks', 'platforms', 'posts_per_week'],
  },
};

const ContentCalendarSchema = z.object({
  user_id: z.string().optional(),
  duration_weeks: z.coerce.number().int().min(1).max(12),
  platforms: z.array(z.enum(['linkedin', 'twitter', 'facebook'])).min(1, 'Provide at least one platform'),
  posts_per_week: z.coerce.number().int().min(1).max(14),
  content_themes: z.array(z.string().min(2)).optional(),
  business_goals: z.array(z.string().min(2)).optional(),
});

export async function handleGenerateContentCalendar(args: unknown, userId?: string) {
  const startTime = Date.now();

  try {
    const input = ContentCalendarSchema.parse(args);
    const effectiveUserId = input.user_id || userId;

    logger.info('Generating deterministic content calendar', {
      userId: effectiveUserId,
      durationWeeks: input.duration_weeks,
      postsPerWeek: input.posts_per_week,
      platforms: input.platforms,
    });

    const calendar = buildContentCalendar({
      durationWeeks: input.duration_weeks,
      platforms: input.platforms,
      postsPerWeek: input.posts_per_week,
      contentThemes: input.content_themes,
      businessGoals: input.business_goals,
    });

    if (socialDb.connected) {
      for (const week of calendar.calendar) {
        for (const post of week.posts) {
          const scheduledTime = post.time.length === 5 ? `${post.time}:00` : post.time;
          await socialDb.query(
            `INSERT INTO social_content_calendar (
              user_id, week_number, day_name, scheduled_time, platform,
              content_type, theme, topic, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
            [
              effectiveUserId ?? null,
              week.week,
              post.day,
              scheduledTime,
              post.platform,
              post.contentType,
              post.theme,
              post.topic,
            ],
          );
        }
      }

      await socialDb.query(
        `INSERT INTO social_content_calendar_summaries (
          user_id, duration_weeks, posts_per_week, platforms, content_mix, recommendations, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          effectiveUserId ?? null,
          input.duration_weeks,
          input.posts_per_week,
          input.platforms,
          calendar.contentMix,
          calendar.recommendations,
        ],
      );
    }

    const duration = Date.now() - startTime;
    logToolExecution('generate_content_calendar', effectiveUserId, input, true, duration);

    const payload = {
      calendar: calendar.calendar.map((week) => ({
        week: week.week,
        posts: week.posts.map((post) => ({
          day: post.day,
          time: post.time,
          platform: post.platform,
          content_type: post.contentType,
          theme: post.theme,
          topic: post.topic,
        })),
      })),
      content_mix: calendar.contentMix,
      posting_schedule: calendar.postingSchedule,
      recommendations: calendar.recommendations,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              calendar: payload,
              metadata: {
                duration_weeks: input.duration_weeks,
                posts_per_week: input.posts_per_week,
                platforms: input.platforms,
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
    logToolExecution('generate_content_calendar', userId, {}, false, duration);

    const message = error instanceof z.ZodError
      ? `Validation error: ${error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ')}`
      : error instanceof Error
        ? error.message
        : String(error);

    logger.error('generate_content_calendar tool failed', { error: message, durationMs: duration });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: message,
              tool: 'generate_content_calendar',
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
