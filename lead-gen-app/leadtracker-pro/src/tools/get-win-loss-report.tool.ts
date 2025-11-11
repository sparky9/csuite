/**
 * Get Win/Loss Report Tool
 * Surface insights about closed deals over a given timeframe.
 */

import { z } from 'zod';
import { db } from '../db/client.js';
import { logger } from '../utils/logger.js';
import type {
  DealSnapshot,
  ProspectStatus,
  WinLossReport,
  WinLossStageEntry,
  SourceBreakdownEntry,
} from '../types/leadtracker.types.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const GetWinLossSchema = z
  .object({
    timeframe: z
      .enum(['30d', '60d', '90d', 'quarter', 'year', 'all'])
      .optional(),
  })
  .optional();

function resolveTimeframe(code: string | undefined): { label: string; startDate: Date | null } {
  const now = new Date();

  switch (code) {
    case '30d':
      return { label: 'Last 30 days', startDate: new Date(now.getTime() - 30 * DAY_MS) };
    case '60d':
      return { label: 'Last 60 days', startDate: new Date(now.getTime() - 60 * DAY_MS) };
    case 'quarter': {
      const quarterIndex = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), quarterIndex * 3, 1);
      return { label: 'Current quarter to date', startDate: start };
    }
    case 'year':
      return { label: 'Year to date', startDate: new Date(now.getFullYear(), 0, 1) };
    case 'all':
      return { label: 'All time', startDate: null };
    case '90d':
    default:
      return { label: 'Last 90 days', startDate: new Date(now.getTime() - 90 * DAY_MS) };
  }
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function sum(values: Array<number | null | undefined>): number {
  let total = 0;
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      total += value;
    }
  }
  return total;
}

