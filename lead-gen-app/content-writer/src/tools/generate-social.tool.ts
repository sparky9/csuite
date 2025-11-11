/**
 * MCP Tool: Generate Social Post
 * Generate platform-optimized social media posts
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { generateSocialSchema } from '../utils/validation.js';
import { generateJSON } from '../ai/generator.js';
import { SYSTEM_PROMPTS, buildSocialPrompt } from '../ai/prompts.js';
import { logger } from '../utils/logger.js';
import type { GenerateSocialParams, SocialResult } from '../types/content.types.js';
import { PLATFORM_CONSTRAINTS } from '../types/content.types.js';

export const generateSocialTool: Tool = {
  name: 'generate_social_post',
  description: `Generate platform-optimized social media posts.

Creates engaging posts tailored to specific social media platforms with appropriate length, tone, and format.

Required parameters:
- platform: Social platform (linkedin, twitter, facebook, instagram)
- topic: Post topic
- message: Core message to communicate
- tone: Post tone (professional, casual, inspirational, humorous, educational)

Optional parameters:
- include_hashtags: Include relevant hashtags (default: true)
- include_emojis: Include emojis (default: false)
- call_to_action: Specific CTA to include
- max_length: Custom character limit (overrides platform default)
- user_id: User ID for multi-tenant support

Platform Limits:
- Twitter: 280 characters
- LinkedIn: 3000 characters
- Facebook: 500 characters (recommended)
- Instagram: 2200 characters

Returns:
- post_text: Formatted post content
- hashtags: Array of relevant hashtags
- character_count: Total character count
- suggested_image_description: Image recommendation (optional)

Example:
{
  "platform": "linkedin",
  "topic": "Remote team productivity",
  "message": "Share our new async communication framework",
  "tone": "professional",
  "include_hashtags": true,
  "call_to_action": "Download the free guide"
}`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (optional)' },
      platform: {
        type: 'string',
        enum: ['linkedin', 'twitter', 'facebook', 'instagram'],
        description: 'Social media platform',
      },
      topic: { type: 'string', description: 'Post topic' },
      message: { type: 'string', description: 'Core message' },
      tone: {
        type: 'string',
        enum: ['professional', 'casual', 'inspirational', 'humorous', 'educational', 'friendly', 'conversational'],
        description: 'Post tone',
      },
      include_hashtags: { type: 'boolean', description: 'Include hashtags (default: true)' },
      include_emojis: { type: 'boolean', description: 'Include emojis (default: false)' },
      call_to_action: { type: 'string', description: 'Call to action (optional)' },
      max_length: { type: 'number', description: 'Custom character limit (optional)' },
    },
    required: ['platform', 'topic', 'message', 'tone'],
  },
};

export async function handleGenerateSocial(args: unknown, userId?: string) {
  const startTime = Date.now();

  try {
    // Validate parameters
    const params = generateSocialSchema.parse(args) as GenerateSocialParams;

    // Get platform constraints
    const platformConstraints = PLATFORM_CONSTRAINTS[params.platform];

    logger.info('Generating social post', {
      userId: params.user_id || userId,
      platform: params.platform,
      tone: params.tone,
      maxLength: params.max_length || platformConstraints.maxLength,
    });

    // Build prompt and generate content
    const prompt = buildSocialPrompt(params);
    const result = await generateJSON<SocialResult>(
      prompt,
      SYSTEM_PROMPTS.social,
      { temperature: 0.8 } // Social content benefits from creativity
    );

    // Validate result structure
    if (!result.post_text || !result.hashtags || result.character_count === undefined) {
      throw new Error('Invalid social post generation result: missing required fields');
    }

    // Verify character count
    const actualCharCount = result.post_text.length;
    if (Math.abs(actualCharCount - result.character_count) > 5) {
      result.character_count = actualCharCount;
    }

    // Warn if exceeds platform limit
    const maxLength = params.max_length || platformConstraints.maxLength;
    if (result.character_count > maxLength) {
      logger.warn('Generated post exceeds platform limit', {
        platform: params.platform,
        characterCount: result.character_count,
        maxLength,
      });
    }

    const duration = Date.now() - startTime;

    logger.info('Social post generated successfully', {
      userId: params.user_id || userId,
      platform: params.platform,
      durationMs: duration,
      characterCount: result.character_count,
      hashtagCount: result.hashtags.length,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              post: result,
              metadata: {
                platform: params.platform,
                tone: params.tone,
                within_limit: result.character_count <= maxLength,
                platform_max_length: maxLength,
                generation_time_ms: duration,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error('generate_social_post tool failed', {
      error: error.message,
      durationMs: duration,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: error.message,
              tool: 'generate_social_post',
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}
