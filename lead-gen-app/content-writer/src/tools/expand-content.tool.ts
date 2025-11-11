/**
 * MCP Tool: Expand Content
 * Expand brief content into comprehensive pieces
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { expandContentSchema } from '../utils/validation.js';
import { generateJSON, countWords } from '../ai/generator.js';
import { SYSTEM_PROMPTS, buildExpandPrompt } from '../ai/prompts.js';
import { logger } from '../utils/logger.js';
import type { ExpandContentParams, ExpandResult } from '../types/content.types.js';

export const expandContentTool: Tool = {
  name: 'expand_content',
  description: `Expand brief content into comprehensive, full-length pieces.

Transforms notes, bullet points, or short text into detailed content with depth, examples, and structure.

Required parameters:
- brief_content: Short notes or text to expand
- target_format: Output format (paragraph, article, script, outline)
- target_length: Desired length (short, medium, long)
- tone: Content tone (professional, conversational, technical, storytelling, etc.)

Optional parameters:
- add_examples: Include relevant examples (default: true)
- user_id: User ID for multi-tenant support

Target Lengths:
- short: 200-400 words (modest expansion)
- medium: 400-800 words (substantial development)
- long: 800-1500 words (comprehensive expansion)

Formats:
- paragraph: Continuous prose with smooth transitions
- article: Full article with introduction, body, conclusion
- script: Script format with clear points and transitions
- outline: Detailed hierarchical outline with main points and sub-points

Returns:
- expanded_content: Full expanded content
- word_count: Total word count
- structure: Description of content organization

Example:
{
  "brief_content": "AI marketing tools: content creation, email automation, prospecting",
  "target_format": "article",
  "target_length": "medium",
  "tone": "professional",
  "add_examples": true
}`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (optional)' },
      brief_content: { type: 'string', description: 'Brief content to expand' },
      target_format: {
        type: 'string',
        enum: ['paragraph', 'article', 'script', 'outline'],
        description: 'Output format',
      },
      target_length: {
        type: 'string',
        enum: ['short', 'medium', 'long'],
        description: 'Expansion length',
      },
      tone: {
        type: 'string',
        enum: ['professional', 'conversational', 'technical', 'storytelling', 'friendly', 'casual', 'formal', 'educational', 'inspirational', 'humorous'],
        description: 'Content tone',
      },
      add_examples: {
        type: 'boolean',
        description: 'Include examples (default: true)',
        default: true,
      },
    },
    required: ['brief_content', 'target_format', 'target_length', 'tone'],
  },
};

export async function handleExpandContent(args: unknown, userId?: string) {
  const startTime = Date.now();

  try {
    // Validate parameters
    const params = expandContentSchema.parse(args) as ExpandContentParams;

    // Count brief content words
    const briefWordCount = countWords(params.brief_content);

    // Validate brief content isn't too long (should be 2-100 words)
    if (briefWordCount > 200) {
      throw new Error(`Brief content too long (found ${briefWordCount} words, maximum 200 for expansion input)`);
    }

    if (briefWordCount < 3) {
      throw new Error(`Brief content too short (found ${briefWordCount} words, minimum 3 for meaningful expansion)`);
    }

    logger.info('Expanding content', {
      userId: params.user_id || userId,
      targetFormat: params.target_format,
      targetLength: params.target_length,
      tone: params.tone,
      briefWordCount,
      addExamples: params.add_examples,
    });

    // Build prompt and generate content
    const prompt = buildExpandPrompt(params);
    const result = await generateJSON<ExpandResult>(
      prompt,
      SYSTEM_PROMPTS.expand,
      { temperature: 0.7 } // Creative task needs moderate temperature
    );

    // Validate result structure
    if (!result.expanded_content) {
      throw new Error('Invalid expansion result: missing expanded_content');
    }

    // Verify word count
    const actualWordCount = countWords(result.expanded_content);
    if (!result.word_count || Math.abs(result.word_count - actualWordCount) > 50) {
      result.word_count = actualWordCount;
    }

    // Ensure structure description exists
    if (!result.structure) {
      result.structure = `Expanded as ${params.target_format} format with ${params.target_length} length`;
    }

    const duration = Date.now() - startTime;

    logger.info('Content expanded successfully', {
      userId: params.user_id || userId,
      durationMs: duration,
      briefWords: briefWordCount,
      finalWords: result.word_count,
      expansionRatio: result.word_count / briefWordCount,
      format: params.target_format,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              expansion: result,
              metadata: {
                brief_word_count: briefWordCount,
                expansion_ratio: `${result.word_count} words from ${briefWordCount} (${Math.round((result.word_count / briefWordCount) * 10) / 10}x)`,
                target_format: params.target_format,
                target_length: params.target_length,
                tone: params.tone,
                add_examples: params.add_examples,
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

    logger.error('expand_content tool failed', {
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
              tool: 'expand_content',
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
