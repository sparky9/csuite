/**
 * Configuration Manager Service
 * Manages tunable configuration values stored in leadtracker_config table
 */

import { db } from '../db/client.js';
import { logger } from '../utils/logger.js';
import type { ProspectStatus } from '../types/leadtracker.types.js';

/**
 * Stage weights for next-action scoring
 */
export interface StageWeights {
  new: number;
  contacted: number;
  qualified: number;
  meeting_scheduled: number;
  proposal_sent: number;
  negotiating: number;
  closed_won: number;
  closed_lost: number;
  on_hold: number;
}

/**
 * Deal value threshold and weight
 */
export interface DealThreshold {
  threshold: number;
  weight: number;
}

/**
 * Priority classification thresholds
 */
export interface PriorityThresholds {
  urgent: number;
  high: number;
}

/**
 * Default configuration values
 */
const DEFAULT_STAGE_WEIGHTS: StageWeights = {
  new: 6,
  contacted: 12,
  qualified: 18,
  meeting_scheduled: 26,
  proposal_sent: 32,
  negotiating: 38,
  closed_won: 0,
  closed_lost: 0,
  on_hold: 0,
};

const DEFAULT_DEAL_THRESHOLDS: DealThreshold[] = [
  { threshold: 25000, weight: 24 },
  { threshold: 15000, weight: 20 },
  { threshold: 10000, weight: 16 },
  { threshold: 5000, weight: 12 },
  { threshold: 2000, weight: 8 },
  { threshold: 0, weight: 4 },
];

const DEFAULT_PRIORITY_THRESHOLDS: PriorityThresholds = {
  urgent: 160,
  high: 120,
};

/**
 * Configuration cache to avoid repeated database queries
 */
class ConfigCache {
  private cache: Map<string, { value: any; timestamp: number }> = new Map();
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutes

  get<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.TTL_MS) {
      this.cache.delete(key);
      return null;
    }

    return cached.value as T;
  }

  set<T>(key: string, value: T): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

const configCache = new ConfigCache();

/**
 * Get configuration value from database
 */
async function getConfigValue<T>(key: string, defaultValue: T): Promise<T> {
  try {
    // Check cache first
    const cached = configCache.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Query database
    const result = await db.queryOne<{ value: string }>(
      'SELECT value FROM leadtracker_config WHERE key = $1',
      [key]
    );

    if (!result) {
      logger.debug(`Config key not found, using default: ${key}`);
      configCache.set(key, defaultValue);
      return defaultValue;
    }

    // Parse JSON if needed
    let parsedValue: T;
    try {
      parsedValue = JSON.parse(result.value) as T;
    } catch {
      // If not JSON, return as-is
      parsedValue = result.value as unknown as T;
    }

    configCache.set(key, parsedValue);
    return parsedValue;
  } catch (error) {
    logger.error('Failed to get config value', { key, error });
    return defaultValue;
  }
}

/**
 * Set configuration value in database
 */
export async function setConfigValue(
  key: string,
  value: any,
  description?: string
): Promise<void> {
  try {
    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);

    await db.query(
      `INSERT INTO leadtracker_config (key, value, description, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key) DO UPDATE
       SET value = $2, description = COALESCE($3, leadtracker_config.description), updated_at = NOW()`,
      [key, valueStr, description || null]
    );

    // Clear cache for this key
    configCache.clear();

    logger.info('Config value updated', { key });
  } catch (error) {
    logger.error('Failed to set config value', { key, error });
    throw new Error(`Failed to update configuration: ${error}`);
  }
}

/**
 * Get stage weights for scoring
 */
export async function getStageWeights(): Promise<StageWeights> {
  return await getConfigValue<StageWeights>(
    'scoring_stage_weights',
    DEFAULT_STAGE_WEIGHTS
  );
}

/**
 * Get deal value thresholds for scoring
 */
export async function getDealThresholds(): Promise<DealThreshold[]> {
  return await getConfigValue<DealThreshold[]>(
    'scoring_deal_thresholds',
    DEFAULT_DEAL_THRESHOLDS
  );
}

/**
 * Get priority classification thresholds
 */
export async function getPriorityThresholds(): Promise<PriorityThresholds> {
  return await getConfigValue<PriorityThresholds>(
    'scoring_priority_thresholds',
    DEFAULT_PRIORITY_THRESHOLDS
  );
}

/**
 * Get activity retention months
 */
export async function getActivityRetentionMonths(): Promise<number> {
  const value = await getConfigValue<string | number>('activity_retention_months', '12');
  return typeof value === 'number' ? value : parseInt(value, 10);
}

/**
 * Get stage weight for specific status
 */
export async function getStageWeight(status: ProspectStatus): Promise<number> {
  const weights = await getStageWeights();
  return weights[status] ?? 0;
}

/**
 * Get deal weight for specific deal value
 */
export async function getDealWeight(dealValue: number | null): Promise<number> {
  if (dealValue === null || dealValue === undefined) {
    return 0;
  }

  const thresholds = await getDealThresholds();
  const entry = thresholds.find((t) => dealValue >= t.threshold);
  return entry ? entry.weight : 0;
}

/**
 * Classify priority based on score
 */
export async function classifyPriority(
  score: number
): Promise<'urgent' | 'high' | 'normal'> {
  const thresholds = await getPriorityThresholds();

  if (score >= thresholds.urgent) return 'urgent';
  if (score >= thresholds.high) return 'high';
  return 'normal';
}

/**
 * Get all configuration values
 */
export async function getAllConfig(): Promise<
  Array<{ key: string; value: string; description: string | null }>
> {
  try {
    const result = await db.query<{
      key: string;
      value: string;
      description: string | null;
    }>('SELECT key, value, description FROM leadtracker_config ORDER BY key');

    return result.rows;
  } catch (error) {
    logger.error('Failed to get all config', { error });
    throw new Error(`Failed to retrieve configuration: ${error}`);
  }
}

/**
 * Clear configuration cache (useful after bulk updates)
 */
export function clearConfigCache(): void {
  configCache.clear();
  logger.info('Configuration cache cleared');
}
