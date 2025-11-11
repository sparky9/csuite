/**
 * MCP Tool: Get Email Thread
 * Retrieve full email thread/conversation
 */

import { z } from 'zod';
import { getThread } from '../integrations/gmail/inbox.js';
import { logger } from '../utils/logger.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export const getThreadSchema = z.object({
  user_id: z.string().optional().describe('User ID for multi-tenant support'),
  thread_id: z.string().describe('Gmail thread ID'),
});

export const getThreadTool: Tool = {
  name: 'get_email_thread',
  description: `Retrieve a full email thread/conversation with all messages.

This tool fetches an entire email conversation thread, including all messages in chronological order.

Use this when:
- You need to see the full context of a conversation
- Analyzing email chains before replying
- Getting thread history for AI summarization

Returns:
- Thread metadata (participants, message count, labels)
- All messages in the thread in chronological order
- Each message includes full body (HTML and plain text), headers, attachments

Example workflow:
1. Use read_inbox to get thread_id from inbox
2. Use get_email_thread to see full conversation
3. Use summarize_thread for AI summary
4. Use reply_to_email to respond`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: {
        type: 'string',
        description: 'User ID (optional)',
      },
      thread_id: {
        type: 'string',
        description: 'Gmail thread ID (from read_inbox or search_emails)',
      },
    },
    required: ['thread_id'],
  },
};

export async function handleGetThread(args: unknown) {
  try {
    const params = getThreadSchema.parse(args);

    const thread = await getThread(params.user_id, params.thread_id);

    // Format messages for readability
    const formattedMessages = thread.messages.map((msg) => ({
      id: msg.id,
      from: {
        email: msg.from_email,
        name: msg.from_name,
      },
      to: msg.to_emails,
      cc: msg.cc_emails,
      subject: msg.subject,
      date: msg.date.toISOString(),
      is_unread: msg.is_unread,
      body_plain: msg.body_plain,
      body_html: msg.body_html,
      has_attachments: msg.has_attachments,
      attachments: msg.attachments
        ? msg.attachments.map((att) => ({
            filename: att.filename,
            mime_type: att.mime_type,
            size: att.size,
          }))
        : [],
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              thread: {
                thread_id: thread.thread_id,
                subject: thread.subject,
                participants: thread.participants,
                message_count: thread.message_count,
                unread_count: thread.unread_count,
                labels: thread.labels,
                last_message_date: thread.last_message_date.toISOString(),
                messages: formattedMessages,
              },
              tips: [
                'Use summarize_thread to get AI summary of this conversation',
                'Use reply_to_email with this thread_id to respond',
              ],
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    logger.error('get_email_thread tool failed', { error: error.message });

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
