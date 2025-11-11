import { db } from '../db/client.js';
import { logger } from '../utils/logger.js';

interface FrequencyConfig {
  intervalMs: number;
  description: string;
}

const FREQUENCY_MAP: Record<string, FrequencyConfig> = {
  'hourly': { intervalMs: 60 * 60 * 1000, description: 'Every hour' },
  'every-4-hours': { intervalMs: 4 * 60 * 60 * 1000, description: 'Every 4 hours' },
  'twice-daily': { intervalMs: 12 * 60 * 60 * 1000, description: 'Twice per day' },
  'daily': { intervalMs: 24 * 60 * 60 * 1000, description: 'Once per day' },
  'weekly': { intervalMs: 7 * 24 * 60 * 60 * 1000, description: 'Once per week' },
  'manual': { intervalMs: Infinity, description: 'Manual only' }
};

export interface SourceDueForCheck {
  userId: string;
  sourceId: string;
  label: string;
  url: string;
  frequency: string;
  lastChecked: Date | null;
  overdueBy: number;
}

export async function getSourcesDueForCheck(): Promise<SourceDueForCheck[]> {
  try {
    const query = `
      SELECT
        user_id,
        source_id,
        label,
        url,
        frequency,
        last_checked
      FROM research_sources
      WHERE frequency IS NOT NULL
        AND frequency != 'manual'
      ORDER BY last_checked ASC NULLS FIRST
    `;

    const result = await db.query(query);
    const now = Date.now();
    const dueList: SourceDueForCheck[] = [];

    for (const row of result.rows) {
      const frequencyConfig = FREQUENCY_MAP[row.frequency];
      if (!frequencyConfig) {
        logger.warn('Unknown frequency setting', {
          sourceId: row.source_id,
          frequency: row.frequency
        });
        continue;
      }

      if (!row.last_checked) {
        dueList.push({
          userId: row.user_id,
          sourceId: row.source_id,
          label: row.label,
          url: row.url,
          frequency: row.frequency,
          lastChecked: null,
          overdueBy: Infinity
        });
        continue;
      }

      const lastCheckedMs = new Date(row.last_checked).getTime();
      const nextCheckDue = lastCheckedMs + frequencyConfig.intervalMs;
      const overdueBy = now - nextCheckDue;

      if (overdueBy > 0) {
        dueList.push({
          userId: row.user_id,
          sourceId: row.source_id,
          label: row.label,
          url: row.url,
          frequency: row.frequency,
          lastChecked: new Date(row.last_checked),
          overdueBy
        });
      }
    }

    return dueList;
  } catch (error) {
    logger.error('Failed to get sources due for check', { error });
    return [];
  }
}

export function getFrequencyInterval(frequency: string): number {
  return FREQUENCY_MAP[frequency]?.intervalMs ?? Infinity;
}

export function getFrequencyDescription(frequency: string): string {
  return FREQUENCY_MAP[frequency]?.description ?? 'Unknown frequency';
}

export function getValidFrequencies(): Array<{ key: string; description: string }> {
  return Object.entries(FREQUENCY_MAP).map(([key, config]) => ({
    key,
    description: config.description
  }));
}

export function isValidFrequency(frequency: string): boolean {
  return frequency in FREQUENCY_MAP;
}
