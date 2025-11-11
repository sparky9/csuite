/**
 * Deterministic meeting agenda and summary templates.
 */

import crypto from 'crypto';
import { format } from 'date-fns';
import type {
  MeetingAgendaPlan,
  MeetingAgendaSection,
  MeetingIntent,
  MeetingSummaryRecord,
  Participant,
} from '../types/calendar.types.js';

function hashSeed(seed: string): string {
  return crypto.createHash('sha256').update(seed).digest('hex');
}

const AGENDA_LIBRARY: Record<MeetingIntent, MeetingAgendaSection[]> = {
  intro: [
    { title: 'Introductions', duration_minutes: 5 },
    { title: 'Company Overview', duration_minutes: 10 },
    { title: 'Goals & Expectations', duration_minutes: 10 },
    { title: 'Next Steps', duration_minutes: 5 },
  ],
  discovery: [
    { title: 'Context & Current State', duration_minutes: 10 },
    { title: 'Pain Points & Challenges', duration_minutes: 15 },
    { title: 'Success Criteria', duration_minutes: 10 },
    { title: 'Action Plan', duration_minutes: 5 },
  ],
  demo: [
    { title: 'Problem Recap', duration_minutes: 5 },
    { title: 'Demo Walkthrough', duration_minutes: 20 },
    { title: 'Q&A', duration_minutes: 10 },
    { title: 'Implementation Path', duration_minutes: 5 },
  ],
  retro: [
    { title: 'Sprint Highlights', duration_minutes: 10 },
    { title: 'What Went Well', duration_minutes: 10 },
    { title: 'What Could Improve', duration_minutes: 10 },
    { title: 'Action Items', duration_minutes: 10 },
  ],
  standup: [
    { title: 'Yesterday', duration_minutes: 5 },
    { title: 'Today', duration_minutes: 5 },
    { title: 'Blockers', duration_minutes: 5 },
  ],
  one_on_one: [
    { title: 'Wins & Progress', duration_minutes: 10 },
    { title: 'Development Topics', duration_minutes: 15 },
    { title: 'Support Needed', duration_minutes: 10 },
    { title: 'Commitments', duration_minutes: 5 },
  ],
  planning: [
    { title: 'Objective Review', duration_minutes: 10 },
    { title: 'Backlog Prioritisation', duration_minutes: 15 },
    { title: 'Capacity & Risks', duration_minutes: 10 },
    { title: 'Plan Sign-off', duration_minutes: 5 },
  ],
  custom: [
    { title: 'Kick-off', duration_minutes: 10 },
    { title: 'Primary Discussion', duration_minutes: 20 },
    { title: 'Decisions & Follow-ups', duration_minutes: 10 },
  ],
};

export function buildAgenda(
  meetingTitle: string,
  meetingDate: string,
  intent: MeetingIntent,
  participants: Participant[],
  durationMinutes: number,
): MeetingAgendaPlan {
  const baseSections = AGENDA_LIBRARY[intent] ?? AGENDA_LIBRARY.custom;
  const normalizedSections: MeetingAgendaSection[] = baseSections.map(section => ({ ...section }));

  const totalPlanned = normalizedSections.reduce((sum, section) => sum + section.duration_minutes, 0);
  const remaining = durationMinutes - totalPlanned;
  if (remaining > 0) {
    normalizedSections.push({ title: 'Buffer / Q&A', duration_minutes: remaining });
  } else if (remaining < 0) {
    const adjustFactor = durationMinutes / totalPlanned;
    normalizedSections.forEach(section => {
      section.duration_minutes = Math.max(5, Math.round(section.duration_minutes * adjustFactor));
    });
  }

  const hashed = hashSeed(`${meetingTitle}:${meetingDate}:${intent}`);
  normalizedSections.forEach((section, index) => {
    const participantIndex = parseInt(hashed.slice(index * 2, index * 2 + 2), 16) % Math.max(1, participants.length);
    section.owner = participants[participantIndex]?.display_name ?? participants[participantIndex]?.email ?? 'Owner TBC';
    section.description = section.description ?? `Discuss ${section.title.toLowerCase()}.`;
  });

  const materials = [
    'Pre-read slides',
    'Latest metrics snapshot',
    'Decision log',
  ];

  const reminders = [
    'Review agenda 24h before meeting',
    'Confirm attendees have required materials',
  ];

  return {
    meeting_title: meetingTitle,
    meeting_date: format(new Date(meetingDate), 'yyyy-MM-dd'),
    meeting_intent: intent,
    sections: normalizedSections,
    materials,
    reminders,
  };
}

export function buildMeetingSummary(
  eventId: string,
  intent: MeetingIntent,
  participants: Participant[],
  highlightsSeed: string,
): MeetingSummaryRecord {
  const hash = hashSeed(`${eventId}:${intent}:${highlightsSeed}`);

  const highlightTemplates = {
    intro: ['Met key stakeholder', 'Confirmed success metrics', 'Identified follow-up items'],
    discovery: ['Validated pain point', 'Captured requirements', 'Agreed on evaluation timeline'],
    demo: ['Showcased product flow', 'Demonstrated key feature', 'Captured product feedback'],
    retro: ['Identified improvement actions', 'Celebrated wins', 'Documented risks'],
    standup: ['Synced on priorities', 'Cleared blockers', 'Updated daily board'],
    one_on_one: ['Discussed development goals', 'Reviewed performance feedback', 'Aligned on support needs'],
    planning: ['Confirmed sprint goal', 'Prioritised backlog', 'Locked capacity plan'],
    custom: ['Discussed core agenda', 'Recorded decisions', 'Planned next steps'],
  } as const;

  const highlightsBase = highlightTemplates[intent] ?? highlightTemplates.custom;
  const highlights = highlightsBase.map((item, index) => {
    const suffix = parseInt(hash.slice(index * 2, index * 2 + 2), 16) % 3;
    return `${item}${suffix === 0 ? '' : suffix === 1 ? ' with clear ownership' : ' and supporting evidence'}`;
  });

  const actionOwners = participants.map(participant => participant.display_name ?? participant.email);
  const actionItems = [0, 1].map(index => ({
    description: index === 0 ? 'Document decision log' : 'Send recap email',
    owner: actionOwners[index % actionOwners.length] ?? 'Unassigned',
    due: format(new Date(Date.now() + (index + 2) * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
  }));

  const summary = `Meeting intent: ${intent}. ${highlights[0]}. ${highlights[1]}. ${highlights[2]}.`;

  return {
    event_id: eventId,
    summary,
    highlights,
    action_items: actionItems,
    follow_up: ['Schedule next checkpoint', 'Share materials with absent attendees'],
  };
}
