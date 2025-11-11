/**
 * MCP Tool: Generate Email
 * Generate professional email copy for various purposes
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { generateEmailSchema } from '../utils/validation.js';
import { generateJSON } from '../ai/generator.js';
import { SYSTEM_PROMPTS, buildEmailPrompt } from '../ai/prompts.js';
import { logger } from '../utils/logger.js';
import type { GenerateEmailParams, EmailResult } from '../types/content.types.js';

export const generateEmailTool: Tool = {
  name: 'generate_email',
  description: `Generate professional email copy for various purposes.

Creates compelling, well-structured emails optimized for the specified purpose and audience.

Required parameters:
- purpose: Email type (newsletter, announcement, promotion, transactional, cold_outreach, follow_up)
- audience: Description of target audience
- topic: Email topic/subject
- key_points: Array of main points to cover
- tone: Email tone (professional, friendly, casual, formal, persuasive)
- length: Email length (short: 100-200 words, medium: 200-400 words, long: 400-600 words)

Optional parameters:
- call_to_action: Desired CTA
- context: Additional context for personalization
- user_id: User ID for multi-tenant support

Returns:
- subject_line: Compelling subject line under 60 characters
- body_html: Email body in HTML format
- body_plain: Plain text version
- preview_text: First 100 characters for inbox preview

Example:
{
  "purpose": "cold_outreach",
  "audience": "B2B SaaS founders",
  "topic": "Lead generation automation",
  "key_points": ["Save 10+ hours/week", "Increase qualified leads by 40%"],
  "tone": "professional",
  "length": "medium",
  "call_to_action": "Book a 15-minute demo"
}`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (optional)' },
      purpose: {
        type: 'string',
        enum: ['newsletter', 'announcement', 'promotion', 'transactional', 'cold_outreach', 'follow_up'],
        description: 'Email purpose',
      },
      audience: { type: 'string', description: 'Target audience description' },
      topic: { type: 'string', description: 'Email topic' },
      key_points: {
        type: 'array',
        items: { type: 'string' },
        description: 'Main points to cover',
      },
      tone: {
        type: 'string',
        enum: ['professional', 'friendly', 'casual', 'formal', 'persuasive', 'conversational', 'technical', 'storytelling', 'inspirational', 'humorous', 'educational'],
        description: 'Email tone',
      },
      length: {
        type: 'string',
        enum: ['short', 'medium', 'long'],
        description: 'Email length',
      },
      call_to_action: { type: 'string', description: 'Call to action (optional)' },
      context: { type: 'string', description: 'Additional context (optional)' },
    },
    required: ['purpose', 'audience', 'topic', 'key_points', 'tone', 'length'],
  },
};

export async function handleGenerateEmail(args: unknown, userId?: string) {
  const startTime = Date.now();

  try {
    // Validate parameters
    const params = generateEmailSchema.parse(args) as GenerateEmailParams;

    logger.info('Generating email', {
      userId: params.user_id || userId,
      purpose: params.purpose,
      tone: params.tone,
      length: params.length,
    });

    // Build prompt and generate content
    const prompt = buildEmailPrompt(params);
    const result = await generateJSON<EmailResult>(
      prompt,
      SYSTEM_PROMPTS.email,
      { temperature: 0.7 } // Creative content needs higher temperature
    );

    // Validate result structure
    if (!result.subject_line || !result.body_html || !result.body_plain || !result.preview_text) {
      throw new Error('Invalid email generation result: missing required fields');
    }

    const duration = Date.now() - startTime;

    logger.info('Email generated successfully', {
      userId: params.user_id || userId,
      durationMs: duration,
      subjectLength: result.subject_line.length,
      bodyLength: result.body_html.length,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              email: result,
              metadata: {
                purpose: params.purpose,
                tone: params.tone,
                length: params.length,
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

    logger.error('generate_email tool failed', {
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
              tool: 'generate_email',
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
