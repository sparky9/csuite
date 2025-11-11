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
import { logger } from '../utils/logger.js';
export class BaseScraper {
    browserPool;
    proxyManager;
    rateLimiter;
    maxRetries = 3;
    timeout = 30000; // 30 seconds
    constructor(browserPool, proxyManager, rateLimiter) {
        this.browserPool = browserPool;
        this.proxyManager = proxyManager;
        this.rateLimiter = rateLimiter;
    }
    /**
     * Main scrape method - implements retry logic and error handling
     */
    async scrape(params) {
        const startTime = Date.now();
        let lastError = null;
        let retryCount = 0;
        // Validate parameters
        if (!this.validateParams(params)) {
            return {
                success: false,
                data: null,
                error: 'Invalid parameters provided',
                retry_count: 0,
                duration_ms: Date.now() - startTime,
            };
        }
        // Check rate limit
        const rateLimitCheck = await this.rateLimiter.checkLimit(this.getRateLimitSource());
        if (!rateLimitCheck.allowed) {
            logger.warn('Rate limit hit', {
                source: this.getRateLimitSource(),
                reason: rateLimitCheck.reason,
                retry_after_ms: rateLimitCheck.retryAfterMs,
            });
            return {
                success: false,
                data: null,
                error: rateLimitCheck.reason || 'Rate limit exceeded',
                retry_count: 0,
                duration_ms: Date.now() - startTime,
            };
        }
        // Retry logic
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            let browserInstance = null;
            try {
                // Acquire browser from pool
                browserInstance = await this.browserPool.acquire();
                logger.info(`Starting scrape attempt ${attempt + 1}/${this.maxRetries + 1}`, {
                    source: this.getRateLimitSource(),
                    params,
                    browser_id: browserInstance.id,
                });
                // Perform the actual scraping (implemented by subclass)
                const result = await this.performScrape(params, browserInstance);
                // Record successful request
                this.rateLimiter.recordRequest(this.getRateLimitSource());
                // Release browser as success
                if (browserInstance) {
                    await this.browserPool.release(browserInstance.id, true);
                }
                const duration = Date.now() - startTime;
                logger.info('Scrape completed successfully', {
                    source: this.getRateLimitSource(),
                    duration_ms: duration,
                    retry_count: retryCount,
                });
                return {
                    success: true,
                    data: result,
                    retry_count: retryCount,
                    duration_ms: duration,
                    proxy_used: this.proxyManager.formatProxyForDisplay(browserInstance?.proxy || null),
                };
            }
            catch (error) {
                lastError = error;
                retryCount = attempt;
                logger.error('Scrape attempt failed', {
                    source: this.getRateLimitSource(),
                    attempt: attempt + 1,
                    error: error.message,
                    stack: error.stack,
                });
                // Release browser as failure
                if (browserInstance) {
                    await this.browserPool.release(browserInstance.id, false);
                }
                // If it's a rate limit error, don't retry
                if (this.isRateLimitError(error)) {
                    break;
                }
                // Wait before retry (exponential backoff)
                if (attempt < this.maxRetries) {
                    const delay = this.getRetryDelay(attempt);
                    logger.info(`Waiting ${delay}ms before retry`, {
                        attempt: attempt + 1,
                        max_retries: this.maxRetries,
                    });
                    await this.sleep(delay);
                }
            }
        }
        // All retries exhausted
        return {
            success: false,
            data: null,
            error: lastError?.message || 'Unknown error',
            retry_count: retryCount,
            duration_ms: Date.now() - startTime,
        };
    }
    /**
     * Random delay for human-like behavior (anti-detection)
     */
    async randomDelay(minMs = 1000, maxMs = 3000) {
        const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
        await this.sleep(delay);
    }
    /**
     * Human-like scrolling
     */
    async humanScroll(browserInstance, scrollTimes = 3) {
        for (let i = 0; i < scrollTimes; i++) {
            const scrollAmount = Math.random() * 500 + 200;
            await browserInstance.page.evaluate((amount) => {
                // @ts-ignore - window is available in browser context
                window.scrollBy({
                    top: amount,
                    behavior: 'smooth',
                });
            }, scrollAmount);
            await this.randomDelay(500, 1500);
        }
    }
    /**
     * Check if error is rate limit related
     */
    isRateLimitError(error) {
        const message = error.message?.toLowerCase() || '';
        return (message.includes('rate limit') ||
            message.includes('too many requests') ||
            message.includes('429'));
    }
    /**
     * Exponential backoff for retries
     */
    getRetryDelay(attempt) {
        const baseDelay = 2000; // 2 seconds
        const maxDelay = 30000; // 30 seconds
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        // Add jitter (random variation)
        return delay + Math.random() * 1000;
    }
    /**
     * Sleep helper
     */
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    /**
     * Validate email format
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    /**
     * Validate phone format (US)
     */
    isValidPhone(phone) {
        const phoneRegex = /^\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/;
        return phoneRegex.test(phone);
    }
    /**
     * Validate URL format
     */
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Normalize phone number to standard format
     */
    normalizePhone(phone) {
        const digits = phone.replace(/\D/g, '');
        if (digits.length === 10) {
            return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
        }
        else if (digits.length === 11 && digits[0] === '1') {
            return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
        }
        return phone; // Return as-is if can't normalize
    }
    /**
     * Extract domain from URL
     */
    extractDomain(url) {
        try {
            const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
            return parsed.hostname.replace(/^www\./, '');
        }
        catch {
            return null;
        }
    }
}
//# sourceMappingURL=base-scraper.js.map