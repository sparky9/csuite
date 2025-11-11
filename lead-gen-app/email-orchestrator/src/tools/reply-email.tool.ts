/**
 * MCP Tool: Reply to Email
 * Reply to an email in a thread
 */

import { z } from 'zod';
import { replyToEmail } from '../integrations/gmail/send.js';
import { logger } from '../utils/logger.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export const replyEmailSchema = z.object({
  user_id: z.string().optional().describe('User ID for multi-tenant support'),
  thread_id: z.string().optional().describe('Thread ID to reply to'),
  message_id: z.string().optional().describe('Specific message ID to reply to'),
  body_html: z.string().describe('Reply body in HTML format'),
  body_plain: z.string().optional().describe('Reply body in plain text'),
  cc: z.union([z.string(), z.array(z.string())]).optional().describe('Additional CC recipients'),
  bcc: z.union([z.string(), z.array(z.string())]).optional().describe('BCC recipients'),
});

export const replyEmailTool: Tool = {
  name: 'reply_to_email',
  description: `Reply to an email within an existing thread.

This tool sends a reply that maintains thread continuity in Gmail conversations.

Required parameters:
- thread_id OR message_id: Identify which email/thread to reply to
- body_html: Your reply message in HTML format

Optional parameters:
- body_plain: Plain text version of reply
- cc: Additional people to CC on reply
- bcc: BCC recipients

How it works:
- Automatically includes proper email headers (In-Reply-To, References)
- Reply-to address is extracted from original email
- Subject line automatically prefixed with "Re:" if needed
- Reply appears in the same Gmail thread/conversation

Workflow example:
1. Use read_inbox to find email
2. Use get_email_thread to see full conversation
3. Use suggest_reply to generate AI reply suggestions
4. Use reply_to_email to send your reply

Note: Provide either thread_id OR message_id (not both)`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (optional)' },
      thread_id: { type: 'string', description: 'Thread ID (from inbox/search)' },
      message_id: { type: 'string', description: 'Specific message ID to reply to' },
      body_html: { type: 'string', description: 'HTML reply body' },
      body_plain: { type: 'string', description: 'Plain text reply (optional)' },
      cc: {
        oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
        description: 'CC recipients (optional)',
      },
      bcc: {
        oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
        description: 'BCC recipients (optional)',
      },
    },
    required: ['body_html'],
  },
};

export async function handleReplyEmail(args: unknown) {
  try {
    const params = replyEmailSchema.parse(args);

    if (!params.thread_id && !params.message_id) {
      throw new Error('Either thread_id or message_id must be provided');
    }

    const result = await replyToEmail(params.user_id, {
      thread_id: params.thread_id,
      message_id: params.message_id,
      body_html: params.body_html,
      body_plain: params.body_plain,
      cc: params.cc,
      bcc: params.bcc,
    });

    logger.info('Reply sent via MCP tool', {
      userId: params.user_id,
      threadId: params.thread_id,
      messageId: params.message_id,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: 'Reply sent successfully',
              message_id: result.message_id,
              thread_id: result.thread_id,
              original_thread: params.thread_id,
              original_message: params.message_id,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    logger.error('reply_to_email tool failed', { error: error.message });

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
