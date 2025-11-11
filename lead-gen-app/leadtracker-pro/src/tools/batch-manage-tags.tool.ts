/**
 * Batch Manage Tags Tool
 * Bulk add or remove tags from prospects
 */

import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { batchAddTags, batchRemoveTags } from '../services/batch-operations.js';

const BatchManageTagsSchema = z.object({
  prospect_ids: z.array(z.string().uuid()).min(1, 'At least one prospect ID required'),
  tags: z.array(z.string()).min(1, 'At least one tag required'),
  operation: z.enum(['add', 'remove']),
});

export async function batchManageTagsTool(
  args: any,
  _dbConnected?: boolean,
  userId?: string
) {
  try {
    const input = BatchManageTagsSchema.parse(args);

    logger.info('Batch manage tags', {
      count: input.prospect_ids.length,
      tags: input.tags,
      operation: input.operation,
      userId,
    });

    const result =
      input.operation === 'add'
        ? await batchAddTags(input.prospect_ids, input.tags, userId)
        : await batchRemoveTags(input.prospect_ids, input.tags, userId);

    let responseText = `🏷️ **Batch Tag ${input.operation === 'add' ? 'Add' : 'Remove'}**\n\n`;

    if (result.success) {
      responseText += `✅ Updated: ${result.updated} prospect${result.updated !== 1 ? 's' : ''}\n`;
      responseText += `Tags ${input.operation === 'add' ? 'added' : 'removed'}: ${input.tags.join(', ')}\n`;

      if (result.failed > 0) {
        responseText += `⚠️ Failed: ${result.failed} (may not exist or access denied)\n`;
      }
    } else {
      responseText += `❌ Operation failed\n`;
      if (result.errors && result.errors.length > 0) {
        responseText += `Errors: ${result.errors.join(', ')}\n`;
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
      isError: !result.success,
    };
  } catch (error) {
    logger.error('Failed to batch manage tags', { error, args });

    if (error instanceof z.ZodError) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Validation error: ${error.errors
              .map((e) => `${e.path.join('.')}: ${e.message}`)
              .join(', ')}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
