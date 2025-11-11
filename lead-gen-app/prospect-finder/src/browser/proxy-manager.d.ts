/**
 * Proxy Manager
 *
 * Provider-agnostic HTTP proxy rotation with health tracking and multiple strategies.
 * Reads configuration from config/proxies.json and manages proxy lifecycle.
 */
import { ProxyServer } from '../types/scraper.types.js';
export declare class ProxyManager {
    private config;
    private proxies;
    private currentIndex;
    private configPath;
    constructor(configPath?: string);
    /**
     * Load proxy configuration from JSON file
     */
    initialize(): Promise<void>;
    /**
     * Get next proxy based on rotation strategy
     */
    getNextProxy(): ProxyServer | null;
    /**
     * Convert ProxyServer to Playwright proxy configuration
     */
    getPlaywrightProxyConfig(proxy: ProxyServer | null): any;
    /**
     * Format proxy for display in logs (without password)
     */
    formatProxyForDisplay(proxy: ProxyServer | null): string;
    /**
     * Record proxy failure and disable if threshold exceeded
     */
    recordFailure(proxy: ProxyServer): void;
    /**
     * Record successful proxy use (reset failure count)
     */
    recordSuccess(proxy: ProxyServer): void;
    /**
     * Reset failure counts for all proxies (manual recovery)
     */
    resetAllFailures(): void;
    /**
     * Get proxy statistics
     */
    getStats(): {
        total_proxies: number;
        enabled_proxies: number;
        disabled_proxies: number;
        strategy: string;
        provider: string;
        proxies: {
            host: string;
            port: number;
            enabled: boolean;
            failure_count: number;
            last_used: Date | null;
            country: string | undefined;
        }[];
    };
    /**
     * Check if proxy manager has any available proxies
     */
    hasAvailableProxies(): boolean;
    /**
     * Get recommended proxy count based on rate limits
     */
    getRecommendedProxyCount(concurrentBrowsers: number): number;
}
export declare function getProxyManager(): ProxyManager;
//# sourceMappingURL=proxy-manager.d.ts.map