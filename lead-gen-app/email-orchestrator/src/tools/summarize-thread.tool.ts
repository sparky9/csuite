/**
 * MCP Tool: Summarize Email Thread
 * AI-powered email thread summarization using Claude
 */

import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { getThread } from '../integrations/gmail/inbox.js';
import { logger } from '../utils/logger.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const summarizeThreadSchema = z.object({
  user_id: z.string().optional().describe('User ID for multi-tenant support'),
  thread_id: z.string().describe('Gmail thread ID to summarize'),
  length: z.enum(['short', 'medium', 'detailed']).optional().describe('Summary length (default: medium)'),
});

export const summarizeThreadTool: Tool = {
  name: 'summarize_thread',
  description: `Generate AI-powered summary of an email thread/conversation using Claude.

This tool analyzes an entire email thread and produces a concise summary with key information.

Parameters:
- thread_id: Gmail thread ID (from read_inbox or get_email_thread)
- length: Summary detail level (short/medium/detailed, default: medium)

Summary includes:
- High-level overview of conversation
- Key points and topics discussed
- Action items or requests
- Current status/latest developments
- Sentiment analysis (positive/neutral/negative)
- List of participants

Use cases:
- Quickly understand long email chains
- Brief someone on a conversation
- Identify action items before replying
- Catch up on threads while away

Length options:
- short: 2-3 sentences, just the essentials
- medium: Paragraph with key points and action items
- detailed: Comprehensive summary with full context

Example workflow:
1. read_inbox to find interesting thread
2. summarize_thread for quick understanding
3. get_email_thread if you need full details
4. reply_to_email to respond`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (optional)' },
      thread_id: { type: 'string', description: 'Thread ID to summarize' },
      length: {
        type: 'string',
        enum: ['short', 'medium', 'detailed'],
        description: 'Summary length (default: medium)',
      },
    },
    required: ['thread_id'],
  },
};

export async function handleSummarizeThread(args: unknown) {
  try {
    const params = summarizeThreadSchema.parse(args);

    // Fetch the thread
    const thread = await getThread(params.user_id, params.thread_id);

    if (thread.messages.length === 0) {
      throw new Error('Thread has no messages');
    }

    // Build context for Claude
    const threadContext = thread.messages
      .map((msg, idx) => {
        return `
=== MESSAGE ${idx + 1} ===
From: ${msg.from_name || msg.from_email}
To: ${msg.to_emails.join(', ')}
Date: ${msg.date.toISOString()}
Subject: ${msg.subject}

${msg.body_plain || msg.body_html || msg.snippet}
`;
      })
      .join('\n\n');

    const lengthInstructions = {
      short: 'Provide a very brief 2-3 sentence summary of the essentials.',
      medium:
        'Provide a concise paragraph summary covering key points, action items, and current status.',
      detailed:
        'Provide a comprehensive summary with full context, all key points, action items, decisions made, and next steps.',
    };

    const prompt = `You are analyzing an email thread to create a helpful summary.

THREAD INFORMATION:
Subject: ${thread.subject}
Participants: ${thread.participants.join(', ')}
Messages: ${thread.message_count}

FULL THREAD:
${threadContext}

TASK:
${lengthInstructions[params.length || 'medium']}

Provide the summary in this JSON format:
{
  "summary": "Brief overview paragraph",
  "key_points": ["Point 1", "Point 2", "Point 3"],
  "action_items": ["Action 1", "Action 2"],
  "sentiment": "positive|neutral|negative",
  "latest_update": "What's the current status or latest development"
}

Focus on actionable information and important context. Be concise but thorough.`;

    const message = await anthropic.messages.create({
      model: process.env.AI_MODEL || 'claude-sonnet-4-5-20250929',
      max_tokens: params.length === 'short' ? 500 : params.length === 'detailed' ? 2000 : 1000,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    let summaryText = '';
    for (const block of message.content) {
      if (block.type === 'text') {
        summaryText += block.text;
      }
    }

    // Parse JSON response
    const jsonMatch = summaryText.match(/\{[\s\S]*\}/);
    let summaryData: any;

    if (jsonMatch) {
      try {
        summaryData = JSON.parse(jsonMatch[0]);
      } catch {
        // If JSON parsing fails, create structured response from text
        summaryData = {
          summary: summaryText,
          key_points: [],
          action_items: [],
          sentiment: 'neutral',
        };
      }
    } else {
      summaryData = {
        summary: summaryText,
        key_points: [],
        action_items: [],
        sentiment: 'neutral',
      };
    }

    logger.info('Thread summarized via AI', {
      userId: params.user_id,
      threadId: params.thread_id,
      messageCount: thread.message_count,
      length: params.length || 'medium',
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              thread_id: params.thread_id,
              subject: thread.subject,
              message_count: thread.message_count,
              participants: thread.participants,
              summary: summaryData.summary,
              key_points: summaryData.key_points || [],
              action_items: summaryData.action_items || [],
              sentiment: summaryData.sentiment || 'neutral',
              latest_update: summaryData.latest_update,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    logger.error('summarize_thread tool failed', { error: error.message });

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
