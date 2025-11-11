/**
 * Shared type definitions for the calendar meeting agent.
 */

export type MeetingPriority = 'critical' | 'high' | 'normal' | 'low';
export type MeetingIntent = 'intro' | 'discovery' | 'demo' | 'retro' | 'standup' | 'one_on_one' | 'planning' | 'custom';

export interface Participant {
  email: string;
  display_name?: string;
  optional?: boolean;
  timezone?: string;
  priority?: MeetingPriority;
}

export interface AvailabilityWindow {
  start: string; // ISO string
  end: string;   // ISO string
}

export interface WorkingHours {
  start: string; // HH:mm
  end: string;   // HH:mm
  timezone: string;
  days: number[]; // 0 = Sunday
}

export interface SchedulingConstraints {
  working_hours?: WorkingHours;
  meeting_duration_minutes: number;
  buffer_minutes: number;
  max_meetings_per_day?: number;
  allow_back_to_back?: boolean;
  earliest_start?: string; // ISO date
  latest_end?: string; // ISO date
}

export interface ProposedSlot {
  slot_id: string;
  start: string;
  end: string;
  timezone: string;
  score: number;
  reasons: string[];
}

export interface SchedulingRequestInput {
  organizer_email: string;
  meeting_intent: MeetingIntent;
  participants: Participant[];
  constraints: SchedulingConstraints;
  window_start: string;
  window_end: string;
  location_hint?: string;
  notes?: string;
}

export interface SchedulingRequestRecord extends SchedulingRequestInput {
  id: string;
  created_at: string;
  proposed_slots: ProposedSlot[];
  metadata?: Record<string, unknown>;
}

export interface MeetingAgendaSection {
  title: string;
  duration_minutes: number;
  description?: string;
  owner?: string;
}

export interface MeetingAgendaPlan {
  meeting_title: string;
  meeting_date: string;
  meeting_intent: MeetingIntent;
  sections: MeetingAgendaSection[];
  materials: string[];
  reminders: string[];
}

export interface MeetingSummaryRecord {
  event_id: string;
  summary: string;
  highlights: string[];
  action_items: { description: string; owner: string; due: string }[];
  follow_up?: string[];
}

export interface MeetingInsight {
  metric: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'flat';
  commentary: string;
}

export interface MeetingInsightsReport {
  window_start: string;
  window_end: string;
  total_meetings: number;
  focus_time_ratio: number;
  recurring_ratio: number;
  average_meeting_length: number;
  metrics: MeetingInsight[];
  recommendations: string[];
}
