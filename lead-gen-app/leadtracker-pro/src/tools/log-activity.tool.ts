/**
 * Log Activity Tool
 * Record calls, emails, meetings, and notes
 */

import { z } from 'zod';
import { db } from '../db/client.js';
import { logger } from '../utils/logger.js';
import { getDefaultRetention } from '../utils/retention.js';
import type { LogActivityInput, Activity } from '../types/leadtracker.types.js';

// Zod schema for input validation
const LogActivitySchema = z.object({
  prospect_id: z.string().uuid('Invalid prospect ID'),
  contact_id: z.string().uuid().optional(),
  activity_type: z.enum(['call', 'email', 'meeting', 'note']),
  call_outcome: z.enum(['answered', 'voicemail', 'no_answer', 'wrong_number']).optional(),
  call_duration_seconds: z.number().int().positive().optional(),
  subject: z.string().optional(),
  notes: z.string().min(1, 'Notes are required'),
  follow_up_date: z.string().datetime().optional(),
  retention_months: z.union([z.literal(3), z.literal(6), z.literal(12), z.literal(24), z.literal(60)]).optional(),
});

export async function logActivityTool(args: any, _dbConnected?: boolean, userId?: string) {
  try {
    // Validate input
    const input = LogActivitySchema.parse(args) as LogActivityInput;

    logger.info('Logging activity', {
      prospect_id: input.prospect_id,
      activity_type: input.activity_type,
    });

    // Verify prospect exists
    const prospectQuery = userId
      ? 'SELECT id, company_name FROM prospects WHERE id = $1 AND user_id = $2'
      : 'SELECT id, company_name FROM prospects WHERE id = $1';
    const prospectParams = userId ? [input.prospect_id, userId] : [input.prospect_id];
    const prospect = await db.queryOne(prospectQuery, prospectParams);

    if (!prospect) {
      throw new Error(`Prospect not found: ${input.prospect_id}`);
    }

    // Verify contact exists if provided
    if (input.contact_id) {
      const contactQuery = userId
        ? 'SELECT id, full_name FROM contacts WHERE id = $1 AND prospect_id = $2 AND user_id = $3'
        : 'SELECT id, full_name FROM contacts WHERE id = $1 AND prospect_id = $2';
      const contactParams = userId ? [input.contact_id, input.prospect_id, userId] : [input.contact_id, input.prospect_id];
      const contact = await db.queryOne(contactQuery, contactParams);

      if (!contact) {
        throw new Error(`Contact not found or doesn't belong to this prospect: ${input.contact_id}`);
      }
    }

    // Get retention period (use input or default)
    const retentionMonths = input.retention_months || (await getDefaultRetention());

    // Insert activity
    const activityQuery = userId
      ? `INSERT INTO activities (
          prospect_id, contact_id, activity_type, call_outcome,
          call_duration_seconds, subject, notes, retention_months,
          requires_follow_up, follow_up_date, user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`
      : `INSERT INTO activities (
          prospect_id, contact_id, activity_type, call_outcome,
          call_duration_seconds, subject, notes, retention_months,
          requires_follow_up, follow_up_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`;
    const activityParams = userId
      ? [
          input.prospect_id,
          input.contact_id || null,
          input.activity_type,
          input.call_outcome || null,
          input.call_duration_seconds || null,
          input.subject || null,
          input.notes,
          retentionMonths,
          !!input.follow_up_date,
          input.follow_up_date ? new Date(input.follow_up_date) : null,
          userId,
        ]
      : [
          input.prospect_id,
          input.contact_id || null,
          input.activity_type,
          input.call_outcome || null,
          input.call_duration_seconds || null,
          input.subject || null,
          input.notes,
          retentionMonths,
          !!input.follow_up_date,
          input.follow_up_date ? new Date(input.follow_up_date) : null,
        ];
    const activity = await db.queryOne<Activity>(activityQuery, activityParams);

    if (!activity) {
      throw new Error('Failed to log activity');
    }

    // Create follow-up reminder if requested
    let followUpCreated = false;
    if (input.follow_up_date) {
      const followUpQuery = userId
        ? `INSERT INTO follow_ups (
            prospect_id, contact_id, due_date, reminder_type, reminder_note, user_id
          ) VALUES ($1, $2, $3, $4, $5, $6)`
        : `INSERT INTO follow_ups (
            prospect_id, contact_id, due_date, reminder_type, reminder_note
          ) VALUES ($1, $2, $3, $4, $5)`;
      const followUpParams = userId
        ? [
            input.prospect_id,
            input.contact_id || null,
            new Date(input.follow_up_date),
            input.activity_type,
            `Follow-up after ${input.activity_type}`,
            userId,
          ]
        : [
            input.prospect_id,
            input.contact_id || null,
            new Date(input.follow_up_date),
            input.activity_type,
            `Follow-up after ${input.activity_type}`,
          ];
      await db.query(followUpQuery, followUpParams);
      followUpCreated = true;

      // Update prospect's next_follow_up field
      await db.query(
        `UPDATE prospects
         SET next_follow_up = $1
         WHERE id = $2
           AND (next_follow_up IS NULL OR next_follow_up > $1)`,
        [new Date(input.follow_up_date), input.prospect_id]
      );
    }

    logger.info('Activity logged successfully', {
      activity_id: activity.id,
      prospect_id: activity.prospect_id,
      activity_type: activity.activity_type,
    });

    // Format response
    const activityEmoji: Record<string, string> = {
      call: '📞',
      email: '📧',
      meeting: '🤝',
      note: '📝',
    };

    const callOutcomeText = input.call_outcome
      ? `\nOutcome: ${input.call_outcome.replace('_', ' ')}`
      : '';
    const durationText =
      input.call_duration_seconds && input.call_duration_seconds > 0
        ? `\nDuration: ${Math.floor(input.call_duration_seconds / 60)}m ${input.call_duration_seconds % 60}s`
        : '';

    return {
      content: [
        {
          type: 'text',
          text: `✅ Activity logged successfully!

${activityEmoji[input.activity_type]} **${input.activity_type.toUpperCase()}**
Prospect: ${prospect.company_name}${input.subject ? `\nSubject: ${input.subject}` : ''}${callOutcomeText}${durationText}

Notes: ${input.notes}

${followUpCreated ? `\n⏰ Follow-up reminder set for: ${new Date(input.follow_up_date!).toLocaleString()}` : ''}

Activity ID: ${activity.id}
Logged at: ${new Date(activity.activity_date).toLocaleString()}
Retention: ${retentionMonths} months`,
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to log activity', { error, args });

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
          text: `❌ Error logging activity: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
