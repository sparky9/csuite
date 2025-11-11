/**
 * Update Follow-up Tool
 * Reschedule or adjust an existing follow-up reminder.
 */

import { z } from 'zod';
import { db } from '../db/client.js';
import { logger } from '../utils/logger.js';

const UpdateFollowUpSchema = z
  .object({
    follow_up_id: z.string().uuid().optional(),
    prospect_id: z.string().uuid().optional(),
    due_date: z.string().datetime().optional(),
    reminder_type: z.enum(['call', 'email', 'meeting', 'note']).optional(),
    reminder_note: z.string().max(500).optional(),
    completed: z.boolean().optional(),
  })
  .refine((data) => data.follow_up_id || data.prospect_id, {
    message: 'Provide follow_up_id or prospect_id to identify the reminder',
    path: ['follow_up_id'],
  })
  .refine((data) => data.due_date || data.completed !== undefined, {
    message: 'Provide a new due_date or completed flag to update',
    path: ['due_date'],
  });

export async function updateFollowUpTool(args: any, _dbConnected?: boolean, userId?: string) {
  try {
    const input = UpdateFollowUpSchema.parse(args);

    logger.info('Updating follow-up', {
      follow_up_id: input.follow_up_id,
      prospect_id: input.prospect_id,
      userId,
    });

    const target = await findFollowUp(input, userId);
    if (!target) {
      throw new Error('No matching follow-up found to update');
    }

    const updates: string[] = [];
    const params: any[] = [];
    let index = 1;

    if (input.due_date) {
      updates.push(`due_date = $${index++}`);
      params.push(new Date(input.due_date));
    }

    if (input.reminder_type) {
      updates.push(`reminder_type = $${index++}`);
      params.push(input.reminder_type);
    }

    if (input.reminder_note !== undefined) {
      updates.push(`reminder_note = $${index++}`);
      params.push(input.reminder_note);
    }

    if (input.completed !== undefined) {
      updates.push(`completed = $${index++}`);
      params.push(input.completed);

      updates.push(input.completed ? 'completed_at = NOW()' : 'completed_at = NULL');
    }

    if (updates.length === 0) {
      throw new Error('Nothing to update for follow-up');
    }

    const updateQuery = `UPDATE follow_ups
      SET ${updates.join(', ')}
      WHERE id = $${index}${userId ? ` AND user_id = $${index + 1}` : ''}`;

    params.push(target.id);
    if (userId) {
      params.push(userId);
    }

    await db.query(updateQuery, params);

    if (input.due_date) {
      const updateProspectQuery = `UPDATE prospects
         SET next_follow_up = CASE
           WHEN next_follow_up IS NULL OR next_follow_up > $1 THEN $1
           ELSE next_follow_up
         END
         WHERE id = $2${userId ? ' AND user_id = $3' : ''}`;

      const updateProspectParams = userId
        ? [new Date(input.due_date), target.prospect_id, userId]
        : [new Date(input.due_date), target.prospect_id];

      await db.query(updateProspectQuery, updateProspectParams);
    }

    const dueDateText = input.due_date ? new Date(input.due_date).toLocaleString() : undefined;

    const bodyLines = [
      '✅ Follow-up updated successfully',
      '',
      `Prospect: ${target.company_name}`,
      `Follow-up ID: ${target.id}`,
    ];

    if (dueDateText) {
      bodyLines.push(`New due date: ${dueDateText}`);
    }

    if (input.completed !== undefined) {
      bodyLines.push(`Completed: ${input.completed ? 'Yes' : 'No'}`);
    }

    if (input.reminder_type) {
      bodyLines.push(`Reminder type: ${input.reminder_type}`);
    }

    if (input.reminder_note !== undefined) {
      bodyLines.push(`Reminder note: ${input.reminder_note || 'None'}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: bodyLines.join('\n'),
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to update follow-up', { error, args });

    if (error instanceof z.ZodError) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Validation error: ${error.errors
              .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
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
          text: `❌ Error updating follow-up: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

async function findFollowUp(
  input: z.infer<typeof UpdateFollowUpSchema>,
  userId?: string
): Promise<any | null> {
  if (input.follow_up_id) {
    const query = `SELECT f.*, p.company_name
      FROM follow_ups f
      JOIN prospects p ON p.id = f.prospect_id
      WHERE f.id = $1 AND f.completed = false${userId ? ' AND f.user_id = $2' : ''}
      LIMIT 1`;

    const params = userId ? [input.follow_up_id, userId] : [input.follow_up_id];
    const result = await db.query(query, params);
    return result.rows[0] ?? null;
  }

  if (input.prospect_id) {
    const query = `SELECT f.*, p.company_name
      FROM follow_ups f
      JOIN prospects p ON p.id = f.prospect_id
      WHERE f.prospect_id = $1 AND f.completed = false${userId ? ' AND f.user_id = $2' : ''}
      ORDER BY f.due_date ASC
      LIMIT 1`;

    const params = userId ? [input.prospect_id, userId] : [input.prospect_id];
    const result = await db.query(query, params);
    return result.rows[0] ?? null;
  }

  return null;
}
