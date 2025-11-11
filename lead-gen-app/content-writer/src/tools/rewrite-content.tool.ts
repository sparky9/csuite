/**
 * MCP Tool: Rewrite Content
 * Improve or modify existing content based on specific goals
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { rewriteContentSchema } from '../utils/validation.js';
import { generateJSON, countWords } from '../ai/generator.js';
import { SYSTEM_PROMPTS, buildRewritePrompt } from '../ai/prompts.js';
import { logger } from '../utils/logger.js';
import type { RewriteContentParams, RewriteResult } from '../types/content.types.js';

export const rewriteContentTool: Tool = {
  name: 'rewrite_content',
  description: `Rewrite and improve existing content based on specific goals.

Transforms content to improve clarity, adjust length, change tone, or fix grammar while preserving core meaning.

Required parameters:
- content: Original content to rewrite
- goal: Rewrite objective (improve_clarity, shorten, lengthen, simplify, professionalize, casualize, fix_grammar)

Optional parameters:
- tone: Target tone if changing voice
- preserve_meaning: Keep core message intact (default: true)
- target_length: Desired word count
- user_id: User ID for multi-tenant support

Rewrite Goals:
- improve_clarity: Make content clearer and easier to understand
- shorten: Reduce length while keeping key information
- lengthen: Expand with additional detail and context
- simplify: Use simpler language and shorter sentences
- professionalize: Elevate tone for business context
- casualize: Make more relaxed and conversational
- fix_grammar: Correct errors while maintaining voice

Returns:
- rewritten_content: Improved content
- original_word_count: Original word count
- new_word_count: New word count
- changes_summary: Description of changes made

Example:
{
  "content": "We help companies get more leads. Our software is really good and easy to use.",
  "goal": "professionalize",
  "tone": "professional"
}`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (optional)' },
      content: { type: 'string', description: 'Content to rewrite' },
      goal: {
        type: 'string',
        enum: ['improve_clarity', 'shorten', 'lengthen', 'simplify', 'professionalize', 'casualize', 'fix_grammar'],
        description: 'Rewrite goal',
      },
      tone: {
        type: 'string',
        enum: ['professional', 'friendly', 'casual', 'formal', 'conversational', 'technical'],
        description: 'Target tone (optional)',
      },
      preserve_meaning: { type: 'boolean', description: 'Preserve core meaning (default: true)' },
      target_length: { type: 'number', description: 'Target word count (optional)' },
    },
    required: ['content', 'goal'],
  },
};

export async function handleRewriteContent(args: unknown, userId?: string) {
  const startTime = Date.now();

  try {
    // Validate parameters
    const params = rewriteContentSchema.parse(args) as RewriteContentParams;

    // Count original words
    const originalWordCount = countWords(params.content);

    logger.info('Rewriting content', {
      userId: params.user_id || userId,
      goal: params.goal,
      originalWordCount,
      targetLength: params.target_length,
    });

    // Build prompt and generate content
    const prompt = buildRewritePrompt(params);
    const result = await generateJSON<RewriteResult>(
      prompt,
      SYSTEM_PROMPTS.rewrite,
      { temperature: 0.5 } // Lower temperature for rewriting to maintain accuracy
    );

    // Validate result structure
    if (!result.rewritten_content || !result.changes_summary) {
      throw new Error('Invalid rewrite result: missing required fields');
    }

    // Verify word counts
    const actualOriginalCount = countWords(params.content);
    const actualNewCount = countWords(result.rewritten_content);

    result.original_word_count = actualOriginalCount;
    result.new_word_count = actualNewCount;

    const duration = Date.now() - startTime;

    logger.info('Content rewritten successfully', {
      userId: params.user_id || userId,
      goal: params.goal,
      durationMs: duration,
      originalWords: result.original_word_count,
      newWords: result.new_word_count,
      changePercentage: Math.round(((result.new_word_count - result.original_word_count) / result.original_word_count) * 100),
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              rewrite: result,
              metadata: {
                goal: params.goal,
                tone: params.tone,
                preserve_meaning: params.preserve_meaning,
                word_change: result.new_word_count - result.original_word_count,
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

    logger.error('rewrite_content tool failed', {
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
              tool: 'rewrite_content',
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
