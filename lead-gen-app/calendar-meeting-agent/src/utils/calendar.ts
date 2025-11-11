/**
 * Helpers for retrieving or synthesising calendar event data.
 */

import crypto from 'crypto';
import { addMinutes, formatISO, startOfDay } from 'date-fns';
import { calendarDb } from '../db/client.js';
import { logger } from './logger.js';

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  timezone: string;
  meeting_type?: string;
  organizer?: string;
  participants?: string[];
  metadata?: Record<string, unknown>;
}

function deterministicHash(seed: string): string {
  return crypto.createHash('sha256').update(seed).digest('hex');
}

function synthesizeEvents(email: string, windowStart: Date, windowEnd: Date): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const baseHash = deterministicHash(email + windowStart.toISOString() + windowEnd.toISOString());
  const totalDays = Math.max(1, Math.ceil((windowEnd.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24)));

  for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
    const daySeed = deterministicHash(`${baseHash}:${dayIndex}`);
    const dayStart = addMinutes(startOfDay(addMinutes(windowStart, dayIndex * 24 * 60)), 0);

    // Determine number of meetings this day (0-3)
    const meetingsToday = parseInt(daySeed.slice(0, 2), 16) % 4;

    for (let meetingIndex = 0; meetingIndex < meetingsToday; meetingIndex++) {
      const meetingSeed = deterministicHash(`${daySeed}:${meetingIndex}`);
      const offsetMinutes = (parseInt(meetingSeed.slice(0, 3), 16) % (9 * 60)) + 8 * 60; // between 8:00 and 17:00
      const durationMinutes = [30, 45, 60, 90][parseInt(meetingSeed.slice(3, 4), 16) % 4];

      const startTime = addMinutes(dayStart, offsetMinutes);
      const endTime = addMinutes(startTime, durationMinutes);

      if (endTime > windowEnd) {
        continue;
      }

      events.push({
        id: `synthetic_${email}_${dayIndex}_${meetingIndex}`,
        title: `Blocked - ${email.split('@')[0]}`,
        start: formatISO(startTime),
        end: formatISO(endTime),
        timezone: 'UTC',
        organizer: email,
        participants: [email],
      });
    }
  }

  return events;
}

export interface LoadEventsOptions {
  participantEmails: string[];
  windowStart: string;
  windowEnd: string;
}

export async function loadEvents(options: LoadEventsOptions): Promise<Record<string, CalendarEvent[]>> {
  const { participantEmails, windowStart, windowEnd } = options;
  const results: Record<string, CalendarEvent[]> = {};
  const startDate = new Date(windowStart);
  const endDate = new Date(windowEnd);

  if (calendarDb.connected) {
    const sql = `
      SELECT u.email, e.id, e.title, e.start_time, e.end_time, e.timezone, e.meeting_type
      FROM cm_events e
      JOIN cm_calendars c ON e.calendar_id = c.id
      JOIN cm_users u ON c.user_id = u.id
      WHERE u.email = ANY($1)
        AND e.start_time < $3
        AND e.end_time > $2
    `;
    const res = await calendarDb.query<{
      email: string;
      id: string;
      title: string;
      start_time: Date;
      end_time: Date;
      timezone: string;
      meeting_type: string | null;
    }>(sql, [participantEmails, startDate, endDate]);

    for (const row of res.rows) {
      if (!results[row.email]) {
        results[row.email] = [];
      }
      results[row.email].push({
        id: row.id,
        title: row.title,
        start: row.start_time.toISOString(),
        end: row.end_time.toISOString(),
        timezone: row.timezone,
        meeting_type: row.meeting_type ?? undefined,
      });
    }

    const missing = participantEmails.filter(email => !(email in results));
    if (missing.length) {
      logger.debug('No events found for participants, synthesising windows', { missing });
      for (const email of missing) {
        results[email] = synthesizeEvents(email, startDate, endDate);
      }
    }
  } else {
    logger.debug('Calendar DB not connected, synthesising events');
    for (const email of participantEmails) {
      results[email] = synthesizeEvents(email, startDate, endDate);
    }
  }

  return results;
}
