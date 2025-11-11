/**
 * Rate Limiter
 *
 * Per-source rate limiting using token bucket algorithm.
 * Reads limits from config/scraper-limits.json and enforces per-minute, per-hour, per-day limits.
 */
import { RateLimitConfig, RateLimitRules } from '../types/scraper.types.js';
export declare class RateLimiter {
    private config;
    private buckets;
    private configPath;
    constructor(configPath?: string);
    /**
     * Load rate limit configuration from JSON file
     */
    initialize(): Promise<void>;
    /**
     * Check if request is allowed for a given source
     */
    checkLimit(source: keyof RateLimitConfig): Promise<{
        allowed: boolean;
        reason?: string;
        retryAfterMs?: number;
    }>;
    /**
     * Record a request for a source (call after successful scrape)
     */
    recordRequest(source: keyof RateLimitConfig): void;
    /**
     * Wait until rate limit allows request (with timeout)
     */
    waitForLimit(source: keyof RateLimitConfig, maxWaitMs?: number): Promise<void>;
    /**
     * Get current usage statistics for a source
     */
    getUsageStats(source: keyof RateLimitConfig): {
        source: keyof RateLimitConfig;
        per_minute: {
            used: number;
            limit: number;
            percentage: number;
        };
        per_hour: {
            used: number;
            limit: number;
            percentage: number;
        };
        per_day: {
            used: number;
            limit: number;
            percentage: number;
        };
    };
    /**
     * Reset rate limits for a source (for testing or manual override)
     */
    reset(source?: keyof RateLimitConfig): void;
    /**
     * Get rate limit rules for a source
     */
    getRules(source: keyof RateLimitConfig): RateLimitRules | null;
    /**
     * Get or create bucket for a source
     */
    private getBucket;
    /**
     * Sleep helper
     */
    private sleep;
    /**
     * Get all current rate limit statistics
     */
    getAllStats(): Record<string, any>;
}
export declare function getRateLimiter(): RateLimiter;
//# sourceMappingURL=rate-limiter.d.ts.map