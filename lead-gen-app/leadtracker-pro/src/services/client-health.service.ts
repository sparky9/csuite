/**
 * Client health analysis service
 */

import { db } from '../db/client.js';
import { logger } from '../utils/logger.js';
import type {
  ClientHealthResult,
  ClientHealthSignals,
  HealthLevel,
  Prospect,
} from '../types/leadtracker.types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const POSITIVE_SENTIMENT_KEYWORDS = ['great', 'happy', 'excited', 'love', 'excellent', 'positive', 'win'];
const NEGATIVE_SENTIMENT_KEYWORDS = ['frustrated', 'angry', 'upset', 'unhappy', 'delay', 'concern', 'issue', 'problem'];

const PAYMENT_CURRENT_KEYWORDS = ['payment received', 'paid', 'invoice settled', 'cleared payment'];
const PAYMENT_LATE_KEYWORDS = ['overdue', 'late fee', 'past due', 'unpaid', 'collections'];

const PROJECT_KEYWORDS = ['project', 'campaign', 'rollout', 'retainer', 'implementation'];

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function classifyHealth(score: number): HealthLevel {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'healthy';
  if (score >= 55) return 'warning';
  if (score >= 40) return 'at-risk';
  return 'critical';
}

function detectSentimentFromText(notes: string[]): 'positive' | 'neutral' | 'negative' | 'unknown' {
  if (!notes.length) {
    return 'unknown';
  }

  let positiveHits = 0;
  let negativeHits = 0;

  for (const note of notes) {
    const lower = note.toLowerCase();

    if (POSITIVE_SENTIMENT_KEYWORDS.some((keyword) => lower.includes(keyword))) {
      positiveHits += 1;
    }

    if (NEGATIVE_SENTIMENT_KEYWORDS.some((keyword) => lower.includes(keyword))) {
      negativeHits += 1;
    }
  }

  if (positiveHits === 0 && negativeHits === 0) {
    return 'neutral';
  }

  if (positiveHits > negativeHits) {
    return 'positive';
  }

  if (negativeHits > positiveHits) {
    return 'negative';
  }

  return 'neutral';
}

function determinePaymentStatus(activityNotes: string[], followUpNotes: Array<{ due_date: Date; completed: boolean }>): 'current' | 'late' | 'unknown' {
  const lowerNotes = activityNotes.map((note) => note.toLowerCase());

  if (lowerNotes.some((note) => PAYMENT_LATE_KEYWORDS.some((keyword) => note.includes(keyword)))) {
    return 'late';
  }

  const lateFollowUp = followUpNotes.find((follow) => {
    return !follow.completed && follow.due_date.getTime() < Date.now();
  });

  if (lateFollowUp) {
    return 'late';
  }

  if (lowerNotes.some((note) => PAYMENT_CURRENT_KEYWORDS.some((keyword) => note.includes(keyword)))) {
    return 'current';
  }

  return 'unknown';
}

function extractProjectCount(prospect: Prospect, activityNotes: string[]): number {
  const projectTags = (prospect.tags || []).filter((tag) => tag.toLowerCase().startsWith('project:'));
  if (projectTags.length) {
    return projectTags.length;
  }

  const uniqueMentions = new Set<string>();
  for (const note of activityNotes) {
    const lower = note.toLowerCase();
    if (PROJECT_KEYWORDS.some((keyword) => lower.includes(keyword))) {
      const normalized = lower.slice(0, 120);
      uniqueMentions.add(normalized);
    }
  }

  return uniqueMentions.size;
}

