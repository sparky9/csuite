/**
 * MCP Tool: Generate Blog Post
 * Generate long-form blog content with SEO optimization
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { generateBlogSchema } from '../utils/validation.js';
import { generateJSON, countWords, estimateReadingTime } from '../ai/generator.js';
import { SYSTEM_PROMPTS, buildBlogPrompt } from '../ai/prompts.js';
import { logger } from '../utils/logger.js';
import type { GenerateBlogParams, BlogResult } from '../types/content.types.js';

export const generateBlogTool: Tool = {
  name: 'generate_blog_post',
  description: `Generate comprehensive blog posts with SEO optimization.

Creates engaging, well-structured blog content optimized for search engines and readers.

Required parameters:
- topic: Blog post topic
- keywords: Array of SEO keywords to include
- audience: Target reader description
- tone: Content tone (professional, conversational, technical, storytelling)
- length: Post length (short: 500-800 words, medium: 800-1500 words, long: 1500-2500 words)

Optional parameters:
- outline: Array of section headings to structure the post
- include_intro: Include introduction (default: true)
- include_conclusion: Include conclusion (default: true)
- user_id: User ID for multi-tenant support

Returns:
- title: SEO-optimized blog title
- meta_description: 150-160 character meta description
- content_html: Full blog content in HTML
- content_markdown: Full content in Markdown
- word_count: Total word count
- reading_time_minutes: Estimated reading time

Example:
{
  "topic": "Email Marketing Automation for Startups",
  "keywords": ["email automation", "startup marketing", "lead nurturing"],
  "audience": "Early-stage SaaS founders",
  "tone": "professional",
  "length": "medium",
  "outline": ["Why Automation Matters", "Top Tools for Startups", "Getting Started"]
}`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (optional)' },
      topic: { type: 'string', description: 'Blog post topic' },
      keywords: {
        type: 'array',
        items: { type: 'string' },
        description: 'SEO keywords',
      },
      audience: { type: 'string', description: 'Target reader' },
      tone: {
        type: 'string',
        enum: ['professional', 'conversational', 'technical', 'storytelling', 'friendly', 'casual', 'formal', 'educational'],
        description: 'Content tone',
      },
      length: {
        type: 'string',
        enum: ['short', 'medium', 'long'],
        description: 'Post length',
      },
      outline: {
        type: 'array',
        items: { type: 'string' },
        description: 'Section headings (optional)',
      },
      include_intro: { type: 'boolean', description: 'Include introduction (default: true)' },
      include_conclusion: { type: 'boolean', description: 'Include conclusion (default: true)' },
    },
    required: ['topic', 'keywords', 'audience', 'tone', 'length'],
  },
};

export async function handleGenerateBlog(args: unknown, userId?: string) {
  const startTime = Date.now();

  try {
    // Validate parameters
    const params = generateBlogSchema.parse(args) as GenerateBlogParams;

    logger.info('Generating blog post', {
      userId: params.user_id || userId,
      topic: params.topic,
      tone: params.tone,
      length: params.length,
      keywordCount: params.keywords.length,
    });

    // Build prompt and generate content
    const prompt = buildBlogPrompt(params);
    const result = await generateJSON<BlogResult>(
      prompt,
      SYSTEM_PROMPTS.blog,
      {
        temperature: 0.7,
        maxTokens: 6000, // Blog posts need more tokens
      }
    );

    // Validate result structure
    if (!result.title || !result.content_html || !result.content_markdown) {
      throw new Error('Invalid blog generation result: missing required fields');
    }

    // Verify word count and reading time are accurate
    const actualWordCount = countWords(result.content_html);
    const actualReadingTime = estimateReadingTime(actualWordCount);

    // Use actual counts if AI's estimates are off
    if (Math.abs(actualWordCount - result.word_count) > 50) {
      result.word_count = actualWordCount;
      result.reading_time_minutes = actualReadingTime;
    }

    const duration = Date.now() - startTime;

    logger.info('Blog post generated successfully', {
      userId: params.user_id || userId,
      durationMs: duration,
      wordCount: result.word_count,
      readingTime: result.reading_time_minutes,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              blog: result,
              metadata: {
                topic: params.topic,
                tone: params.tone,
                length: params.length,
                keywords: params.keywords,
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

    logger.error('generate_blog_post tool failed', {
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
              tool: 'generate_blog_post',
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
