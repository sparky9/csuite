/**
 * MCP Tool: Summarize Content
 * Create concise summaries of long content
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { summarizeContentSchema } from '../utils/validation.js';
import { generateJSON, countWords } from '../ai/generator.js';
import { SYSTEM_PROMPTS, buildSummarizePrompt } from '../ai/prompts.js';
import { logger } from '../utils/logger.js';
import type { SummarizeContentParams, SummaryResult } from '../types/content.types.js';

export const summarizeContentTool: Tool = {
  name: 'summarize_content',
  description: `Create concise, well-structured summaries of long content.

Extracts key points and provides formatted summaries for efficient content consumption.

Required parameters:
- content: Text content to summarize
- length: Summary length (one_sentence, short, medium, long)
- format: Output format (paragraph, bullet_points, key_takeaways)

Optional parameters:
- focus: Specific aspect or section to emphasize
- user_id: User ID for multi-tenant support

Summary Lengths:
- one_sentence: 15-30 words in a single sentence
- short: 50-100 words (brief overview)
- medium: 100-200 words (balanced summary)
- long: 200-300 words (detailed summary)

Formats:
- paragraph: Continuous prose summary
- bullet_points: Clear point-by-point breakdown
- key_takeaways: List of actionable insights

Returns:
- summary: Formatted summary content
- key_points: Array of extracted key points
- original_word_count: Original content word count
- summary_word_count: Summary word count

Example:
{
  "content": "Long article about digital marketing...",
  "length": "short",
  "format": "bullet_points",
  "focus": "strategic recommendations"
}`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (optional)' },
      content: { type: 'string', description: 'Content to summarize' },
      length: {
        type: 'string',
        enum: ['one_sentence', 'short', 'medium', 'long'],
        description: 'Summary length',
      },
      format: {
        type: 'string',
        enum: ['paragraph', 'bullet_points', 'key_takeaways'],
        description: 'Summary format',
      },
      focus: { type: 'string', description: 'Focus area or aspect to emphasize (optional)' },
    },
    required: ['content', 'length', 'format'],
  },
};

export async function handleSummarizeContent(args: unknown, userId?: string) {
  const startTime = Date.now();

  try {
    // Validate parameters
    const params = summarizeContentSchema.parse(args) as SummarizeContentParams;

    // Count original words
    const originalWordCount = countWords(params.content);

    // Validate content isn't too short for meaningful summary
    if (originalWordCount < 50) {
      throw new Error(`Content too short for meaningful summary (found ${originalWordCount} words, minimum 50)`);
    }

    logger.info('Summarizing content', {
      userId: params.user_id || userId,
      length: params.length,
      format: params.format,
      focus: params.focus,
      originalWordCount,
    });

    // Build prompt and generate content
    const prompt = buildSummarizePrompt(params);
    const result = await generateJSON<SummaryResult>(
      prompt,
      SYSTEM_PROMPTS.summarize,
      { temperature: 0.3 } // Lower temperature for accurate summarization
    );

    // Validate result structure
    if (!result.summary && !result.key_points) {
      throw new Error('Invalid summary result: both summary and key_points cannot be empty');
    }

    // Verify word counts
    if (!result.original_word_count || result.original_word_count !== originalWordCount) {
      result.original_word_count = originalWordCount;
    }

    const summaryWordCount = countWords(result.summary);
    if (!result.summary_word_count || Math.abs(result.summary_word_count - summaryWordCount) > 10) {
      result.summary_word_count = summaryWordCount;
    }

    const duration = Date.now() - startTime;

    logger.info('Content summarized successfully', {
      userId: params.user_id || userId,
      durationMs: duration,
      originalWords: result.original_word_count,
      summaryWords: result.summary_word_count,
      compressionRatio: Math.round((result.summary_word_count / result.original_word_count) * 100),
      keyPointsCount: result.key_points.length,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              summary: result,
              metadata: {
                length: params.length,
                format: params.format,
                focus: params.focus,
                compression_ratio: `${result.summary_word_count}/${result.original_word_count} (${Math.round((result.summary_word_count / result.original_word_count) * 100)}%)`,
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

    logger.error('summarize_content tool failed', {
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
              tool: 'summarize_content',
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
