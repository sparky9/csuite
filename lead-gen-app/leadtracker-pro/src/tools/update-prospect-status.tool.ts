/**
 * Update Prospect Status Tool
 * Update the pipeline status of a prospect
 */

import { z } from 'zod';
import { db } from '../db/client.js';
import { logger } from '../utils/logger.js';
import type { UpdateProspectStatusInput, Prospect } from '../types/leadtracker.types.js';

// Zod schema for input validation
const UpdateProspectStatusSchema = z.object({
  prospect_id: z.string().uuid('Invalid prospect ID'),
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
  notes: z.string().optional(),
});

export async function updateProspectStatusTool(args: any, _dbConnected?: boolean, userId?: string) {
  try {
    // Validate input
    const input = UpdateProspectStatusSchema.parse(args) as UpdateProspectStatusInput;

    logger.info('Updating prospect status', {
      prospect_id: input.prospect_id,
      new_status: input.new_status,
      userId,
    });

    // Get current prospect (filter by userId if provided)
    const selectQuery = userId
      ? 'SELECT * FROM prospects WHERE id = $1 AND user_id = $2'
      : 'SELECT * FROM prospects WHERE id = $1';
    const selectParams = userId ? [input.prospect_id, userId] : [input.prospect_id];

    const currentProspect = await db.queryOne<Prospect>(selectQuery, selectParams);

    if (!currentProspect) {
      throw new Error(`Prospect not found: ${input.prospect_id}`);
    }

    const oldStatus = currentProspect.status;

    // Update status
    const updatedProspect = await db.queryOne<Prospect>(
      'UPDATE prospects SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [input.new_status, input.prospect_id]
    );

    if (!updatedProspect) {
      throw new Error('Failed to update prospect status');
    }

    // Create activity log for status change
    const activityNote = input.notes
      ? `Status changed: ${oldStatus} → ${input.new_status}\n\n${input.notes}`
      : `Status changed: ${oldStatus} → ${input.new_status}`;

    await db.query(
      `INSERT INTO activities (
        prospect_id, activity_type, subject, notes
      ) VALUES ($1, $2, $3, $4)`,
      [input.prospect_id, 'note', 'Status Change', activityNote]
    );

    logger.info('Prospect status updated successfully', {
      prospect_id: input.prospect_id,
      old_status: oldStatus,
      new_status: input.new_status,
    });

    // Format status display
    const statusEmoji: Record<string, string> = {
      new: '🆕',
      contacted: '📞',
      qualified: '✅',
      meeting_scheduled: '📅',
      proposal_sent: '📄',
      negotiating: '🤝',
      closed_won: '🎉',
      closed_lost: '❌',
      on_hold: '⏸️',
    };

    return {
      content: [
        {
          type: 'text',
          text: `✅ Prospect status updated!

**${updatedProspect.company_name}**

${statusEmoji[oldStatus] || ''} **${oldStatus}** → ${statusEmoji[input.new_status] || ''} **${input.new_status}**

${input.notes ? `Notes: ${input.notes}\n` : ''}
Activity logged automatically.
Updated at: ${new Date(updatedProspect.updated_at).toLocaleString()}`,
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to update prospect status', { error, args });

    if (error instanceof z.ZodError) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Validation error: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `❌ Error updating status: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
