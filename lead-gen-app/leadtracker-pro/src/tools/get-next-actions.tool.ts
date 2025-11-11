/**
 * Get Next Actions Tool
 * Identify the highest-impact follow-ups across the active pipeline.
 */

import { z } from 'zod';
import { db } from '../db/client.js';
import { logger } from '../utils/logger.js';
import {
  getStageWeights,
  getDealThresholds,
  classifyPriority as classifyPriorityConfig,
} from '../services/config-manager.js';
import type {
  NextActionRecommendation,
  NextActionsResult,
  ProspectStatus,
  ReminderType,
} from '../types/leadtracker.types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const GetNextActionsSchema = z
  .object({
    limit: z.number().int().min(1).max(20).optional(),
  })
  .optional();

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function humanizeDays(value: number): string {
  if (value === 0) return 'today';
  if (value === 1) return 'in 1 day';
  if (value === -1) return '1 day ago';
  if (value > 0) return `in ${value} days`;
  return `${Math.abs(value)} days ago`;
}

function formatCurrency(value: number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function buildSuggestedAction(
  reminderType: ReminderType | null | undefined,
  overdueDays: number | null,
  dueInDays: number | null,
  status: ProspectStatus,
  daysSinceContact: number | null,
): string {
  if (overdueDays !== null && overdueDays > 0) {
    return `Reach out now - ${reminderType ?? 'follow-up'} is ${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue.`;
  }

  if (dueInDays !== null && dueInDays <= 1) {
    const when = dueInDays <= 0 ? 'today' : 'tomorrow';
    return `Prep the ${reminderType ?? 'follow-up'} due ${when} and confirm next steps.`;
  }

  if (daysSinceContact !== null && daysSinceContact >= 14) {
    return `Re-engage after ${daysSinceContact} days of silence and ask for an update.`;
  }

  if (status === 'proposal_sent') {
    return 'Nudge them on the proposal and confirm decision timing.';
  }

  if (status === 'negotiating') {
    return 'Check in on negotiation blockers and lock a decision date.';
  }

  return 'Check in and log the outcome to keep the pipeline fresh.';
}

export async function getNextActionsTool(args: any, _dbConnected?: boolean, userId?: string) {
  try {
    const input = GetNextActionsSchema.parse(args || {});
    const limit = input?.limit ?? 5;
    const candidateLimit = Math.max(limit * 3, limit + 5);

    logger.info('Computing next-action recommendations', { limit, candidateLimit, userId });

    // Load configuration
    const stageWeights = await getStageWeights();
    const dealThresholds = await getDealThresholds();

    const params: any[] = [];
    let clause = "p.status NOT IN ('closed_won', 'closed_lost', 'on_hold')";
    let limitIndex = 1;

    if (userId) {
      clause = `p.user_id = $${limitIndex++} AND ` + clause;
      params.push(userId);
    }

    params.push(candidateLimit);

    const query = `
      SELECT
        p.id,
        p.company_name,
        p.status,
        p.deal_value,
        p.source,
        p.tags,
        p.last_contacted_at,
        p.next_follow_up,
        p.added_at,
        follow_next.due_date AS follow_up_due_date,
        follow_next.reminder_type AS follow_up_type,
        follow_next.reminder_note AS follow_up_note,
        follow_next.days_until_due AS follow_up_days_until_due,
        follow_next.days_overdue AS follow_up_days_overdue,
        activity_stats.activity_count,
        activity_stats.last_activity_date
      FROM prospects p
      LEFT JOIN LATERAL (
        SELECT
          f.due_date,
          f.reminder_type,
          f.reminder_note,
          GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (f.due_date - NOW())) / 86400)) AS days_until_due,
          GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - f.due_date)) / 86400)) AS days_overdue
        FROM follow_ups f
        WHERE f.prospect_id = p.id
          AND f.completed = FALSE
        ORDER BY f.due_date ASC
        LIMIT 1
      ) AS follow_next ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) AS activity_count,
          MAX(activity_date) AS last_activity_date
        FROM activities a
        WHERE a.prospect_id = p.id
      ) AS activity_stats ON TRUE
      WHERE ${clause}
      ORDER BY
        COALESCE(follow_next.days_overdue, 0) DESC,
        follow_next.due_date ASC NULLS LAST,
        p.deal_value DESC NULLS LAST
      LIMIT $${limitIndex}
    `;

    const { rows } = await db.query<any>(query, params);

    if (!rows.length) {
      logger.info('No active prospects available for recommendation', { userId });

      return {
        content: [
          {
            type: 'text',
            text: '🙌 No open deals need attention right now. All follow-ups are on schedule.',
          },
        ],
        data: {
          generatedAt: new Date().toISOString(),
          totalCandidates: 0,
          recommendations: [],
        } satisfies NextActionsResult,
      };
    }

    const now = Date.now();

    const recommendations = await Promise.all(
      rows.map(async (row: any) => {
        const dealValue = toNumber(row.deal_value);
        const overdueDays = toNumber(row.follow_up_days_overdue);
        const dueInDaysRaw = toNumber(row.follow_up_days_until_due);
        const dueInDays = dueInDaysRaw !== null ? dueInDaysRaw : null;

        const lastContactDate: Date | null = row.last_contacted_at ? new Date(row.last_contacted_at) : null;
        const addedAt: Date | null = row.added_at ? new Date(row.added_at) : null;
        const referenceForContact = lastContactDate ?? addedAt;
        const daysSinceContact = referenceForContact
          ? Math.floor((now - referenceForContact.getTime()) / DAY_MS)
          : null;

        const stageWeight = stageWeights[row.status as ProspectStatus] ?? 0;
        const dealWeightEntry = dealThresholds.find((entry) => dealValue !== null && dealValue >= entry.threshold);
        const dealWeight = dealWeightEntry ? dealWeightEntry.weight : 0;

        let score = stageWeight + dealWeight;

        if (overdueDays !== null && overdueDays > 0) {
          score += 120 + Math.min(80, overdueDays * 6);
        } else if (dueInDays !== null && dueInDays <= 1) {
          score += 70 - dueInDays * 5;
        } else if (dueInDays !== null && dueInDays <= 3) {
          score += 40 - dueInDays * 4;
        }

        if (daysSinceContact === null) {
          score += 38;
        } else if (daysSinceContact >= 21) {
          score += 34;
        } else if (daysSinceContact >= 14) {
          score += 28;
        } else if (daysSinceContact >= 7) {
          score += 20;
        } else if (daysSinceContact >= 4) {
          score += 10;
        }

        if ((row.activity_count ?? 0) <= 1 && row.status !== 'new') {
          score += 12;
        }

        const priorityLabel = await classifyPriorityConfig(score);

        const reasons: string[] = [];

        if (overdueDays !== null && overdueDays > 0) {
          reasons.push(`Follow-up is ${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue`);
        } else if (dueInDays !== null && dueInDays <= 1) {
          reasons.push(`Follow-up due ${humanizeDays(dueInDays)}`);
        } else if (dueInDays !== null && dueInDays <= 3) {
          reasons.push(`Upcoming follow-up ${humanizeDays(dueInDays)}`);
        }

        if (daysSinceContact !== null && daysSinceContact >= 14) {
          reasons.push(`No contact in ${daysSinceContact} days`);
        } else if (daysSinceContact !== null && daysSinceContact >= 7) {
          reasons.push(`Last touch ${daysSinceContact} days ago`);
        }

        if (dealValue && dealValue >= 10000) {
          const formatted = formatCurrency(dealValue);
          if (formatted) {
            reasons.push(`${formatted} opportunity`);
          }
        }

        if (row.status === 'negotiating' || row.status === 'proposal_sent') {
          reasons.push(`Stage: ${row.status.replace('_', ' ')}`);
        }

        const suggestedAction = buildSuggestedAction(
          (row.follow_up_type as ReminderType | null) ?? null,
          overdueDays,
          dueInDays,
          row.status as ProspectStatus,
          daysSinceContact,
        );

        const recommendation: NextActionRecommendation = {
          prospectId: row.id,
          companyName: row.company_name,
          status: row.status as ProspectStatus,
          score,
          priorityLabel,
          reasons,
          suggestedAction,
          dealValue,
          source: row.source ?? null,
          nextFollowUp: row.follow_up_due_date ? new Date(row.follow_up_due_date).toISOString() : null,
          reminderType: (row.follow_up_type as ReminderType | null) ?? null,
          daysOverdue: overdueDays,
          daysUntilDue: dueInDays,
          daysSinceContact,
          lastActivityAt: row.last_activity_date ? new Date(row.last_activity_date).toISOString() : null,
        };

        return recommendation;
      })
    );

    const sortedRecommendations = recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const payload: NextActionsResult = {
      generatedAt: new Date().toISOString(),
      totalCandidates: rows.length,
      recommendations: sortedRecommendations,
    };

    const formatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

    let text = `🔥 **Next Best Actions (${sortedRecommendations.length})**\n\n`;
    text += `Scored ${rows.length} active deals and ranked the top ${sortedRecommendations.length} follow-ups.\n\n`;

    sortedRecommendations.forEach((rec, index) => {
      const lineNumber = index + 1;
      const dealValueText = formatCurrency(rec.dealValue ?? null);
      const followUpText = rec.nextFollowUp
        ? `Next follow-up: ${new Date(rec.nextFollowUp).toLocaleString()}`
        : 'No follow-up scheduled';
  const reasonsText = rec.reasons.length ? rec.reasons.join(' | ') : 'Balanced opportunity';

  text += `${lineNumber}. **${rec.companyName}** - ${rec.status.replace('_', ' ')} (score ${formatter.format(rec.score)})\n`;
      text += `   ${reasonsText}\n`;
      text += `   ${rec.suggestedAction}\n`;
      text += `   ${followUpText}`;
      if (dealValueText) {
        text += ` | Deal value: ${dealValueText}`;
      }
      if (rec.source) {
        text += ` | Source: ${rec.source}`;
      }
      text += '\n\n';
    });

    text += 'Need a different lens? Filter your pipeline and rerun for a specific territory, source, or tag.';

    return {
      content: [
        {
          type: 'text',
          text,
        },
      ],
      data: payload,
    };
  } catch (error) {
    logger.error('Failed to compute next-action recommendations', { error, args, userId });

    if (error instanceof z.ZodError) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Validation error: ${error.errors
              .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
              .join(', ')}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `❌ Error generating next actions: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
