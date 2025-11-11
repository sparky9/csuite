/**
 * MCP Tool: Generate Headlines
 * Generate multiple headline variations for A/B testing
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { generateHeadlinesSchema } from '../utils/validation.js';
import { generateJSON } from '../ai/generator.js';
import { SYSTEM_PROMPTS, buildHeadlinesPrompt } from '../ai/prompts.js';
import { logger } from '../utils/logger.js';
import type { GenerateHeadlinesParams, HeadlinesResult } from '../types/content.types.js';

export const generateHeadlinesTool: Tool = {
  name: 'generate_headlines',
  description: `Generate multiple compelling headline variations for A/B testing.

Creates diverse headlines optimized for clickworthiness, SEO, or professional tone based on content type and goals.

Required parameters:
- topic: Content topic or main subject
- content_type: Type of content (blog, email, ad, social, landing_page)
- style: Headline style (clickworthy, professional, seo_optimized, curiosity_driven)

Optional parameters:
- count: Number of variations (default: 5, max: 20)
- max_length: Maximum character length per headline
- include_numbers: Include statistics or numbers (default: false)
- user_id: User ID for multi-tenant support

Headline Styles:
- clickworthy: Curiosity-driven, emotional appeal, power words
- professional: Clear, authoritative, credibility-focused
- seo_optimized: Keyword-inclusive, search-friendly, informative
- curiosity_driven: Questions, surprises, information gaps

Returns:
- headlines: Array of headline variations with character counts
- best_pick: AI's recommended headline with reasoning

Example:
{
  "topic": "Email Marketing Automation Tools",
  "content_type": "blog",
  "style": "clickworthy",
  "count": 3,
  "max_length": 60
}`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (optional)' },
      topic: { type: 'string', description: 'Content topic or subject' },
      content_type: {
        type: 'string',
        enum: ['blog', 'email', 'ad', 'social', 'landing_page'],
        description: 'Type of content',
      },
      count: {
        type: 'number',
        description: 'Number of variations (default: 5)',
        default: 5,
        minimum: 1,
        maximum: 20,
      },
      max_length: { type: 'number', description: 'Max character length per headline' },
      include_numbers: {
        type: 'boolean',
        description: 'Include numbers/statistics',
        default: false,
      },
      style: {
        type: 'string',
        enum: ['clickworthy', 'professional', 'seo_optimized', 'curiosity_driven'],
        description: 'Headline style',
      },
    },
    required: ['topic', 'content_type', 'style'],
  },
};

export async function handleGenerateHeadlines(args: unknown, userId?: string) {
  const startTime = Date.now();

  try {
    // Validate parameters
    const params = generateHeadlinesSchema.parse(args) as GenerateHeadlinesParams;

    logger.info('Generating headlines', {
      userId: params.user_id || userId,
      topic: params.topic,
      contentType: params.content_type,
      style: params.style,
      count: params.count,
    });

    // Build prompt and generate content
    const prompt = buildHeadlinesPrompt(params);
    const result = await generateJSON<HeadlinesResult>(
      prompt,
      SYSTEM_PROMPTS.headlines,
      { temperature: 0.8 } // Creative task benefits from higher temperature
    );

    // Validate result structure
    if (!result.headlines || !result.best_pick) {
      throw new Error('Invalid headlines generation result: missing required fields');
    }

    // Verify headline count matches request
    if (result.headlines.length !== (params.count || 5)) {
      logger.warn('Generated headline count mismatch', {
        requested: params.count || 5,
        generated: result.headlines.length,
      });
    }

    // Validate character counts
    const tooLong = result.headlines.filter(
      (h) => params.max_length !== undefined && h.text.length > params.max_length
    );

    if (tooLong.length > 0) {
      logger.warn('Some headlines exceed max length', {
        maxLength: params.max_length,
        exceededCount: tooLong.length,
      });
    }

    const duration = Date.now() - startTime;

    logger.info('Headlines generated successfully', {
      userId: params.user_id || userId,
      durationMs: duration,
      headlineCount: result.headlines.length,
      avgLength: Math.round(result.headlines.reduce((sum, h) => sum + h.text.length, 0) / result.headlines.length),
      bestPickLength: result.best_pick.headline.length,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              headlines: result,
              metadata: {
                topic: params.topic,
                content_type: params.content_type,
                style: params.style,
                requested_count: params.count || 5,
                actual_count: result.headlines.length,
                max_length: params.max_length,
                all_within_limit: !params.max_length || result.headlines.every(h => h.text.length <= params.max_length),
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

    logger.error('generate_headlines tool failed', {
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
              tool: 'generate_headlines',
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
