/**
 * MCP Tool: Generate Meeting Summary
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { buildMeetingSummary } from '../meeting/templates.js';
import type { MeetingSummaryRecord, MeetingIntent, Participant } from '../types/calendar.types.js';
import { calendarDb } from '../db/client.js';
import { logger } from '../utils/logger.js';

interface GenerateSummaryInput {
  event_id: string;
  intent: MeetingIntent;
  participants: Participant[];
  highlights_seed: string;
}

export const generateSummaryTool: Tool = {
  name: 'generate_meeting_summary',
  description: 'Create a deterministic recap for a completed meeting.',
  inputSchema: {
    type: 'object',
    properties: {
      event_id: { type: 'string' },
      intent: { type: 'string' },
      participants: { type: 'array' },
      highlights_seed: { type: 'string' },
    },
    required: ['event_id', 'intent', 'participants', 'highlights_seed'],
  },
};

export async function handleGenerateSummary(args: unknown): Promise<any> {
  const params = args as GenerateSummaryInput;
  const summary: MeetingSummaryRecord = buildMeetingSummary(
    params.event_id,
    params.intent,
    params.participants,
    params.highlights_seed,
  );

  if (calendarDb.connected) {
    try {
      await calendarDb.query(
        `INSERT INTO cm_meeting_notes (event_id, notes, action_items, summary)
         VALUES ($1, $2::jsonb, $3::jsonb, $4)
         ON CONFLICT (event_id)
         DO UPDATE SET notes = EXCLUDED.notes, action_items = EXCLUDED.action_items, summary = EXCLUDED.summary`,
        [
          params.event_id,
          JSON.stringify(summary.highlights.map(item => ({ highlight: item }))),
          JSON.stringify(summary.action_items),
          summary.summary,
        ],
      );
    } catch (error) {
      logger.warn('Failed to persist meeting summary; returning generated result only.', {
        event_id: params.event_id,
        error: (error as Error).message,
      });
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ success: true, summary }, null, 2),
      },
    ],
  };
}
