/**
 * MCP Tool: Generate Thread
 * Generate multi-post threads for platforms like Twitter and LinkedIn
 */

import crypto from 'crypto';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { generateThread } from '../ai/generator.js';
import { logger, logToolExecution } from '../utils/logger.js';
import { socialDb } from '../db/client.js';

export const generateThreadTool: Tool = {
  name: 'generate_thread',
  description: `Generate multi-post threads for platforms like Twitter and LinkedIn.

Creates engaging thread content that tells a story across multiple posts.

Required parameters:
- topic: Thread topic or subject
- platform: Target platform (twitter or linkedin)
- thread_length: Number of posts in thread (2-10)

Optional parameters:
- tone: Thread tone
- goal: Thread goal
- include_hook: Start with attention-grabbing hook
- user_id: User ID for multi-tenant support

Returns:
- thread_posts: Array of posts in order
- thread_structure: How the thread is organized
- engagement_tips: Tips for maximizing thread engagement

Example:
{
  "topic": "How to build a SaaS product",
  "platform": "twitter",
  "thread_length": 5,
  "tone": "educational",
  "include_hook": true
}`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (optional)' },
      topic: { type: 'string', description: 'Thread topic' },
      platform: {
        type: 'string',
        enum: ['twitter', 'linkedin'],
        description: 'Target platform',
      },
      thread_length: { type: 'number', description: 'Number of posts (2-10)' },
      tone: {
        type: 'string',
        enum: ['professional', 'casual', 'educational', 'inspirational'],
        description: 'Thread tone (optional)',
      },
      goal: {
        type: 'string',
        enum: ['educate', 'inspire', 'promote', 'engage'],
        description: 'Thread goal (optional)',
      },
      include_hook: { type: 'boolean', description: 'Start with hook (optional)' },
    },
    required: ['topic', 'platform', 'thread_length'],
  },
};

const ThreadSchema = z.object({
  user_id: z.string().optional(),
  topic: z.string().min(3),
  platform: z.enum(['twitter', 'linkedin']),
  thread_length: z.coerce.number().int().min(2).max(12),
  tone: z.enum(['professional', 'casual', 'educational', 'inspirational']).optional(),
  goal: z.enum(['educate', 'inspire', 'promote', 'engage']).optional(),
  include_hook: z.boolean().optional(),
});

const THREAD_GOAL_MAP: Record<'educate' | 'inspire' | 'promote' | 'engage', 'engagement' | 'awareness' | 'traffic' | 'conversion'> = {
  educate: 'engagement',
  inspire: 'awareness',
  promote: 'conversion',
  engage: 'engagement',
};

export async function handleGenerateThread(args: unknown, userId?: string) {
  const startTime = Date.now();

  try {
    const input = ThreadSchema.parse(args);
    const effectiveUserId = input.user_id || userId;

    logger.info('Generating deterministic thread', {
      userId: effectiveUserId,
      topic: input.topic,
      platform: input.platform,
      length: input.thread_length,
    });

    const generatorTone = (input.tone ?? 'educational') as 'professional' | 'casual' | 'inspirational' | 'educational';
    const goal = input.goal ? THREAD_GOAL_MAP[input.goal] : undefined;

    const thread = generateThread({
      topic: input.topic,
      platform: input.platform,
      threadLength: input.thread_length,
      tone: generatorTone,
      goal,
      includeHook: input.include_hook,
    });

    const threadId = crypto.randomUUID();

    if (socialDb.connected) {
      await socialDb.query(
        `INSERT INTO social_threads (
          id, user_id, platform, topic, hook, closing_remark, recommendations, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          threadId,
          effectiveUserId ?? null,
          input.platform,
          input.topic,
          thread.hook,
          thread.closingRemark,
          thread.recommendations,
        ],
      );

      for (const post of thread.posts) {
        await socialDb.query(
          `INSERT INTO social_posts (
            user_id, topic, content, platform, tone, hashtags,
            emoji_count, character_count, confidence_score, goal, audience,
            created_at, thread_id, thread_position
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12, $13)`,
          [
            effectiveUserId ?? null,
            input.topic,
            post.content,
            input.platform,
            generatorTone,
            post.hashtags,
            post.emojiCount,
            post.characterCount,
            post.confidenceScore,
            goal ?? null,
            null,
            threadId,
            post.position,
          ],
        );
      }
    }

    const duration = Date.now() - startTime;
    logToolExecution('generate_thread', effectiveUserId, input, true, duration);

    const payload = {
      hook: thread.hook,
      closing_remark: thread.closingRemark,
      recommendations: thread.recommendations,
      thread_posts: thread.posts.map((post) => ({
        post_number: post.position,
        content: post.content,
        character_count: post.characterCount,
        hashtags: post.hashtags,
        confidence_score: post.confidenceScore,
      })),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              thread: payload,
              metadata: {
                topic: input.topic,
                platform: input.platform,
                thread_length: input.thread_length,
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
    logToolExecution('generate_thread', userId, {}, false, duration);

    const message = error instanceof z.ZodError
      ? `Validation error: ${error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ')}`
      : error instanceof Error
        ? error.message
        : String(error);

    logger.error('generate_thread tool failed', { error: message, durationMs: duration });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: message,
              tool: 'generate_thread',
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
