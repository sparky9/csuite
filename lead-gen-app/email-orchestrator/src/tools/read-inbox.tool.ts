/**
 * MCP Tool: Read Inbox
 * Fetch recent emails from Gmail inbox
 */

import { z } from 'zod';
import { fetchInbox } from '../integrations/gmail/inbox.js';
import { logger } from '../utils/logger.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export const readInboxSchema = z.object({
  user_id: z.string().optional().describe('User ID for multi-tenant support'),
  max_results: z.number().min(1).max(500).optional().describe('Maximum number of emails to fetch (default: 50)'),
  query: z.string().optional().describe('Gmail search query filter'),
  unread_only: z.boolean().optional().describe('Only fetch unread emails'),
  label_ids: z.array(z.string()).optional().describe('Filter by label IDs'),
});

export const readInboxTool: Tool = {
  name: 'read_inbox',
  description: `Read recent emails from Gmail inbox with optional filtering.

This tool fetches emails from the authenticated user's Gmail inbox. Results are cached locally for faster subsequent access.

Filtering options:
- max_results: Number of emails to fetch (1-500, default 50)
- query: Gmail search syntax (e.g., "from:example@email.com", "has:attachment", "after:2024/01/01")
- unread_only: Only return unread emails
- label_ids: Filter by specific Gmail labels (e.g., ["IMPORTANT", "INBOX"])

Returns:
- Array of email objects with id, from, to, subject, snippet, date, labels, unread status, etc.
- Each email includes thread_id for retrieving full conversations

Note: Requires Gmail OAuth authentication to be set up first.`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: {
        type: 'string',
        description: 'User ID for multi-tenant support (optional)',
      },
      max_results: {
        type: 'number',
        description: 'Maximum emails to fetch (1-500, default 50)',
        minimum: 1,
        maximum: 500,
      },
      query: {
        type: 'string',
        description: 'Gmail search query (e.g., "from:user@email.com subject:important")',
      },
      unread_only: {
        type: 'boolean',
        description: 'Only fetch unread emails',
      },
      label_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by label IDs',
      },
    },
  },
};

export async function handleReadInbox(args: unknown) {
  try {
    const params = readInboxSchema.parse(args);

    const emails = await fetchInbox(params.user_id, {
      max_results: params.max_results || 50,
      query: params.query,
      unread_only: params.unread_only,
      label_ids: params.label_ids,
    });

    // Format response for readability
    const summary = emails.map((email) => ({
      id: email.id,
      thread_id: email.thread_id,
      from: {
        email: email.from_email,
        name: email.from_name,
      },
      to: email.to_emails,
      subject: email.subject,
      snippet: email.snippet,
      date: email.date.toISOString(),
      is_unread: email.is_unread,
      labels: email.labels,
      has_attachments: email.has_attachments,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              count: emails.length,
              emails: summary,
              tip: 'Use get_email_thread with thread_id to see full conversation',
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    logger.error('read_inbox tool failed', { error: error.message });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: error.message,
              help:
                error.message.includes('not authenticated') || error.message.includes('not initialized')
                  ? 'Gmail authentication required. Please set up OAuth credentials first.'
                  : undefined,
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
