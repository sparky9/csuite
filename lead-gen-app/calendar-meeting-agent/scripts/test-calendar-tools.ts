/**
 * Smoke test harness for calendar meeting MCP tools.
 */

import 'dotenv/config';
import { inspect } from 'node:util';

import { initializeCalendarDb, shutdownCalendarDb } from '../src/db/client.js';
import { logger } from '../src/utils/logger.js';
import { handleProposeMeetingSlots } from '../src/tools/propose-meeting-slots.tool.js';
import { handleScheduleMeeting } from '../src/tools/schedule-meeting.tool.js';
import { handleIngestAvailability } from '../src/tools/ingest-availability.tool.js';
import { handleGenerateAgenda } from '../src/tools/generate-agenda.tool.js';
import { handleGenerateSummary } from '../src/tools/generate-summary.tool.js';
import { handleGenerateInsights } from '../src/tools/generate-insights.tool.js';
import type {
  Participant,
  SchedulingConstraints,
  SchedulingRequestInput,
  ProposedSlot,
  MeetingAgendaPlan,
  MeetingSummaryRecord,
  MeetingInsightsReport,
} from '../src/types/calendar.types.js';

type ToolResponse = {
  content?: Array<{ type: string; text?: string }>;
};

interface ProposeResponse {
  success: boolean;
  request: {
    id: string;
    meeting_intent: string;
    proposed_slots: Array<ProposedSlot & { hash?: string }>;
  };
  metadata: {
    generation_time_ms: number;
    proposals_returned: number;
  };
}

interface ScheduleResponse {
  success: boolean;
  event: {
    id: string;
    slot_hash: string;
    start: string;
    end: string;
    timezone?: string;
  };
  scheduling_request: {
    meeting_intent: string;
    participants: Participant[];
  };
}

interface AgendaResponse {
  success: boolean;
  agenda: MeetingAgendaPlan;
}

interface SummaryResponse {
  success: boolean;
  summary: MeetingSummaryRecord;
}

interface InsightsResponse {
  success: boolean;
  report: MeetingInsightsReport;
}

function parseToolResponse<T>(payload: ToolResponse): T {
  const textEntry = payload.content?.find(
    (entry): entry is { type: 'text'; text: string } => entry.type === 'text' && typeof entry.text === 'string',
  );
  if (!textEntry) {
    throw new Error('Tool response missing text content.');
  }
  return JSON.parse(textEntry.text) as T;
}

