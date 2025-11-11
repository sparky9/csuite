/**
 * Deterministic scheduling utilities.
 */

import crypto from 'crypto';
import { addMinutes, differenceInMinutes, formatISO, max as dateMax, min as dateMin } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type {
  AvailabilityWindow,
  ProposedSlot,
  SchedulingConstraints,
  SchedulingRequestInput,
} from '../types/calendar.types.js';
import type { CalendarEvent } from '../utils/calendar.js';

interface BusyBlock {
  start: Date;
  end: Date;
  source: string;
}

function deterministicHash(seed: string): string {
  return crypto.createHash('sha256').update(seed).digest('hex');
}

function normalizeEvents(events: CalendarEvent[]): BusyBlock[] {
  return events.map(event => ({
    start: new Date(event.start),
    end: new Date(event.end),
    source: event.id,
  }));
}

function mergeBusyBlocks(blocks: BusyBlock[]): BusyBlock[] {
  if (!blocks.length) {
    return [];
  }

  const sorted = [...blocks].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: BusyBlock[] = [];

  let current = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    if (next.start <= current.end) {
      current = {
        start: current.start,
        end: next.end > current.end ? next.end : current.end,
        source: `${current.source},${next.source}`,
      };
    } else {
      merged.push(current);
      current = next;
    }
  }

  merged.push(current);
  return merged;
}

function isWithinWorkingHours(date: Date, constraints: SchedulingConstraints): boolean {
  if (!constraints.working_hours) {
    return true;
  }
  const { working_hours } = constraints;
  const zoned = toZonedTime(date, working_hours.timezone);
  const day = zoned.getDay();
  if (!working_hours.days.includes(day)) {
    return false;
  }

  const [startHour, startMinute] = working_hours.start.split(':').map(Number);
  const [endHour, endMinute] = working_hours.end.split(':').map(Number);

  const startOfDay = new Date(zoned);
  startOfDay.setHours(startHour, startMinute, 0, 0);
  const endOfDay = new Date(zoned);
  endOfDay.setHours(endHour, endMinute, 0, 0);

  return zoned >= startOfDay && zoned <= endOfDay;
}

function hasConflicts(slotStart: Date, slotEnd: Date, busyBlocks: BusyBlock[], bufferMinutes: number): boolean {
  const bufferedStart = addMinutes(slotStart, -bufferMinutes);
  const bufferedEnd = addMinutes(slotEnd, bufferMinutes);
  return busyBlocks.some(block => !(bufferedEnd <= block.start || bufferedStart >= block.end));
}

interface SlotContext {
  slotStart: Date;
  slotEnd: Date;
  constraints: SchedulingConstraints;
  busyByParticipant: Record<string, BusyBlock[]>;
}

function scoreSlot(slotIdSeed: string, context: SlotContext): number {
  const { slotStart, slotEnd, constraints, busyByParticipant } = context;

  let score = 0;

  // Reward earlier slots within window
  score += 500 - Math.min(500, Math.floor(slotStart.getTime() / (1000 * 60 * 30)) % 500);

  // Penalize conflicts
  const conflicts = Object.values(busyByParticipant).filter(blocks => hasConflicts(slotStart, slotEnd, blocks, constraints.buffer_minutes));
  score -= conflicts.length * 200;

  // Reward alignment with working hours
  if (constraints.working_hours && isWithinWorkingHours(slotStart, constraints)) {
    score += 150;
  }

  // Penalize too-early/late
  const zoned = constraints.working_hours
    ? toZonedTime(slotStart, constraints.working_hours.timezone)
    : slotStart;
  const hour = zoned.getHours();
  if (hour >= 11 && hour <= 15) {
    score += 80; // midday sweet spot
  }

  // Deterministic jitter to break ties
  const hash = deterministicHash(slotIdSeed);
  score += parseInt(hash.slice(0, 2), 16) % 50;

  return score;
}

export function findProposedSlots(
  input: SchedulingRequestInput,
  availability: Record<string, CalendarEvent[]>,
  maxProposals = 5,
): ProposedSlot[] {
  const windowStart = new Date(input.window_start);
  const windowEnd = new Date(input.window_end);
  const slotDuration = input.constraints.meeting_duration_minutes;
  const granularity = Math.max(5, input.constraints.buffer_minutes, parseInt(process.env.MIN_SLOT_GRANULARITY_MINUTES ?? '15', 10));

  const busyByParticipant: Record<string, BusyBlock[]> = {};
  for (const participant of input.participants) {
    const events = availability[participant.email] ?? [];
    busyByParticipant[participant.email] = mergeBusyBlocks(normalizeEvents(events));
  }

  const proposals: ProposedSlot[] = [];
  let cursor = new Date(windowStart);

  while (cursor < windowEnd) {
    const slotStart = new Date(cursor);
    const slotEnd = addMinutes(slotStart, slotDuration);
    if (slotEnd > windowEnd) {
      break;
    }

    const violatesWorkingHours = !isWithinWorkingHours(slotStart, input.constraints) || !isWithinWorkingHours(slotEnd, input.constraints);
    const conflicts = Object.entries(busyByParticipant).filter(([, blocks]) => hasConflicts(slotStart, slotEnd, blocks, input.constraints.buffer_minutes));

    if (!violatesWorkingHours && conflicts.length === 0) {
      const slotIdSeed = `${input.organizer_email}:${slotStart.toISOString()}:${slotEnd.toISOString()}`;
      const score = scoreSlot(slotIdSeed, { slotStart, slotEnd, constraints: input.constraints, busyByParticipant });
      const reasons = ['All participants free', 'Within working hours'];

      proposals.push({
        slot_id: `slot_${deterministicHash(slotIdSeed).slice(0, 10)}`,
        start: formatISO(slotStart),
        end: formatISO(slotEnd),
        timezone: input.constraints.working_hours?.timezone ?? input.participants[0]?.timezone ?? 'UTC',
        score,
        reasons,
      });
    }

    cursor = addMinutes(cursor, granularity);
  }

  proposals.sort((a, b) => b.score - a.score);

  return proposals.slice(0, maxProposals);
}

export function computeFocusTimeRatio(events: CalendarEvent[], workingMinutes = 40 * 60): number {
  if (!events.length) {
    return 1;
  }
  const meetingMinutes = events.reduce((total, event) => total + differenceInMinutes(new Date(event.end), new Date(event.start)), 0);
  const ratio = 1 - meetingMinutes / workingMinutes;
  return Math.max(0, Math.min(1, Number(ratio.toFixed(3))));
}

export function buildAvailabilityFromEvents(events: CalendarEvent[]): AvailabilityWindow[] {
  return events.map(event => ({ start: event.start, end: event.end }));
}

export function clampToWindow(events: CalendarEvent[], start: string, end: string): CalendarEvent[] {
  const windowStart = new Date(start);
  const windowEnd = new Date(end);
  return events.map(event => {
    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);
    const clampedStart = dateMax([eventStart, windowStart]);
    const clampedEnd = dateMin([eventEnd, windowEnd]);
    return {
      ...event,
      start: formatISO(clampedStart),
      end: formatISO(clampedEnd),
    };
  });
}

export function buildSlotHash(input: SchedulingRequestInput, slot: ProposedSlot): string {
  return deterministicHash([
    input.organizer_email,
    input.meeting_intent,
    slot.start,
    slot.end,
    slot.timezone,
    ...input.participants.map(p => p.email).sort(),
  ].join('|'));
}
