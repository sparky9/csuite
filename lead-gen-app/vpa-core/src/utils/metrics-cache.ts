/**
 * Metrics Dashboard Cache
 *
 * Simple in-memory cache for metrics dashboard with 5-minute TTL.
 * Uses the same pattern as voice context cache.
 */

import { logger } from './logger.js';
import type { MetricsDashboard, MetricsTimeframe, MetricsCacheEntry } from '../types/metrics.js';

/**
 * Cache TTL in milliseconds (5 minutes)
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Cache storage: Map<cacheKey, MetricsCacheEntry>
 * Cache key format: `metrics:${userId}:${timeframe}`
 */
const cache = new Map<string, MetricsCacheEntry>();

/**
 * Generate cache key
 */
function getCacheKey(userId: string, timeframe: MetricsTimeframe): string {
  return `metrics:${userId}:${timeframe}`;
}

/**
 * Set metrics in cache
 */
export function setMetricsCache(
  userId: string,
  timeframe: MetricsTimeframe,
  data: MetricsDashboard
): void {
  const key = getCacheKey(userId, timeframe);
  const expiresAt = Date.now() + CACHE_TTL_MS;

  cache.set(key, { data, expiresAt });

  logger.debug('Metrics cached', {
    userId,
    timeframe,
    expiresAt: new Date(expiresAt).toISOString(),
    ttlMs: CACHE_TTL_MS
  });
}

/**
 * Get metrics from cache (returns undefined if expired or not found)
 */
export function getMetricsCache(
  userId: string,
  timeframe: MetricsTimeframe
): MetricsDashboard | undefined {
  const key = getCacheKey(userId, timeframe);
  const entry = cache.get(key);

  if (!entry) {
    logger.debug('Metrics cache miss', { userId, timeframe });
    return undefined;
  }

  // Check if expired
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    logger.debug('Metrics cache expired', { userId, timeframe });
    return undefined;
  }

  logger.debug('Metrics cache hit', { userId, timeframe });
  return entry.data;
}

/**
 * Clear cache for specific user and timeframe
 */
export function clearMetricsCache(userId: string, timeframe?: MetricsTimeframe): void {
  if (timeframe) {
    const key = getCacheKey(userId, timeframe);
    cache.delete(key);
    logger.debug('Metrics cache cleared', { userId, timeframe });
  } else {
    // Clear all timeframes for this user
    const timeframes: MetricsTimeframe[] = ['7d', '30d', '90d', '1y'];
    timeframes.forEach(tf => {
      const key = getCacheKey(userId, tf);
      cache.delete(key);
    });
    logger.debug('All metrics caches cleared for user', { userId });
  }
}

/**
 * Cleanup expired cache entries (can be called periodically)
 */
export function cleanupExpiredMetricsCache(): void {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    logger.debug('Metrics cache auto-cleaned', { cleanedCount });
  }
}

/**
 * Get cache statistics (for monitoring)
 */
export function getMetricsCacheStats(): {
  totalEntries: number;
  expiredEntries: number;
} {
  const now = Date.now();
  let expiredCount = 0;

  for (const entry of cache.values()) {
    if (entry.expiresAt <= now) {
      expiredCount++;
    }
  }

  return {
    totalEntries: cache.size,
    expiredEntries: expiredCount
  };
}