async function runSmokeTest(): Promise<void> {
  const connected = await initializeCalendarDb().catch(error => {
    logger.warn('Database connection failed, continuing with synthetic data.', { error: (error as Error).message });
    return false;
  });

  logger.info('Calendar tool smoke test starting', { connected });

  const organizer = 'owner@example.com';
  const participants: Participant[] = [
    { email: organizer, display_name: 'Owner Example', timezone: 'America/New_York', priority: 'high' },
    { email: 'teammate@example.com', display_name: 'Teammate Example', timezone: 'America/Chicago' },
    { email: 'advisor@example.com', display_name: 'Advisor Example', optional: true, timezone: 'America/Los_Angeles' },
  ];

  const constraints: SchedulingConstraints = {
    meeting_duration_minutes: 45,
    buffer_minutes: 15,
    working_hours: {
      start: '09:00',
      end: '17:00',
      timezone: 'America/New_York',
      days: [1, 2, 3, 4, 5],
    },
    max_meetings_per_day: 6,
    allow_back_to_back: false,
  };

  const now = new Date();
  const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
  const windowEnd = new Date(windowStart.getTime() + 5 * 24 * 60 * 60 * 1000);

  const schedulingRequest: SchedulingRequestInput = {
    organizer_email: organizer,
    meeting_intent: 'discovery',
    participants,
    constraints,
    window_start: windowStart.toISOString(),
    window_end: windowEnd.toISOString(),
    notes: 'Automated smoke test request',
  };

  logger.info('Running propose_meeting_slots');
  const proposeResultRaw = await handleProposeMeetingSlots(schedulingRequest);
  const proposeParsed = parseToolResponse<ProposeResponse>(proposeResultRaw);

  logger.info('Proposed slots result', proposeParsed.metadata);

  if (!proposeParsed.request?.proposed_slots?.length) {
    throw new Error('No proposed slots returned; smoke test cannot continue.');
  }

  const [firstSlot] = proposeParsed.request.proposed_slots;
  const slotWithoutHash = { ...firstSlot } as ProposedSlot & { hash?: string };
  delete (slotWithoutHash as { hash?: string }).hash;
  const slotToSchedule: ProposedSlot = slotWithoutHash;
  if (typeof slotToSchedule.start !== 'string' || typeof slotToSchedule.end !== 'string') {
    throw new Error('Selected slot missing start/end fields.');
  }

  logger.info('Running ingest_availability_snapshot');
  await handleIngestAvailability({
    organizer_email: organizer,
    window_start: schedulingRequest.window_start,
    window_end: schedulingRequest.window_end,
    timezone: constraints.working_hours?.timezone ?? 'UTC',
    busy_blocks: [
      {
        start: schedulingRequest.window_start,
        end: new Date(new Date(schedulingRequest.window_start).getTime() + 60 * 60 * 1000).toISOString(),
        source: 'smoke-test-block',
      },
    ],
  });

  logger.info('Running schedule_meeting');
  const scheduleResultRaw = await handleScheduleMeeting({
    request_id: proposeParsed.request.id,
    scheduling_request: schedulingRequest,
  selected_slot: slotToSchedule,
    title: 'Smoke Test Discovery Sync',
    agenda_items: ['Welcome & context', 'Current tooling review', 'Next steps'],
    conferencing: 'https://example.com/video',
  });
  const scheduleParsed = parseToolResponse<ScheduleResponse>(scheduleResultRaw);
  logger.info('Scheduled event summary', scheduleParsed);

  logger.info('Running generate_meeting_agenda');
  const agendaResultRaw = await handleGenerateAgenda({
    title: 'Product Discovery Sync',
  meeting_date: slotToSchedule.start,
    intent: schedulingRequest.meeting_intent,
    participants,
    duration_minutes: constraints.meeting_duration_minutes,
  });
  const agendaParsed = parseToolResponse<AgendaResponse>(agendaResultRaw);
  logger.info('Agenda generated', { sections: agendaParsed.agenda.sections.length });

  logger.info('Running generate_meeting_summary');
  const summaryResultRaw = await handleGenerateSummary({
    event_id: scheduleParsed?.event?.id ?? 'synthetic-event-id',
    intent: schedulingRequest.meeting_intent,
    participants,
    highlights_seed: 'smoke-test-seed',
  });
  const summaryParsed = parseToolResponse<SummaryResponse>(summaryResultRaw);
  logger.info('Summary generated', { highlights: summaryParsed.summary.highlights });

  logger.info('Running generate_meeting_insights');
  const insightsResultRaw = await handleGenerateInsights({
    participant_emails: participants.map(participant => participant.email),
    window_start: schedulingRequest.window_start,
    window_end: schedulingRequest.window_end,
  });
  const insightsParsed = parseToolResponse<InsightsResponse>(insightsResultRaw);
  logger.info('Insights generated', {
    total_meetings: insightsParsed.report.total_meetings,
    focus_time_ratio: insightsParsed.report.focus_time_ratio,
  });

  logger.info('Calendar tool smoke test completed');
  logger.info('Sample output snapshot:\n%s', inspect({
  proposed: proposeParsed.request.proposed_slots.slice(0, 1),
    scheduled: scheduleParsed,
    agenda: agendaParsed,
    summary: summaryParsed,
    insights: insightsParsed,
  }, { depth: 4 }));
}

runSmokeTest()
  .catch(async (error) => {
    logger.error('Calendar tool smoke test failed', { error: error.message, stack: error.stack });
    process.exitCode = 1;
  })
  .finally(async () => {
    await shutdownCalendarDb();
  });
