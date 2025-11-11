/**
 * MCP Tool: Generate KB Article
 * Generate knowledge base articles from questions
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { generateKBArticleSchema } from '../utils/validation.js';
import { generateJSON, countWords, estimateReadingTime } from '../ai/generator.js';
import { SYSTEM_PROMPTS, buildKBArticlePrompt } from '../ai/prompts.js';
import { logger } from '../utils/logger.js';
import type { GenerateKBArticleParams, KBArticleResult } from '../types/content.types.js';

export const generateKBArticleTool: Tool = {
  name: 'generate_kb_article',
  description: `Generate FAQ, how-to, or troubleshooting articles from questions.

Creates comprehensive knowledge base articles for customer self-service.

Required parameters:
- user_id: User ID for multi-tenant support
- question: The question to answer

Optional parameters:
- context: Background information to help answer the question
- format: Article format (faq, howto, troubleshooting) - default: faq

Returns:
- articleId: Generated UUID for the article
- title: Clear, descriptive title
- content: Full article in Markdown format
- format: Article format used
- wordCount: Total word count
- readingTime: Estimated reading time in minutes

Example:
{
  "user_id": "user-123",
  "question": "How do I reset my password?",
  "context": "Our app uses email-based password reset",
  "format": "howto"
}`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (required)' },
      question: { type: 'string', description: 'Question to answer' },
      context: { type: 'string', description: 'Background information (optional)' },
      format: {
        type: 'string',
        enum: ['faq', 'howto', 'troubleshooting'],
        description: 'Article format',
        default: 'faq',
      },
    },
    required: ['user_id', 'question'],
  },
};

export async function handleGenerateKBArticle(args: unknown, userId?: string) {
  const startTime = Date.now();

  try {
    // Validate parameters
    const params = generateKBArticleSchema.parse(args) as GenerateKBArticleParams;

    logger.info('Generating KB article', {
      userId: params.user_id || userId,
      question: params.question,
      format: params.format,
      hasContext: !!params.context,
    });

    // Build prompt and generate content
    const prompt = buildKBArticlePrompt(params);
    const result = await generateJSON<KBArticleResult>(
      prompt,
      SYSTEM_PROMPTS.kb_article,
      {
        temperature: 0.5, // Lower temperature for factual content
        maxTokens: 3000,
      }
    );

    // Validate result structure
    if (!result.articleId || !result.title || !result.content) {
      throw new Error('Invalid KB article generation result: missing required fields');
    }

    // Calculate word count and reading time from content
    const actualWordCount = countWords(result.content);
    const actualReadingTime = estimateReadingTime(actualWordCount);

    // Ensure wordCount and readingTime are always valid numbers
    // If AI doesn't provide them or they're invalid, use calculated values
    if (typeof result.wordCount !== 'number' || isNaN(result.wordCount) || result.wordCount <= 0) {
      result.wordCount = actualWordCount;
    } else if (Math.abs(actualWordCount - result.wordCount) > 20) {
      // Use actual counts if AI's estimates are significantly off
      result.wordCount = actualWordCount;
    }

    if (typeof result.readingTime !== 'number' || isNaN(result.readingTime) || result.readingTime <= 0) {
      result.readingTime = actualReadingTime;
    } else if (Math.abs(actualReadingTime - result.readingTime) > 1) {
      // Use actual reading time if AI's estimate is off
      result.readingTime = actualReadingTime;
    }

    // Final safety check: ensure reading time is at least 1 minute
    result.readingTime = Math.max(1, result.readingTime);

    const duration = Date.now() - startTime;

    logger.info('KB article generated successfully', {
      userId: params.user_id || userId,
      durationMs: duration,
      wordCount: result.wordCount,
      readingTime: result.readingTime,
      format: result.format,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              article: result,
              metadata: {
                question: params.question,
                format: params.format,
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

    logger.error('generate_kb_article tool failed', {
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
              tool: 'generate_kb_article',
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
