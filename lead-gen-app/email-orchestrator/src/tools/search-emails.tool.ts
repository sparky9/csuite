/**
 * MCP Tool: Search Emails
 * Search emails with advanced Gmail filters
 */

import { z } from 'zod';
import { searchEmails } from '../integrations/gmail/inbox.js';
import { logger } from '../utils/logger.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export const searchEmailsSchema = z.object({
  user_id: z.string().optional().describe('User ID for multi-tenant support'),
  query: z.string().describe('Gmail search query'),
  max_results: z.number().min(1).max(500).optional().describe('Maximum results (default: 50)'),
  from: z.string().optional().describe('Filter by sender email'),
  to: z.string().optional().describe('Filter by recipient email'),
  subject: z.string().optional().describe('Filter by subject keywords'),
  has_attachment: z.boolean().optional().describe('Only emails with attachments'),
  after: z.string().optional().describe('Date filter - emails after (YYYY-MM-DD)'),
  before: z.string().optional().describe('Date filter - emails before (YYYY-MM-DD)'),
});

export const searchEmailsTool: Tool = {
  name: 'search_emails',
  description: `Search emails using Gmail's advanced search syntax and filters.

This tool provides powerful email search capabilities using Gmail's search operators.

Search parameters:
- query: Gmail search query (required) - supports all Gmail operators
- from: Filter by sender email address
- to: Filter by recipient email address
- subject: Keywords in subject line
- has_attachment: Only emails with attachments
- after/before: Date range filters (YYYY-MM-DD format)
- max_results: Limit results (1-500, default 50)

Gmail search operators you can use in 'query':
- "exact phrase" - Search for exact phrase
- OR - Either term (e.g., "meeting OR call")
- - (minus) - Exclude term (e.g., "-spam")
- label:labelname - Filter by label
- is:unread - Only unread emails
- has:attachment - Has attachments
- filename:pdf - Specific file type
- larger:10M - Size filters

Examples:
- query: "subject:invoice has:attachment"
- query: "from:client@company.com is:unread"
- query: "meeting OR call after:2024/01/01"

Returns: Array of matching emails with metadata`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (optional)' },
      query: { type: 'string', description: 'Gmail search query (required)' },
      max_results: { type: 'number', description: 'Max results (default 50)', minimum: 1, maximum: 500 },
      from: { type: 'string', description: 'Sender email filter' },
      to: { type: 'string', description: 'Recipient email filter' },
      subject: { type: 'string', description: 'Subject keyword filter' },
      has_attachment: { type: 'boolean', description: 'Only emails with attachments' },
      after: { type: 'string', description: 'Date filter - after (YYYY-MM-DD)' },
      before: { type: 'string', description: 'Date filter - before (YYYY-MM-DD)' },
    },
    required: ['query'],
  },
};

export async function handleSearchEmails(args: unknown) {
  try {
    const params = searchEmailsSchema.parse(args);

    const searchParams: any = {
      query: params.query,
      max_results: params.max_results || 50,
      from: params.from,
      to: params.to,
      subject: params.subject,
      has_attachment: params.has_attachment,
    };

    // Parse date filters
    if (params.after) {
      searchParams.after = new Date(params.after);
    }
    if (params.before) {
      searchParams.before = new Date(params.before);
    }

    const emails = await searchEmails(params.user_id, searchParams);

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
              query: params.query,
              count: emails.length,
              emails: summary,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    logger.error('search_emails tool failed', { error: error.message });

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
