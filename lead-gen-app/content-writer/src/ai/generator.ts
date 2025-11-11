/**
 * AI Content Generation Engine
 * Uses Anthropic Claude API for content generation
 */

import Anthropic from '@anthropic-ai/sdk';
import type { GenerationOptions, AIGenerationResult } from '../types/content.types.js';
import { logger } from '../utils/logger.js';

/**
 * Initialize Anthropic client
 */
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Default generation options
 */
const DEFAULT_OPTIONS: GenerationOptions = {
  model: process.env.AI_MODEL || 'claude-sonnet-4-5-20250929',
  temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
  maxTokens: parseInt(process.env.AI_MAX_TOKENS || '4000'),
};

/**
 * Generate content using Claude AI
 *
 * @param prompt - User prompt for content generation
 * @param systemPrompt - System prompt defining AI role and behavior
 * @param options - Generation options (temperature, tokens, etc.)
 * @returns Generated content and token usage
 */
export async function generateContent(
  prompt: string,
  systemPrompt: string,
  options: Partial<GenerationOptions> = {}
): Promise<AIGenerationResult> {
  const startTime = Date.now();

  // Merge options with defaults
  const generationOptions: GenerationOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  try {
    logger.info('Generating content', {
      model: generationOptions.model,
      temperature: generationOptions.temperature,
      maxTokens: generationOptions.maxTokens,
      promptLength: prompt.length,
    });

    // Call Anthropic API
    const response = await anthropic.messages.create({
      model: generationOptions.model!,
      max_tokens: generationOptions.maxTokens!,
      temperature: generationOptions.temperature!,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      ...(generationOptions.stopSequences && { stop_sequences: generationOptions.stopSequences }),
    });

    // Extract content from response
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude API');
    }

    const generatedText = content.text;
    const duration = Date.now() - startTime;

    logger.info('Content generated successfully', {
      model: generationOptions.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      durationMs: duration,
      outputLength: generatedText.length,
    });

    return {
      content: generatedText,
      tokenUsage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  } catch (error: any) {
    logger.error('Content generation failed', {
      error: error.message,
      model: generationOptions.model,
      durationMs: Date.now() - startTime,
    });

    // Re-throw with more context
    if (error.status === 401) {
      throw new Error('Invalid Anthropic API key. Please check ANTHROPIC_API_KEY environment variable.');
    } else if (error.status === 429) {
      throw new Error('Rate limit exceeded. Please try again in a moment.');
    } else if (error.status === 529) {
      throw new Error('Anthropic API is overloaded. Please try again shortly.');
    }

    throw new Error(`AI generation failed: ${error.message}`);
  }
}

/**
 * Generate content with automatic JSON parsing
 * Extracts JSON from AI response, handling markdown code blocks
 *
 * @param prompt - User prompt for content generation
 * @param systemPrompt - System prompt defining AI role
 * @param options - Generation options
 * @returns Parsed JSON object
 */
export async function generateJSON<T = any>(
  prompt: string,
  systemPrompt: string,
  options: Partial<GenerationOptions> = {}
): Promise<T> {
  const result = await generateContent(prompt, systemPrompt, options);

  try {
    // Extract JSON from response (handles markdown code blocks)
    let jsonText = result.content.trim();

    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*\n/, '').replace(/\n```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*\n/, '').replace(/\n```$/, '');
    }

    // Parse JSON
    const parsed = JSON.parse(jsonText);

    logger.debug('JSON parsed successfully', {
      keys: Object.keys(parsed),
    });

    return parsed as T;
  } catch (error: any) {
    logger.error('JSON parsing failed', {
      error: error.message,
      response: result.content.substring(0, 200),
    });

    throw new Error(`Failed to parse AI response as JSON: ${error.message}`);
  }
}

/**
 * Generate content with retry logic
 * Automatically retries on transient failures
 *
 * @param prompt - User prompt
 * @param systemPrompt - System prompt
 * @param options - Generation options
 * @param maxRetries - Maximum retry attempts
 * @returns Generated content
 */
export async function generateWithRetry(
  prompt: string,
  systemPrompt: string,
  options: Partial<GenerationOptions> = {},
  maxRetries: number = 2
): Promise<AIGenerationResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await generateContent(prompt, systemPrompt, options);
    } catch (error: any) {
      lastError = error;

      // Don't retry on authentication or validation errors
      if (error.status === 401 || error.status === 400) {
        throw error;
      }

      // Only retry on rate limits or server errors
      if (error.status === 429 || error.status >= 500) {
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          logger.warn('Retrying content generation', {
            attempt: attempt + 1,
            maxRetries,
            delayMs: delay,
            error: error.message,
          });

          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      throw error;
    }
  }

  throw lastError || new Error('Content generation failed after retries');
}

/**
 * Estimate reading time in minutes
 * Standard reading speed: 200 words per minute
 */
export function estimateReadingTime(wordCount: number): number {
  const wordsPerMinute = 200;
  return Math.ceil(wordCount / wordsPerMinute);
}

/**
 * Count words in text
 * Handles HTML and markdown content
 */
export function countWords(text: string): number {
  // Remove HTML tags
  const withoutHtml = text.replace(/<[^>]*>/g, ' ');

  // Remove markdown syntax (basic)
  const withoutMarkdown = withoutHtml
    .replace(/#{1,6}\s/g, '') // Headings
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Bold
    .replace(/\*([^*]+)\*/g, '$1') // Italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
    .replace(/`([^`]+)`/g, '$1'); // Code

  // Split on whitespace and count
  const words = withoutMarkdown
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0);

  return words.length;
}

/**
 * Convert HTML to plain text
 * Strips HTML tags while preserving readability
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n') // Line breaks
    .replace(/<\/p>/gi, '\n\n') // Paragraph breaks
    .replace(/<[^>]*>/g, '') // Remove all other tags
    .replace(/&nbsp;/g, ' ') // Non-breaking spaces
    .replace(/&amp;/g, '&') // Ampersands
    .replace(/&lt;/g, '<') // Less than
    .replace(/&gt;/g, '>') // Greater than
    .replace(/&quot;/g, '"') // Quotes
    .replace(/&#39;/g, "'") // Apostrophes
    .replace(/\n{3,}/g, '\n\n') // Multiple newlines
    .trim();
}

/**
 * Convert plain text to HTML
 * Preserves paragraphs and line breaks
 */
export function plainTextToHtml(text: string): string {
  return text
    .split('\n\n')
    .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

/**
 * Validate API key is configured
 */
export function validateApiKey(): void {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'ANTHROPIC_API_KEY environment variable is not set. ' +
      'Please set it in your .env file or environment.'
    );
  }
}
