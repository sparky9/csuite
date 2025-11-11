/**
 * Base Scraper Abstract Class
 *
 * Provides common functionality for all scrapers:
 * - Browser pool management
 * - Proxy rotation
 * - Rate limiting
 * - Error handling
 * - Retry logic
 * - Random delays (anti-detection)
 */
import { BrowserPool } from '../browser/browser-pool.js';
import { ProxyManager } from '../browser/proxy-manager.js';
import { RateLimiter } from '../utils/rate-limiter.js';
import { ScraperResult, BrowserInstance } from '../types/scraper.types.js';
export declare abstract class BaseScraper<TParams, TResult> {
    protected browserPool: BrowserPool;
    protected proxyManager: ProxyManager;
    protected rateLimiter: RateLimiter;
    protected maxRetries: number;
    protected timeout: number;
    constructor(browserPool: BrowserPool, proxyManager: ProxyManager, rateLimiter: RateLimiter);
    /**
     * Main scrape method - implements retry logic and error handling
     */
    scrape(params: TParams): Promise<ScraperResult<TResult>>;
    /**
     * Abstract method - implement actual scraping logic in subclass
     */
    protected abstract performScrape(params: TParams, browser: BrowserInstance): Promise<TResult>;
    /**
     * Abstract method - validate scraper-specific parameters
     */
    protected abstract validateParams(params: TParams): boolean;
    /**
     * Abstract method - return rate limit source identifier
     */
    protected abstract getRateLimitSource(): 'yellow_pages' | 'google_maps' | 'linkedin_company' | 'linkedin_people' | 'email_finder';
    /**
     * Random delay for human-like behavior (anti-detection)
     */
    protected randomDelay(minMs?: number, maxMs?: number): Promise<void>;
    /**
     * Human-like scrolling
     */
    protected humanScroll(browserInstance: BrowserInstance, scrollTimes?: number): Promise<void>;
    /**
     * Check if error is rate limit related
     */
    protected isRateLimitError(error: any): boolean;
    /**
     * Exponential backoff for retries
     */
    protected getRetryDelay(attempt: number): number;
    /**
     * Sleep helper
     */
    protected sleep(ms: number): Promise<void>;
    /**
     * Validate email format
     */
    protected isValidEmail(email: string): boolean;
    /**
     * Validate phone format (US)
     */
    protected isValidPhone(phone: string): boolean;
    /**
     * Validate URL format
     */
    protected isValidUrl(url: string): boolean;
    /**
     * Normalize phone number to standard format
     */
    protected normalizePhone(phone: string): string;
    /**
     * Extract domain from URL
     */
    protected extractDomain(url: string): string | null;
}
//# sourceMappingURL=base-scraper.d.ts.map