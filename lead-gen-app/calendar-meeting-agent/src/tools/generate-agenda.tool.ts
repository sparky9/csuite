/**
 * MCP Tool: Generate Meeting Agenda
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { buildAgenda } from '../meeting/templates.js';
import type { MeetingAgendaPlan, MeetingIntent, Participant } from '../types/calendar.types.js';

interface GenerateAgendaInput {
  title: string;
  meeting_date: string;
  intent: MeetingIntent;
  participants: Participant[];
  duration_minutes: number;
}

export const generateAgendaTool: Tool = {
  name: 'generate_meeting_agenda',
  description: 'Produce a deterministic agenda plan for an upcoming meeting.',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      meeting_date: { type: 'string' },
      intent: { type: 'string' },
      participants: { type: 'array' },
      duration_minutes: { type: 'number' },
    },
    required: ['title', 'meeting_date', 'intent', 'participants', 'duration_minutes'],
  },
};

export async function handleGenerateAgenda(args: unknown): Promise<any> {
  const params = args as GenerateAgendaInput;
  const agenda: MeetingAgendaPlan = buildAgenda(
    params.title,
    params.meeting_date,
    params.intent,
    params.participants,
    params.duration_minutes,
  );

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ success: true, agenda }, null, 2),
      },
    ],
  };
}
