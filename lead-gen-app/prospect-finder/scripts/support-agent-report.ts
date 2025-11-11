/**
 * Summarize support agent telemetry log for quick feedback loops.
 */

import fs from 'node:fs/promises';
import { SUPPORT_AGENT_EVENT_LOG, type SupportAgentEvent } from 'support-agent';
import { logger } from '../src/utils/logger.js';

interface Summary {
  total: number;
  byOutcome: Record<string, number>;
  autoEscalated: number;
  averageTopScore: number;
  recent: number;
}

async function loadEvents(): Promise<SupportAgentEvent[]> {
  try {
    const data = await fs.readFile(SUPPORT_AGENT_EVENT_LOG, 'utf8');
    return data
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as SupportAgentEvent);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      logger.warn('Support agent telemetry log not found', { path: SUPPORT_AGENT_EVENT_LOG });
      return [];
    }
    throw error;
  }
}

function buildSummary(events: SupportAgentEvent[]): Summary {
  const byOutcome: Record<string, number> = {};
  let autoEscalated = 0;
  let scoreAccumulator = 0;

  events.forEach((event) => {
    byOutcome[event.outcome] = (byOutcome[event.outcome] ?? 0) + 1;
    if (event.autoEscalated) {
      autoEscalated += 1;
    }
    scoreAccumulator += Number(event.topScore ?? 0);
  });

  const total = events.length;
  const averageTopScore = total > 0 ? scoreAccumulator / total : 0;

  // Recent = last 10 events
  const recent = Math.min(10, total);

  return {
    total,
    byOutcome,
    autoEscalated,
    averageTopScore,
    recent,
  };
}

function formatSummary(events: SupportAgentEvent[], summary: Summary): string {
  const lines: string[] = [];
  lines.push('Support Agent Telemetry Report');
  lines.push('');
  lines.push(`Event Log: ${SUPPORT_AGENT_EVENT_LOG}`);
  lines.push(`Total Events: ${summary.total}`);
  lines.push(`Average Top Score: ${(summary.averageTopScore * 100).toFixed(1)}%`);
  lines.push(`Auto Escalations: ${summary.autoEscalated}`);
  lines.push('');
  lines.push('Outcomes:');
  Object.entries(summary.byOutcome).forEach(([outcome, count]) => {
    lines.push(`- ${outcome}: ${count}`);
  });

  if (summary.total > 0) {
    lines.push('');
    lines.push('Most Recent Events:');
    const recentEvents = events.slice(-summary.recent);
    recentEvents.forEach((event) => {
      lines.push(
        `- ${event.timestamp} | ${event.ticketId} | ${event.outcome} | topScore ${(Number(event.topScore) * 100).toFixed(1)}%`
      );
      if (event.escalationReason) {
        lines.push(`  escalation: ${event.escalationReason}`);
      }
    });
  }

  return lines.join('\n');
}

async function main() {
  const events = await loadEvents();
  if (events.length === 0) {
    console.log('No support agent events recorded yet. Run a ticket through the agent first.');
    return;
  }

  const summary = buildSummary(events);
  const report = formatSummary(events, summary);
  console.log(report);
}

main().catch((error) => {
  logger.error('Support agent report failed', { error });
  console.error('Support agent report failed:', error);
  process.exit(1);
});
