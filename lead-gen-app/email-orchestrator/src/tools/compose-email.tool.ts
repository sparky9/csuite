/**
 * MCP Tool: Compose Email
 * Compose and send a new email
 */

import { z } from 'zod';
import { composeAndSend } from '../integrations/gmail/send.js';
import { logger } from '../utils/logger.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export const composeEmailSchema = z.object({
  user_id: z.string().optional().describe('User ID for multi-tenant support'),
  to: z.union([z.string(), z.array(z.string())]).describe('Recipient email(s)'),
  subject: z.string().describe('Email subject line'),
  body_html: z.string().describe('Email body in HTML format'),
  body_plain: z.string().optional().describe('Email body in plain text (auto-generated if not provided)'),
  cc: z.union([z.string(), z.array(z.string())]).optional().describe('CC recipients'),
  bcc: z.union([z.string(), z.array(z.string())]).optional().describe('BCC recipients'),
  from: z.string().optional().describe('Sender email (defaults to authenticated account)'),
});

export const composeEmailTool: Tool = {
  name: 'compose_email',
  description: `Compose and send a new email through Gmail.

This tool creates and sends a new email message (not a reply to existing thread).

Required parameters:
- to: Recipient email address or array of addresses
- subject: Email subject line
- body_html: Email body in HTML format

Optional parameters:
- body_plain: Plain text version (auto-generated from HTML if not provided)
- cc: Carbon copy recipients
- bcc: Blind carbon copy recipients
- from: Sender email (defaults to authenticated Gmail account)

HTML formatting:
- Use proper HTML tags (<p>, <br>, <strong>, etc.)
- Include inline styles for formatting
- Keep it simple for best deliverability

Example:
{
  "to": "client@example.com",
  "subject": "Project Update",
  "body_html": "<p>Hi there,</p><p>Here's the latest update on your project...</p>",
  "cc": ["manager@company.com"]
}

Returns:
- message_id: Gmail message ID
- thread_id: Thread ID for the new conversation`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (optional)' },
      to: {
        oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
        description: 'Recipient email(s)',
      },
      subject: { type: 'string', description: 'Subject line' },
      body_html: { type: 'string', description: 'HTML email body' },
      body_plain: { type: 'string', description: 'Plain text body (optional)' },
      cc: {
        oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
        description: 'CC recipients (optional)',
      },
      bcc: {
        oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
        description: 'BCC recipients (optional)',
      },
      from: { type: 'string', description: 'Sender email (optional)' },
    },
    required: ['to', 'subject', 'body_html'],
  },
};

export async function handleComposeEmail(args: unknown) {
  try {
    const params = composeEmailSchema.parse(args);

    const result = await composeAndSend(params.user_id, {
      to: params.to,
      subject: params.subject,
      body_html: params.body_html,
      body_plain: params.body_plain,
      cc: params.cc,
      bcc: params.bcc,
      from: params.from,
    });

    logger.info('Email composed and sent via MCP tool', {
      userId: params.user_id,
      to: params.to,
      subject: params.subject,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message: 'Email sent successfully',
              message_id: result.message_id,
              thread_id: result.thread_id,
              sent_to: Array.isArray(params.to) ? params.to : [params.to],
              subject: params.subject,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    logger.error('compose_email tool failed', { error: error.message });

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