function calculateAverageResponseHours(activityDates: Date[]): number | null {
  if (activityDates.length < 2) {
    return null;
  }

  const chronological = [...activityDates].sort((a, b) => a.getTime() - b.getTime());
  const intervals: number[] = [];

  for (let index = 1; index < chronological.length; index += 1) {
    const deltaMs = chronological[index].getTime() - chronological[index - 1].getTime();
    const deltaHours = deltaMs / (60 * 60 * 1000);

    if (deltaHours > 0 && deltaHours <= 240) {
      intervals.push(deltaHours);
    }
  }

  if (!intervals.length) {
    return null;
  }

  const sum = intervals.reduce((acc, value) => acc + value, 0);
  return Number((sum / intervals.length).toFixed(1));
}

interface AnalyzeClientHealthParams {
  userId: string;
  prospectId: string;
}

export async function analyzeClientHealth({ userId, prospectId }: AnalyzeClientHealthParams): Promise<ClientHealthResult> {
  logger.info('Analyzing client health', { userId, prospectId });

  const prospectQuery = `
    SELECT id, user_id, company_name, tags, status, deal_value, last_contacted_at, last_interaction_date,
           sentiment_trend, health_score, health_level
    FROM prospects
    WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)
  `;

  const prospect = await db.queryOne<Prospect>(prospectQuery, [prospectId, userId]);

  if (!prospect) {
    throw new Error('Prospect not found or not accessible for this user');
  }

  const activityResult = await db.query<{
    activity_type: string;
    activity_date: Date;
    subject: string | null;
    notes: string | null;
  }>(
    `
      SELECT activity_type, activity_date, subject, notes
      FROM activities
      WHERE prospect_id = $1
      ORDER BY activity_date DESC
      LIMIT 50
    `,
    [prospectId]
  );

  const followUpResult = await db.query<{
    due_date: Date;
    reminder_note: string | null;
    completed: boolean;
  }>(
    `
      SELECT due_date, reminder_note, completed
      FROM follow_ups
      WHERE prospect_id = $1
        AND reminder_note ILIKE ANY(ARRAY['%invoice%', '%payment%', '%bill%'])
      ORDER BY due_date DESC
      LIMIT 10
    `,
    [prospectId]
  );

  const activityRows = activityResult.rows;
  const followUps = followUpResult.rows;

  const activityNotes = activityRows.map((row) => `${row.subject ?? ''} ${row.notes ?? ''}`.trim()).filter(Boolean);
  const activityDates = activityRows.map((row) => new Date(row.activity_date));

  const latestInteractionActivity = activityRows.find((row) => ['call', 'email', 'meeting'].includes(row.activity_type));
  const lastInteractionDate = latestInteractionActivity
    ? new Date(latestInteractionActivity.activity_date)
    : prospect.last_contacted_at ?? prospect.last_interaction_date ?? null;

  const lastInteractionDays = lastInteractionDate
    ? Math.floor((Date.now() - lastInteractionDate.getTime()) / DAY_MS)
    : null;

  const paymentStatus = determinePaymentStatus(
    activityNotes,
    followUps.map((follow) => ({
      completed: follow.completed,
      due_date: follow.due_date instanceof Date ? follow.due_date : new Date(follow.due_date),
    }))
  );

  const projectCount = extractProjectCount(prospect, activityNotes);
  const avgResponseTimeHours = calculateAverageResponseHours(activityDates);

  let sentimentTrend: ClientHealthSignals['sentimentTrend'];
  if (prospect.sentiment_trend && ['positive', 'neutral', 'negative'].includes(prospect.sentiment_trend)) {
    sentimentTrend = prospect.sentiment_trend as ClientHealthSignals['sentimentTrend'];
  } else {
    sentimentTrend = detectSentimentFromText(activityNotes);
  }

  let score = 80;

  if (lastInteractionDays === null) {
    score -= 15;
  } else if (lastInteractionDays > 60) {
    score -= 35;
  } else if (lastInteractionDays > 30) {
    score -= 25;
  } else if (lastInteractionDays > 14) {
    score -= 15;
  } else if (lastInteractionDays <= 7) {
    score += 5;
  }

  if (paymentStatus === 'late') {
    score -= 25;
  } else if (paymentStatus === 'current') {
    score += 5;
  } else {
    score -= 5;
  }

  if (projectCount === 0) {
    score -= 10;
  } else if (projectCount >= 3) {
    score += 5;
  }

  if (avgResponseTimeHours === null) {
    score -= 5;
  } else if (avgResponseTimeHours > 72) {
    score -= 20;
  } else if (avgResponseTimeHours > 48) {
    score -= 15;
  } else if (avgResponseTimeHours > 24) {
    score -= 10;
  } else if (avgResponseTimeHours <= 12) {
    score += 5;
  }

  if (sentimentTrend === 'positive') {
    score += 5;
  } else if (sentimentTrend === 'negative') {
    score -= 20;
  } else if (sentimentTrend === 'unknown') {
    score -= 5;
  }

  const healthScore = clampScore(score);
  const healthLevel = classifyHealth(healthScore);

  const signals: ClientHealthSignals = {
    lastInteractionDays,
    paymentStatus,
    projectCount,
    avgResponseTimeHours,
    sentimentTrend,
  };

  const riskFactors: string[] = [];

  if (lastInteractionDays !== null && lastInteractionDays >= 45) {
    riskFactors.push('Dormant for 45+ days');
  } else if (lastInteractionDays !== null && lastInteractionDays >= 21) {
    riskFactors.push('Engagement trending stale (21+ days since touch)');
  } else if (lastInteractionDays === null) {
    riskFactors.push('No tracked interactions - logging gap detected');
  }

  if (paymentStatus === 'late') {
    riskFactors.push('Outstanding payment flagged as late');
  }

  if (projectCount === 0) {
    riskFactors.push('No active projects or retainers detected');
  }

  if (avgResponseTimeHours !== null && avgResponseTimeHours > 48) {
    riskFactors.push('Slow response cadence (avg > 48h)');
  }

  if (sentimentTrend === 'negative') {
    riskFactors.push('Recent notes suggest negative sentiment');
  }

  if (!riskFactors.length) {
    riskFactors.push('Healthy engagement pattern maintained');
  }

  const recommendations = new Set<string>();

  if (lastInteractionDays === null || lastInteractionDays > 21) {
    recommendations.add('Schedule a proactive check-in this week');
  }

  if (paymentStatus === 'late') {
    recommendations.add('Coordinate with billing to resolve overdue balance');
  }

  if (projectCount === 0) {
    recommendations.add('Propose a quick-win project to maintain momentum');
  }

  if (avgResponseTimeHours !== null && avgResponseTimeHours > 36) {
    recommendations.add('Tighten follow-up cadence to stay top of mind');
  }

  if (sentimentTrend === 'negative') {
    recommendations.add('Address client concerns raised in recent interactions');
  }

  if (!recommendations.size) {
    recommendations.add('Keep regular cadence with a quarterly strategy review');
  }

  const lastInteractionDateValue = lastInteractionDate instanceof Date ? lastInteractionDate : null;
  const sentimentForStorage = sentimentTrend === 'unknown' ? null : sentimentTrend;

  const updateQuery = `
    UPDATE prospects
    SET health_score = $1,
        health_level = $2,
        last_interaction_date = $3,
        sentiment_trend = COALESCE($4, sentiment_trend),
        updated_at = NOW()
    WHERE id = $5 AND (user_id = $6 OR user_id IS NULL)
  `;

  await db.query(updateQuery, [healthScore, healthLevel, lastInteractionDateValue, sentimentForStorage, prospectId, userId]);

  const result: ClientHealthResult = {
    prospectId,
    prospectName: prospect.company_name,
    generatedAt: new Date().toISOString(),
    healthScore,
    healthLevel,
    signals,
    riskFactors,
    recommendations: Array.from(recommendations),
  };

  logger.info('Client health analysis complete', {
    prospectId,
    userId,
    healthScore,
    healthLevel,
    riskFactors: result.riskFactors.length,
  });

  return result;
}
