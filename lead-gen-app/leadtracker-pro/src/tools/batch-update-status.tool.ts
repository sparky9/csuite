/**
 * Batch Update Status Tool
 * Bulk update prospect statuses
 */

import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { batchUpdateStatus } from '../services/batch-operations.js';
import type { ProspectStatus } from '../types/leadtracker.types.js';

const BatchUpdateStatusSchema = z.object({
  prospect_ids: z.array(z.string().uuid()).min(1, 'At least one prospect ID required'),
  new_status: z.enum([
    'new',
    'contacted',
    'qualified',
    'meeting_scheduled',
    'proposal_sent',
    'negotiating',
    'closed_won',
    'closed_lost',
    'on_hold',
  ]),
});

export async function batchUpdateStatusTool(
  args: any,
  _dbConnected?: boolean,
  userId?: string
) {
  try {
    const input = BatchUpdateStatusSchema.parse(args);

    logger.info('Batch update status', {
      count: input.prospect_ids.length,
      newStatus: input.new_status,
      userId,
    });

    const result = await batchUpdateStatus(
      input.prospect_ids,
      input.new_status as ProspectStatus,
      userId
    );

    let responseText = `🔄 **Batch Status Update**\n\n`;

    if (result.success) {
      responseText += `✅ Updated: ${result.updated} prospect${result.updated !== 1 ? 's' : ''}\n`;
      responseText += `New status: ${input.new_status}\n`;

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
    logger.error('Failed to batch update status', { error, args });

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
