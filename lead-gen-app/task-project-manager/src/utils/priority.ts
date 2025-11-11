import { differenceInCalendarDays, isBefore, isToday, parseISO } from 'date-fns';
import type { PriorityLevel, TaskCreateInput, TaskRecord, TaskUpdateInput } from '../types/index.js';

interface PriorityInputs {
  dueDate?: string | null;
  impact?: number | null;
  effort?: number | null;
  confidence?: number | null;
  createdAt?: string | null;
  status?: string;
}

export interface PriorityResult {
  level: PriorityLevel;
  score: number;
  reasons: string[];
  insights: string[];
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function normalize(value: number | null | undefined, defaultValue: number, max = 5): number {
  if (value === null || value === undefined) {
    return defaultValue / max;
  }
  return clamp(value, 1, max) / max;
}

function computeUrgency(dueDate?: string | null): { score: number; reasons: string[] } {
  if (!dueDate) {
    return { score: 0.35, reasons: ['No due date, using default urgency.'] };
  }

  const parsed = parseISO(dueDate);
  const today = new Date();

  const daysDiff = differenceInCalendarDays(parsed, today);

  if (isToday(parsed)) {
    return { score: 1, reasons: ['Due today'] };
  }

  if (daysDiff < 0) {
    return {
      score: 1 + clamp(Math.abs(daysDiff) * 0.1, 0, 0.5),
      reasons: [`Overdue by ${Math.abs(daysDiff)} day${Math.abs(daysDiff) === 1 ? '' : 's'}`],
    };
  }

  if (daysDiff === 1) {
    return { score: 0.9, reasons: ['Due tomorrow'] };
  }

  if (daysDiff <= 7) {
    return {
      score: 0.7,
      reasons: [`Due in ${daysDiff} day${daysDiff === 1 ? '' : 's'}`],
    };
  }

  if (daysDiff <= 14) {
    return {
      score: 0.55,
      reasons: [`Due in ${daysDiff} days`],
    };
  }

  return {
    score: 0.35,
    reasons: [`Due in ${daysDiff} days`],
  };
}

export function calculatePriority(input: PriorityInputs): PriorityResult {
  const urgency = computeUrgency(input.dueDate);
  const impact = normalize(input.impact, 3);
  const effort = 1 - normalize(input.effort, 3);
  const confidence = normalize(input.confidence, 3);

  const baseScore = (urgency.score * 0.5 + impact * 0.3 + effort * 0.1 + confidence * 0.1) * 100;
  const boundedScore = clamp(baseScore, 0, 100);

  let level: PriorityLevel;
  if (boundedScore >= 85) {
    level = 'urgent';
  } else if (boundedScore >= 65) {
    level = 'high';
  } else if (boundedScore >= 45) {
    level = 'medium';
  } else {
    level = 'low';
  }

  const reasons = urgency.reasons.slice();

  if (impact >= 0.8) {
    reasons.push('High impact');
  } else if (impact <= 0.4) {
    reasons.push('Lower impact');
  }

  if (effort >= 0.75) {
    reasons.push('Quick win');
  } else if (effort <= 0.35) {
    reasons.push('High effort');
  }

  if (confidence <= 0.4) {
    reasons.push('Low confidence');
  }

  const insights: string[] = [];

  if (input.dueDate) {
    const parsed = parseISO(input.dueDate);
    if (isBefore(parsed, new Date()) && input.status !== 'done') {
      insights.push('⚠️ Overdue – needs attention');
    } else if (isToday(parsed)) {
      insights.push('🎯 Due today');
    }
  }

  if (level === 'urgent' && !insights.length) {
    insights.push('🔥 Top priority');
  }

  return {
    level,
    score: Number(boundedScore.toFixed(2)),
    reasons,
    insights,
  };
}

export function mergePrioritySignals(
  record: TaskRecord,
  update: TaskUpdateInput,
): PriorityResult {
  return calculatePriority({
    dueDate: update.dueDate ?? record.dueDate,
    impact: update.impact ?? record.impact ?? undefined,
    effort: update.effort ?? record.effort ?? undefined,
    confidence: update.confidence ?? record.confidence ?? undefined,
    createdAt: record.createdAt,
    status: update.status ?? record.status,
  });
}

export function derivePriorityFromCreate(input: TaskCreateInput): PriorityResult {
  return calculatePriority({
    dueDate: input.dueDate ?? null,
    impact: input.impact ?? input.impacts ?? undefined,
    effort: input.effort ?? undefined,
    confidence: input.confidence ?? undefined,
    status: input.status,
  });
}