function average(values: Array<number | null | undefined>): number | null {
  const filtered = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (!filtered.length) {
    return null;
  }
  const total = filtered.reduce((acc, value) => acc + value, 0);
  return total / filtered.length;
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

export async function getWinLossReportTool(args: any, _dbConnected?: boolean, userId?: string) {
  try {
    const input = GetWinLossSchema.parse(args || {});
    const { label, startDate } = resolveTimeframe(input?.timeframe);

    logger.info('Generating win/loss report', { timeframe: input?.timeframe ?? '90d', label, userId });

    const params: any[] = [];
    let paramIndex = 1;

    const conditions: string[] = [
      "ranked.to_status IN ('closed_won', 'closed_lost')",
      'ranked.rn_latest = 1',
      'ranked.to_status = p.status',
    ];

    if (userId) {
      conditions.push(`p.user_id = $${paramIndex++}`);
      params.push(userId);
    }

    if (startDate) {
      conditions.push(`ranked.created_at >= $${paramIndex++}`);
      params.push(startDate);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const query = `
      WITH status_events AS (
        SELECT
          a.prospect_id,
          a.created_at,
          (regexp_matches(a.notes, 'Status changed: ([a-z_]+) → ([a-z_]+)'))[1] AS from_status,
          (regexp_matches(a.notes, 'Status changed: ([a-z_]+) → ([a-z_]+)'))[2] AS to_status
        FROM activities a
        WHERE a.activity_type = 'note'
          AND a.subject = 'Status Change'
      ),
      ranked AS (
        SELECT
          se.prospect_id,
          se.created_at,
          se.from_status,
          se.to_status,
          ROW_NUMBER() OVER (PARTITION BY se.prospect_id ORDER BY se.created_at DESC) AS rn_latest
        FROM status_events se
      )
      SELECT
        p.id,
        p.company_name,
        p.deal_value,
        p.source,
        p.added_at,
        p.status,
        ranked.created_at AS closed_at,
        ranked.from_status
      FROM ranked
      JOIN prospects p ON p.id = ranked.prospect_id
      ${whereClause}
    `;

    const { rows } = await db.query<any>(query, params);

    if (!rows.length) {
      const emptyMessage = startDate
        ? `No closed deals found for ${label.toLowerCase()}.`
        : 'No closed deals recorded yet.';

      return {
        content: [
          {
            type: 'text',
            text: `ℹ️ ${emptyMessage}`,
          },
        ],
        data: {
          timeframe: label,
          rangeStart: startDate ? startDate.toISOString() : null,
          generatedAt: new Date().toISOString(),
          totals: {
            wins: 0,
            losses: 0,
            winRate: 0,
            totalValueWon: 0,
            totalValueLost: 0,
            avgDealValueWon: 0,
            avgDealValueLost: 0,
            avgTimeToCloseWon: null,
            avgTimeToCloseLost: null,
          },
          winsBySource: [],
          lossesBySource: [],
          stagesBeforeClosing: { wins: [], losses: [] },
          topDealsWon: [],
          topDealsLost: [],
          insights: [],
        } satisfies WinLossReport,
      };
    }

    const enrichRows = rows.map((row: any) => {
      const dealValue = toNumber(row.deal_value);
      const closedAt = row.closed_at ? new Date(row.closed_at) : null;
      const addedAt = row.added_at ? new Date(row.added_at) : null;
      const timeToCloseDays = closedAt && addedAt ? Math.round((closedAt.getTime() - addedAt.getTime()) / DAY_MS) : null;

      return {
        ...row,
        deal_value_number: dealValue,
        closed_at_date: closedAt,
        time_to_close_days: timeToCloseDays,
        from_status: row.from_status as ProspectStatus | null,
      };
    });

    const wins = enrichRows.filter((row) => row.status === 'closed_won');
    const losses = enrichRows.filter((row) => row.status === 'closed_lost');

    const winDealValues = wins.map((row) => row.deal_value_number);
    const lossDealValues = losses.map((row) => row.deal_value_number);

    const totalValueWon = sum(winDealValues);
    const totalValueLost = sum(lossDealValues);

    const avgDealValueWon = average(winDealValues) ?? 0;
    const avgDealValueLost = average(lossDealValues) ?? 0;

    const avgTimeToCloseWon = average(wins.map((row) => row.time_to_close_days));
    const avgTimeToCloseLost = average(losses.map((row) => row.time_to_close_days));

    const winsCount = wins.length;
    const lossesCount = losses.length;
    const totalClosed = winsCount + lossesCount;
    const winRate = totalClosed ? (winsCount / totalClosed) * 100 : 0;

    function groupBySource(data: typeof enrichRows): SourceBreakdownEntry[] {
      const map = new Map<string, { count: number; total: number; values: number[] }>();

      data.forEach((row) => {
        const source = row.source || 'Unknown';
        const existing = map.get(source) ?? { count: 0, total: 0, values: [] };
        const value = row.deal_value_number ?? 0;
        existing.count += 1;
        existing.total += value;
        existing.values.push(row.deal_value_number ?? 0);
        map.set(source, existing);
      });

      return Array.from(map.entries())
        .map(([source, stats]) => ({
          source,
          count: stats.count,
          totalValue: stats.total,
          avgValue: stats.values.length ? stats.total / stats.values.length : 0,
        }))
        .sort((a, b) => b.count - a.count || b.totalValue - a.totalValue)
        .slice(0, 5);
    }

    function summarizeStages(data: typeof enrichRows): WinLossStageEntry[] {
      const map = new Map<string, number>();

      data.forEach((row) => {
        const status = row.from_status ?? 'unknown';
        map.set(status, (map.get(status) ?? 0) + 1);
      });

      return Array.from(map.entries())
        .map(([status, count]) => ({ status: status as ProspectStatus | 'unknown', count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    }

    function buildTopDeals(data: typeof enrichRows): DealSnapshot[] {
      return data
        .filter((row) => (row.deal_value_number ?? 0) > 0)
        .sort((a, b) => (b.deal_value_number ?? 0) - (a.deal_value_number ?? 0))
        .slice(0, 5)
        .map((row) => ({
          prospectId: row.id,
          companyName: row.company_name,
          dealValue: row.deal_value_number,
          source: row.source ?? null,
          stageBeforeClose: (row.from_status as ProspectStatus | null) ?? 'unknown',
          closedAt: row.closed_at_date ? row.closed_at_date.toISOString() : new Date().toISOString(),
          timeToCloseDays: row.time_to_close_days,
        }));
    }

    const winsBySource = groupBySource(wins);
    const lossesBySource = groupBySource(losses);
    const stagesBeforeWins = summarizeStages(wins);
    const stagesBeforeLosses = summarizeStages(losses);
    const topDealsWon = buildTopDeals(wins);
    const topDealsLost = buildTopDeals(losses);

    const insights: string[] = [];
    insights.push(`Win rate ${winRate.toFixed(1)}% across ${totalClosed} closed deals.`);

    if (avgTimeToCloseWon !== null) {
      insights.push(`Avg time to close (wins): ${Math.round(avgTimeToCloseWon)} days.`);
    }
    if (avgTimeToCloseLost !== null) {
      insights.push(`Avg time to close (losses): ${Math.round(avgTimeToCloseLost)} days.`);
    }

    if (stagesBeforeLosses.length) {
      const worstStage = stagesBeforeLosses[0];
      insights.push(`Most losses occur right after ${worstStage.status.replace('_', ' ')}.`);
    }

    if (winsBySource.length) {
      const bestSource = winsBySource[0];
      insights.push(`Top win source: ${bestSource.source} (${bestSource.count} wins).`);
    }

    if (!lossesCount) {
      insights.push('No recorded losses in this timeframe. Keep the streak going.');
    }

    const report: WinLossReport = {
      timeframe: label,
      rangeStart: startDate ? startDate.toISOString() : null,
      generatedAt: new Date().toISOString(),
      totals: {
        wins: winsCount,
        losses: lossesCount,
        winRate,
        totalValueWon,
        totalValueLost,
        avgDealValueWon,
        avgDealValueLost,
        avgTimeToCloseWon,
        avgTimeToCloseLost,
      },
      winsBySource,
      lossesBySource,
      stagesBeforeClosing: {
        wins: stagesBeforeWins,
        losses: stagesBeforeLosses,
      },
      topDealsWon,
      topDealsLost,
      insights,
    };

    const currencyWon = formatCurrency(totalValueWon);
    const currencyLost = formatCurrency(totalValueLost);

  let text = `📈 **Win/Loss Analysis - ${label}**\n\n`;
    text += `Wins: ${winsCount} | Losses: ${lossesCount} | Win rate: ${winRate.toFixed(1)}%\n`;
    if (currencyWon) {
      text += `Revenue won: ${currencyWon}`;
    }
    if (currencyLost) {
      text += `${currencyWon ? ' | ' : ''}Revenue lost: ${currencyLost}`;
    }
    text += '\n';

    if (avgTimeToCloseWon !== null) {
      text += `Avg close time (wins): ${Math.round(avgTimeToCloseWon)} days\n`;
    }
    if (avgTimeToCloseLost !== null) {
      text += `Avg close time (losses): ${Math.round(avgTimeToCloseLost)} days\n`;
    }

    if (winsBySource.length) {
      text += '\nTop win sources:\n';
      winsBySource.forEach((entry) => {
        const valueText = formatCurrency(entry.totalValue);
        text += `- ${entry.source}: ${entry.count} wins${valueText ? ` (${valueText})` : ''}\n`;
      });
    }

    if (stagesBeforeLosses.length) {
      text += '\nWhere deals are slipping:\n';
      stagesBeforeLosses.forEach((entry) => {
        text += `- After ${entry.status.replace('_', ' ')} (${entry.count} losses)\n`;
      });
    }

    if (insights.length) {
      text += '\nInsights:\n';
      insights.forEach((line) => {
        text += `- ${line}\n`;
      });
    }

    return {
      content: [
        {
          type: 'text',
          text,
        },
      ],
      data: report,
    };
  } catch (error) {
    logger.error('Failed to generate win/loss report', { error, args, userId });

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
          text: `❌ Error generating win/loss report: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
