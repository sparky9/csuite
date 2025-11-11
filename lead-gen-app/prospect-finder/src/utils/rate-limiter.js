/**
 * Rate Limiter
 *
 * Per-source rate limiting using token bucket algorithm.
 * Reads limits from config/scraper-limits.json and enforces per-minute, per-hour, per-day limits.
 */
import fs from 'fs/promises';
import { logger } from './logger.js';
export class RateLimiter {
    config = null;
    buckets = new Map();
    configPath;
    constructor(configPath = './config/scraper-limits.json') {
        this.configPath = configPath;
    }
    /**
     * Load rate limit configuration from JSON file
     */
    async initialize() {
        try {
            const configData = await fs.readFile(this.configPath, 'utf-8');
            this.config = JSON.parse(configData);
            logger.info('Rate limiter initialized', {
                sources: Object.keys(this.config).filter((k) => k !== 'global'),
            });
        }
        catch (error) {
            logger.error('Failed to load rate limit configuration', {
                error,
                path: this.configPath,
            });
            throw new Error('Rate limiter configuration required');
        }
    }
    /**
     * Check if request is allowed for a given source
     */
    async checkLimit(source) {
        if (!this.config) {
            throw new Error('Rate limiter not initialized');
        }
        const rules = this.config[source];
        if (!rules) {
            logger.warn('No rate limit rules found for source', { source });
            return { allowed: true };
        }
        const bucket = this.getBucket(source);
        const now = new Date();
        // Check per-minute limit
        const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
        const requestsLastMinute = bucket.requestTimes.filter((time) => time > oneMinuteAgo).length;
        if (requestsLastMinute >= rules.requests_per_minute) {
            const oldestRecentRequest = bucket.requestTimes.find((t) => t > oneMinuteAgo);
            const retryAfterMs = oldestRecentRequest
                ? 60000 - (now.getTime() - oldestRecentRequest.getTime())
                : 60000;
            logger.warn('Rate limit hit: per-minute', {
                source,
                limit: rules.requests_per_minute,
                current: requestsLastMinute,
                retry_after_ms: retryAfterMs,
            });
            return {
                allowed: false,
                reason: `Rate limit: ${requestsLastMinute}/${rules.requests_per_minute} requests per minute`,
                retryAfterMs,
            };
        }
        // Check per-hour limit
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const requestsLastHour = bucket.requestTimes.filter((time) => time > oneHourAgo).length;
        if (requestsLastHour >= rules.requests_per_hour) {
            const oldestRecentRequest = bucket.requestTimes.find((t) => t > oneHourAgo);
            const retryAfterMs = oldestRecentRequest
                ? 3600000 - (now.getTime() - oldestRecentRequest.getTime())
                : 3600000;
            logger.warn('Rate limit hit: per-hour', {
                source,
                limit: rules.requests_per_hour,
                current: requestsLastHour,
                retry_after_ms: retryAfterMs,
            });
            return {
                allowed: false,
                reason: `Rate limit: ${requestsLastHour}/${rules.requests_per_hour} requests per hour`,
                retryAfterMs,
            };
        }
        // Check per-day limit
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const requestsLastDay = bucket.requestTimes.filter((time) => time > oneDayAgo).length;
        if (requestsLastDay >= rules.requests_per_day) {
            const oldestRecentRequest = bucket.requestTimes.find((t) => t > oneDayAgo);
            const retryAfterMs = oldestRecentRequest
                ? 86400000 - (now.getTime() - oldestRecentRequest.getTime())
                : 86400000;
            logger.warn('Rate limit hit: per-day', {
                source,
                limit: rules.requests_per_day,
                current: requestsLastDay,
                retry_after_ms: retryAfterMs,
            });
            return {
                allowed: false,
                reason: `Rate limit: ${requestsLastDay}/${rules.requests_per_day} requests per day`,
                retryAfterMs,
            };
        }
        return { allowed: true };
    }
    /**
     * Record a request for a source (call after successful scrape)
     */
    recordRequest(source) {
        const bucket = this.getBucket(source);
        const now = new Date();
        bucket.requestTimes.push(now);
        bucket.lastRefill = now;
        // Clean up old request times (keep last 24 hours only)
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        bucket.requestTimes = bucket.requestTimes.filter((time) => time > oneDayAgo);
        logger.debug('Request recorded', {
            source,
            total_requests_24h: bucket.requestTimes.length,
        });
    }
    /**
     * Wait until rate limit allows request (with timeout)
     */
    async waitForLimit(source, maxWaitMs = 60000) {
        const startTime = Date.now();
        while (Date.now() - startTime < maxWaitMs) {
            const check = await this.checkLimit(source);
            if (check.allowed) {
                return;
            }
            // Wait for suggested retry time (or 1 second if not provided)
            const waitMs = Math.min(check.retryAfterMs || 1000, maxWaitMs - (Date.now() - startTime));
            if (waitMs > 0) {
                logger.debug('Waiting for rate limit', {
                    source,
                    wait_ms: waitMs,
                });
                await this.sleep(waitMs);
            }
        }
        throw new Error(`Rate limit timeout after ${maxWaitMs}ms for source: ${source}`);
    }
    /**
     * Get current usage statistics for a source
     */
    getUsageStats(source) {
        const bucket = this.getBucket(source);
        const rules = this.config?.[source];
        const now = new Date();
        const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const requestsLastMinute = bucket.requestTimes.filter((time) => time > oneMinuteAgo).length;
        const requestsLastHour = bucket.requestTimes.filter((time) => time > oneHourAgo).length;
        const requestsLastDay = bucket.requestTimes.filter((time) => time > oneDayAgo).length;
        return {
            source,
            per_minute: {
                used: requestsLastMinute,
                limit: rules?.requests_per_minute || 0,
                percentage: rules?.requests_per_minute
                    ? (requestsLastMinute / rules.requests_per_minute) * 100
                    : 0,
            },
            per_hour: {
                used: requestsLastHour,
                limit: rules?.requests_per_hour || 0,
                percentage: rules?.requests_per_hour
                    ? (requestsLastHour / rules.requests_per_hour) * 100
                    : 0,
            },
            per_day: {
                used: requestsLastDay,
                limit: rules?.requests_per_day || 0,
                percentage: rules?.requests_per_day ? (requestsLastDay / rules.requests_per_day) * 100 : 0,
            },
        };
    }
    /**
     * Reset rate limits for a source (for testing or manual override)
     */
    reset(source) {
        if (source) {
            this.buckets.delete(source);
            logger.info('Rate limit reset for source', { source });
        }
        else {
            this.buckets.clear();
            logger.info('All rate limits reset');
        }
    }
    /**
     * Get rate limit rules for a source
     */
    getRules(source) {
        return this.config?.[source] || null;
    }
    /**
     * Get or create bucket for a source
     */
    getBucket(source) {
        if (!this.buckets.has(source)) {
            this.buckets.set(source, {
                tokens: 0,
                lastRefill: new Date(),
                requestTimes: [],
            });
        }
        return this.buckets.get(source);
    }
    /**
     * Sleep helper
     */
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    /**
     * Get all current rate limit statistics
     */
    getAllStats() {
        if (!this.config) {
            return {};
        }
        const stats = {};
        const sources = Object.keys(this.config).filter((k) => k !== 'global');
        for (const source of sources) {
            stats[source] = this.getUsageStats(source);
        }
        return stats;
    }
}
// Export singleton instance
let rateLimiter = null;
export function getRateLimiter() {
    if (!rateLimiter) {
        const configPath = process.env.RATE_LIMIT_CONFIG_PATH || './config/scraper-limits.json';
        rateLimiter = new RateLimiter(configPath);
    }
    return rateLimiter;
}
//# sourceMappingURL=rate-limiter.js.map