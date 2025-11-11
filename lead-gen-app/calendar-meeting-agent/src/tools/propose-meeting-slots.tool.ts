/**
 * MCP Tool: Propose Meeting Slots
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { v4 as uuid } from 'uuid';
import { findProposedSlots, buildSlotHash } from '../scheduler/engine.js';
import { loadEvents } from '../utils/calendar.js';
import { logger } from '../utils/logger.js';
import { calendarDb } from '../db/client.js';
import type { SchedulingRequestInput, SchedulingRequestRecord } from '../types/calendar.types.js';

export const proposeMeetingSlotsTool: Tool = {
  name: 'propose_meeting_slots',
  description: 'Generate deterministic meeting slot proposals given participants and constraints.',
  inputSchema: {
    type: 'object',
    properties: {
      organizer_email: { type: 'string' },
      meeting_intent: { type: 'string' },
      participants: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            email: { type: 'string' },
            display_name: { type: 'string' },
            optional: { type: 'boolean' },
            timezone: { type: 'string' },
            priority: { type: 'string' },
          },
          required: ['email'],
        },
      },
      constraints: {
        type: 'object',
        properties: {
          meeting_duration_minutes: { type: 'number' },
          buffer_minutes: { type: 'number' },
          allow_back_to_back: { type: 'boolean' },
          max_meetings_per_day: { type: 'number' },
          working_hours: {
            type: 'object',
            properties: {
              start: { type: 'string' },
              end: { type: 'string' },
              timezone: { type: 'string' },
              days: { type: 'array', items: { type: 'number' } },
            },
            required: ['start', 'end', 'timezone', 'days'],
          },
        },
        required: ['meeting_duration_minutes', 'buffer_minutes'],
      },
      window_start: { type: 'string' },
      window_end: { type: 'string' },
      notes: { type: 'string' },
    },
    required: ['organizer_email', 'meeting_intent', 'participants', 'constraints', 'window_start', 'window_end'],
  },
};

export async function handleProposeMeetingSlots(args: unknown): Promise<any> {
  const params = args as SchedulingRequestInput;
  const startTime = Date.now();

  logger.info('Generating meeting slot proposals', {
    organizer: params.organizer_email,
    participantCount: params.participants.length,
    windowStart: params.window_start,
    windowEnd: params.window_end,
  });

  const events = await loadEvents({
    participantEmails: params.participants.map(p => p.email),
    windowStart: params.window_start,
    windowEnd: params.window_end,
  });

  const proposals = findProposedSlots(params, events);

  const record: SchedulingRequestRecord = {
    id: uuid(),
    created_at: new Date().toISOString(),
    proposed_slots: proposals,
    metadata: {
      duration_minutes: params.constraints.meeting_duration_minutes,
      buffer_minutes: params.constraints.buffer_minutes,
    },
    ...params,
  };

  if (calendarDb.connected) {
    await calendarDb.query(
      `INSERT INTO cm_scheduling_requests (id, user_id, meeting_type, duration_minutes, requested_start, requested_end, participants, constraints, proposed_slots, status)
       VALUES ($1, NULL, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9)`,
      [
        record.id,
        params.meeting_intent,
        params.constraints.meeting_duration_minutes,
        params.window_start,
        params.window_end,
        JSON.stringify(params.participants),
        JSON.stringify(params.constraints),
        JSON.stringify(proposals),
        proposals.length ? 'proposed' : 'no_slots',
      ],
    );
  }

  const duration = Date.now() - startTime;

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            success: true,
            request: {
              id: record.id,
              organizer: params.organizer_email,
              meeting_intent: params.meeting_intent,
              proposed_slots: proposals.map(slot => ({
                ...slot,
                hash: buildSlotHash(params, slot),
              })),
            },
            metadata: {
              generation_time_ms: duration,
              proposals_returned: proposals.length,
            },
          },
          null,
          2,
        ),
      },
    ],
  };
}
