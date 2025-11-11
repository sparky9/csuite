/**
 * MCP Tool: Schedule Meeting
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { v4 as uuid } from 'uuid';
import { parseISO } from 'date-fns';
import { logger } from '../utils/logger.js';
import { calendarDb } from '../db/client.js';
import { buildSlotHash } from '../scheduler/engine.js';
import type { SchedulingRequestInput, ProposedSlot } from '../types/calendar.types.js';

interface ScheduleMeetingInput {
  request_id?: string;
  scheduling_request: SchedulingRequestInput;
  selected_slot: ProposedSlot;
  title: string;
  agenda_items?: string[];
  conferencing?: string;
}

export const scheduleMeetingTool: Tool = {
  name: 'schedule_meeting',
  description: 'Persist a selected slot as a confirmed meeting and emit deterministic identifiers.',
  inputSchema: {
    type: 'object',
    properties: {
      scheduling_request: { type: 'object' },
      request_id: { type: 'string' },
      selected_slot: {
        type: 'object',
      },
      title: { type: 'string' },
      agenda_items: { type: 'array', items: { type: 'string' } },
      conferencing: { type: 'string' },
    },
    required: ['scheduling_request', 'selected_slot', 'title'],
  },
};

export async function handleScheduleMeeting(args: unknown): Promise<any> {
  const params = args as ScheduleMeetingInput;
  const slotHash = buildSlotHash(params.scheduling_request, params.selected_slot);
  const eventId = uuid();

  logger.info('Scheduling meeting from selected slot', {
    hash: slotHash,
    start: params.selected_slot.start,
    end: params.selected_slot.end,
  });

  if (calendarDb.connected) {
    await calendarDb.query(
      `INSERT INTO cm_events (
        id, title, meeting_type, status, start_time, end_time, timezone, agenda, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)`
        ,
      [
        eventId,
        params.title,
        params.scheduling_request.meeting_intent,
        'scheduled',
        parseISO(params.selected_slot.start),
        parseISO(params.selected_slot.end),
  params.selected_slot.timezone ?? params.scheduling_request.constraints.working_hours?.timezone,
        JSON.stringify(
          params.agenda_items?.map((item, index) => ({
            order: index + 1,
            item,
          })) ?? [],
        ),
        JSON.stringify({
          slot_hash: slotHash,
          score: params.selected_slot.score,
          conferencing: params.conferencing,
        }),
      ],
    );

    if (params.request_id) {
      await calendarDb.query(
        `UPDATE cm_scheduling_requests
         SET selected_slot = $2::jsonb, status = 'scheduled', updated_at = NOW()
         WHERE id = $1`,
        [params.request_id, JSON.stringify({ ...params.selected_slot, hash: slotHash })],
      );
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            success: true,
            event: {
              id: eventId,
              slot_hash: slotHash,
              start: params.selected_slot.start,
              end: params.selected_slot.end,
              timezone: params.selected_slot.timezone,
            },
            scheduling_request: {
              id: params.request_id,
              meeting_intent: params.scheduling_request.meeting_intent,
              participants: params.scheduling_request.participants,
            },
          },
          null,
          2,
        ),
      },
    ],
  };
}
