/**
 * MCP Tool: Suggest Email Reply
 * AI-powered email reply suggestions using Claude
 */

import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { getThread } from '../integrations/gmail/inbox.js';
import { GmailClient } from '../integrations/gmail/client.js';
import { logger } from '../utils/logger.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const suggestReplySchema = z.object({
  user_id: z.string().optional().describe('User ID for multi-tenant support'),
  thread_id: z.string().optional().describe('Thread ID for reply context'),
  message_id: z.string().optional().describe('Specific message ID to reply to'),
  tone: z
    .enum(['professional', 'friendly', 'brief'])
    .optional()
    .describe('Reply tone (default: professional)'),
  count: z.number().min(1).max(5).optional().describe('Number of suggestions (1-5, default: 3)'),
});

export const suggestReplyTool: Tool = {
  name: 'suggest_reply',
  description: `Generate AI-powered email reply suggestions using Claude.

This tool analyzes an email or thread and generates multiple reply options in different styles.

Parameters:
- thread_id OR message_id: Email/thread to reply to
- tone: Style of reply (professional/friendly/brief, default: professional)
- count: Number of suggestions to generate (1-5, default: 3)

Tone options:
- professional: Formal business tone, complete sentences
- friendly: Warm and conversational while professional
- brief: Short and to-the-point, minimal words

What you get:
- Multiple reply drafts ready to send
- Each suggestion includes short, medium, and detailed variants
- Context-aware responses based on thread history
- Proper email etiquette and formatting

Use cases:
- Quick responses to common emails
- Professional tone checking
- Writer's block assistance
- Multiple options to choose from

Workflow:
1. read_inbox or search_emails to find email
2. suggest_reply to get AI suggestions
3. Pick the reply you like (or edit it)
4. Use reply_to_email to send

Note: Review AI suggestions before sending - always add personal touch!`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (optional)' },
      thread_id: { type: 'string', description: 'Thread ID for context' },
      message_id: { type: 'string', description: 'Specific message to reply to' },
      tone: {
        type: 'string',
        enum: ['professional', 'friendly', 'brief'],
        description: 'Reply tone (default: professional)',
      },
      count: {
        type: 'number',
        minimum: 1,
        maximum: 5,
        description: 'Number of suggestions (default: 3)',
      },
    },
  },
};

export async function handleSuggestReply(args: unknown) {
  try {
    const params = suggestReplySchema.parse(args);

    if (!params.thread_id && !params.message_id) {
      throw new Error('Either thread_id or message_id must be provided');
    }

    const client = new GmailClient(params.user_id);
    await client.initialize();

    let emailContext = '';
    let originalSubject = '';
    let originalFrom = '';

    if (params.thread_id) {
      // Get thread context
      const thread = await getThread(params.user_id, params.thread_id);

      originalSubject = thread.subject;

      emailContext = thread.messages
        .map((msg, idx) => {
          return `
=== MESSAGE ${idx + 1} ===
From: ${msg.from_name || msg.from_email}
Date: ${msg.date.toISOString()}
${msg.body_plain || msg.snippet}
`;
        })
        .join('\n\n');

      originalFrom = thread.messages[thread.messages.length - 1].from_email;
    } else if (params.message_id) {
      // Get single message
      const message = await client.getMessage(params.message_id, 'full');

      const headers = message.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      originalSubject = getHeader('Subject');
      originalFrom = getHeader('From');

      const getBody = (part: any): string => {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.parts) {
          for (const subPart of part.parts) {
            const text = getBody(subPart);
            if (text) return text;
          }
        }
        return '';
      };

      emailContext = getBody(message.payload || {}) || message.snippet || '';
    }

    const toneInstructions = {
      professional:
        'Professional business tone. Complete sentences, formal but warm. Use proper email etiquette.',
      friendly:
        'Friendly and conversational tone while remaining professional. Approachable and warm.',
      brief:
        'Brief and concise. Get to the point quickly. Short sentences. Minimal words.',
    };

    const prompt = `You are helping draft email replies. Generate ${params.count || 3} different reply suggestions.

ORIGINAL EMAIL CONTEXT:
Subject: ${originalSubject}
From: ${originalFrom}

${emailContext}

INSTRUCTIONS:
- Tone: ${toneInstructions[params.tone || 'professional']}
- Generate ${params.count || 3} different reply options
- Each reply should be complete and ready to send
- Vary the approach/angle for each suggestion
- Include appropriate greeting and sign-off
- Make replies contextual and helpful

For each suggestion, provide short, medium, and detailed variants.

Return as JSON array:
[
  {
    "short": "Brief 1-2 sentence reply",
    "medium": "Balanced paragraph reply",
    "detailed": "Comprehensive multi-paragraph reply"
  },
  ...
]

Focus on being helpful and professional. Do not include subject line or recipient (that's handled separately).`;

    const message = await anthropic.messages.create({
      model: process.env.AI_MODEL || 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    let responseText = '';
    for (const block of message.content) {
      if (block.type === 'text') {
        responseText += block.text;
      }
    }

    // Parse JSON response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    let suggestions: any[] = [];

    if (jsonMatch) {
      try {
        suggestions = JSON.parse(jsonMatch[0]);
      } catch {
        // Fallback if parsing fails
        suggestions = [
          {
            short: responseText.substring(0, 200),
            medium: responseText.substring(0, 500),
            detailed: responseText,
          },
        ];
      }
    } else {
      suggestions = [
        {
          short: responseText.substring(0, 200),
          medium: responseText.substring(0, 500),
          detailed: responseText,
        },
      ];
    }

    logger.info('Reply suggestions generated', {
      userId: params.user_id,
      threadId: params.thread_id,
      messageId: params.message_id,
      count: suggestions.length,
      tone: params.tone || 'professional',
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              thread_id: params.thread_id,
              message_id: params.message_id,
              tone: params.tone || 'professional',
              count: suggestions.length,
              suggestions: suggestions.map((s, idx) => ({
                option: idx + 1,
                short: s.short,
                medium: s.medium,
                detailed: s.detailed,
              })),
              next_steps: [
                'Review suggestions and choose one (or combine elements)',
                'Edit as needed to add personal touch',
                'Use reply_to_email tool to send',
              ],
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    logger.error('suggest_reply tool failed', { error: error.message });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: error.message,
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
