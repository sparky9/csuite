/**
 * MCP Tool: Generate Post
 * Generate engaging social media posts optimized for specific platforms
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { generatePosts } from '../ai/generator.js';
import { logger } from '../utils/logger.js';
import type { SocialPlatform } from '../types/social.types.js';
import { socialDb } from '../db/client.js';
import { logToolExecution } from '../utils/logger.js';

export const generatePostTool: Tool = {
  name: 'generate_post',
  description: `Generate engaging social media posts optimized for specific platforms.

Creates platform-optimized content with hashtags, emojis, and calls-to-action.

Required parameters:
- topic: The topic or subject of the post
- platforms: Array of target platforms (linkedin, twitter, facebook)
- tone: Desired tone (professional, casual, inspirational, educational, humorous)

Optional parameters:
- audience: Target audience description
- goal: Post goal (engagement, awareness, traffic, conversion)
- include_hashtags: Whether to include hashtags (default: true)
- include_emojis: Whether to include emojis (default: true for twitter/facebook)
- call_to_action: Specific CTA to include
- context: Additional context or brand guidelines
- user_id: User ID for multi-tenant support

Returns:
- posts: Array of platform-specific posts with content, hashtags, and metadata
- estimated_performance: AI prediction of post performance
- recommendations: Optimization suggestions

Example:
{
  "topic": "New product launch",
  "platforms": ["linkedin", "twitter"],
  "tone": "professional",
  "audience": "B2B SaaS founders",
  "goal": "awareness",
  "call_to_action": "Learn more at our website"
}`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (optional)' },
      topic: { type: 'string', description: 'Post topic or subject' },
      platforms: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['linkedin', 'twitter', 'facebook'],
        },
        description: 'Target platforms',
      },
      tone: {
        type: 'string',
        enum: ['professional', 'casual', 'inspirational', 'educational', 'humorous'],
        description: 'Post tone',
      },
      audience: { type: 'string', description: 'Target audience (optional)' },
      goal: {
        type: 'string',
        enum: ['engagement', 'awareness', 'traffic', 'conversion'],
        description: 'Post goal (optional)',
      },
      include_hashtags: { type: 'boolean', description: 'Include hashtags (optional)' },
      include_emojis: { type: 'boolean', description: 'Include emojis (optional)' },
      call_to_action: { type: 'string', description: 'Call to action (optional)' },
      context: { type: 'string', description: 'Additional context (optional)' },
    },
    required: ['topic', 'platforms', 'tone'],
  },
};

const GeneratePostSchema = z.object({
  user_id: z.string().optional(),
  topic: z.string().min(3, 'Topic must be at least 3 characters'),
  platforms: z.array(z.enum(['linkedin', 'twitter', 'facebook'])).min(1, 'At least one platform is required'),
  tone: z.enum(['professional', 'casual', 'inspirational', 'educational', 'humorous']),
  audience: z.string().optional(),
  goal: z.enum(['engagement', 'awareness', 'traffic', 'conversion']).optional(),
  include_hashtags: z.boolean().optional(),
  include_emojis: z.boolean().optional(),
  call_to_action: z.string().optional(),
  context: z.string().optional(),
});

export async function handleGeneratePost(args: unknown, userId?: string) {
  const startTime = Date.now();

  try {
    const input = GeneratePostSchema.parse(args);
    const effectiveUserId = input.user_id || userId;

    logger.info('Generating social media post batch', {
      userId: effectiveUserId,
      topic: input.topic,
      platforms: input.platforms,
      tone: input.tone,
    });

    const batch = generatePosts({
      topic: input.topic,
      platforms: input.platforms as SocialPlatform[],
      tone: input.tone,
      goal: input.goal,
      audience: input.audience,
      includeHashtags: input.include_hashtags,
      includeEmojis: input.include_emojis,
      callToAction: input.call_to_action,
      context: input.context,
    });

    if (socialDb.connected) {
      for (const post of batch.posts) {
        await socialDb.query(
          `INSERT INTO social_posts (
            user_id, topic, content, platform, tone, hashtags,
            emoji_count, character_count, confidence_score, goal, audience, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
          [
            effectiveUserId ?? null,
            input.topic,
            post.content,
            post.platform,
            input.tone,
            post.hashtags,
            post.emojiCount,
            post.characterCount,
            post.confidenceScore,
            input.goal ?? null,
            input.audience ?? null,
          ],
        );
      }
    }

    const duration = Date.now() - startTime;

    logToolExecution('generate_post', effectiveUserId, input, true, duration);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              generated_posts: batch,
              metadata: {
                generation_time_ms: duration,
                topic: input.topic,
                platforms: input.platforms,
                tone: input.tone,
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
    logger.error('generate_post tool failed', {
      error: error instanceof Error ? error.message : String(error),
      durationMs: duration,
    });

    logToolExecution('generate_post', userId, {}, false, duration);

    const message = error instanceof z.ZodError
      ? `Validation error: ${error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ')}`
      : error instanceof Error
        ? error.message
        : String(error);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: message,
              tool: 'generate_post',
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
