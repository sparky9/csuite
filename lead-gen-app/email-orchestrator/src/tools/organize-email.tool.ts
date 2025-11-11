/**
 * MCP Tool: Organize Email
 * Label, archive, mark read/unread, star, or delete emails
 */

import { z } from 'zod';
import { organizeEmails } from '../integrations/gmail/organize.js';
import { logger } from '../utils/logger.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export const organizeEmailSchema = z.object({
  user_id: z.string().optional().describe('User ID for multi-tenant support'),
  message_ids: z.array(z.string()).describe('Array of Gmail message IDs to organize'),
  action: z
    .enum(['label', 'archive', 'mark_read', 'mark_unread', 'delete', 'trash', 'star', 'unstar'])
    .describe('Action to perform'),
  labels: z.array(z.string()).optional().describe('Label IDs (required for label action)'),
});

export const organizeEmailTool: Tool = {
  name: 'organize_email',
  description: `Organize emails by labeling, archiving, marking read/unread, starring, or deleting.

This tool performs bulk organization actions on Gmail messages.

Parameters:
- message_ids: Array of Gmail message IDs (from read_inbox or search_emails)
- action: What to do with the emails
- labels: Label IDs to apply (only for 'label' action)

Available actions:
1. label - Add Gmail labels to emails (requires 'labels' parameter)
2. archive - Remove from inbox (doesn't delete)
3. mark_read - Mark emails as read
4. mark_unread - Mark emails as unread
5. star - Star emails for importance
6. unstar - Remove star
7. delete/trash - Move to trash (can be recovered)

Common Gmail label IDs:
- INBOX - Inbox
- STARRED - Starred
- IMPORTANT - Important
- SENT - Sent mail
- TRASH - Trash
- SPAM - Spam
- UNREAD - Unread
- Custom labels use their unique ID (use list_labels to find)

Examples:
1. Archive multiple emails:
   { "message_ids": ["msg1", "msg2"], "action": "archive" }

2. Mark as read:
   { "message_ids": ["msg1"], "action": "mark_read" }

3. Add custom label:
   { "message_ids": ["msg1"], "action": "label", "labels": ["Label_123"] }

Returns: Success status and count of modified emails`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (optional)' },
      message_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'Gmail message IDs to organize',
      },
      action: {
        type: 'string',
        enum: ['label', 'archive', 'mark_read', 'mark_unread', 'delete', 'trash', 'star', 'unstar'],
        description: 'Organization action',
      },
      labels: {
        type: 'array',
        items: { type: 'string' },
        description: 'Label IDs (for label action)',
      },
    },
    required: ['message_ids', 'action'],
  },
};

export async function handleOrganizeEmail(args: unknown) {
  try {
    const params = organizeEmailSchema.parse(args);

    if (params.action === 'label' && (!params.labels || params.labels.length === 0)) {
      throw new Error('labels parameter required for label action');
    }

    const result = await organizeEmails(params.user_id, {
      message_ids: params.message_ids,
      action: params.action,
      labels: params.labels,
    });

    logger.info('Emails organized via MCP tool', {
      userId: params.user_id,
      action: params.action,
      count: params.message_ids.length,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              action: params.action,
              modified_count: result.modified_count,
              message_ids: params.message_ids,
              labels: params.labels,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    logger.error('organize_email tool failed', { error: error.message });

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
