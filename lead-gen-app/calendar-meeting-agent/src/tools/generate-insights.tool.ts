/**
 * MCP Tool: Generate Meeting Insights
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { differenceInMinutes, parseISO } from 'date-fns';
import { loadEvents, type CalendarEvent } from '../utils/calendar.js';
import type { MeetingInsightsReport } from '../types/calendar.types.js';

interface GenerateInsightsInput {
  participant_emails: string[];
  window_start: string;
  window_end: string;
}

export const generateInsightsTool: Tool = {
  name: 'generate_meeting_insights',
  description: 'Analyse calendar events over a window and emit deterministic focus metrics.',
  inputSchema: {
    type: 'object',
    properties: {
      participant_emails: { type: 'array', items: { type: 'string' } },
      window_start: { type: 'string' },
      window_end: { type: 'string' },
    },
    required: ['participant_emails', 'window_start', 'window_end'],
  },
};

export async function handleGenerateInsights(args: unknown): Promise<any> {
  const params = args as GenerateInsightsInput;
  const eventMap = await loadEvents({
    participantEmails: params.participant_emails,
    windowStart: params.window_start,
    windowEnd: params.window_end,
  });

  const events: CalendarEvent[] = Object.values(eventMap).flat();

  const totalMeetings = events.length;
  const totalMinutes = events.reduce<number>((sum, event) => sum + differenceInMinutes(parseISO(event.end), parseISO(event.start)), 0);
  const recurring = events.filter(event => (event.metadata as { recurring?: boolean } | undefined)?.recurring === true).length;
  const focusSlots = events.filter(event => (event.metadata as { intent?: string } | undefined)?.intent === 'focus').length;

  const report: MeetingInsightsReport = {
    window_start: params.window_start,
    window_end: params.window_end,
    total_meetings: totalMeetings,
    focus_time_ratio: totalMeetings === 0 ? 0 : focusSlots / totalMeetings,
    recurring_ratio: totalMeetings === 0 ? 0 : recurring / totalMeetings,
    average_meeting_length: totalMeetings === 0 ? 0 : totalMinutes / totalMeetings,
    metrics: [
      {
        metric: 'total_meetings',
        value: totalMeetings,
        unit: 'count',
  trend: totalMeetings > 10 ? 'up' : totalMeetings < 5 ? 'down' : 'flat',
  commentary: totalMeetings > 10 ? 'High meeting load detected' : 'Meeting load within expected range',
      },
      {
        metric: 'average_meeting_length',
        value: totalMinutes === 0 ? 0 : Math.round((totalMinutes / totalMeetings) * 10) / 10,
        unit: 'minutes',
        trend: totalMinutes / Math.max(1, totalMeetings) > 45 ? 'up' : 'flat',
        commentary: 'Monitor for meeting bloat and protect focus time',
      },
    ],
    recommendations: [
      'Protect 2-hour focus block mid-week',
      'Batch recurring check-ins on Tuesdays',
      'Audit meetings longer than 60 minutes',
    ],
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ success: true, report }, null, 2),
      },
    ],
  };
}
