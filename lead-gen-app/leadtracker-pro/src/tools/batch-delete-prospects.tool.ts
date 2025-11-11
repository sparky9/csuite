/**
 * Batch Delete Prospects Tool
 * Bulk delete prospects
 */

import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { batchDelete } from '../services/batch-operations.js';

const BatchDeleteProspectsSchema = z.object({
  prospect_ids: z.array(z.string().uuid()).min(1, 'At least one prospect ID required'),
  confirm: z.literal(true, {
    errorMap: () => ({ message: 'Must confirm deletion by setting confirm: true' }),
  }),
});

export async function batchDeleteProspectsTool(
  args: any,
  _dbConnected?: boolean,
  userId?: string
) {
  try {
    const input = BatchDeleteProspectsSchema.parse(args);

    logger.info('Batch delete prospects', {
      count: input.prospect_ids.length,
      userId,
    });

    const result = await batchDelete(input.prospect_ids, userId);

    let responseText = `🗑️ **Batch Delete Prospects**\n\n`;

    if (result.success) {
      responseText += `✅ Deleted: ${result.updated} prospect${result.updated !== 1 ? 's' : ''}\n`;

      if (result.failed > 0) {
        responseText += `⚠️ Failed: ${result.failed} (may not exist or access denied)\n`;
      }

      responseText += `\n⚠️ This operation also deleted:\n`;
      responseText += `- All contacts associated with deleted prospects\n`;
      responseText += `- All activities associated with deleted prospects\n`;
      responseText += `- All follow-ups associated with deleted prospects\n`;
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
    logger.error('Failed to batch delete prospects', { error, args });

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
