/**
 * Browser Pool Manager
 *
 * Manages Playwright browser instances with proxy rotation and stealth mode.
 * Reuses browsers for efficiency and includes anti-detection measures.
 */
import { BrowserInstance } from '../types/scraper.types.js';
import { ProxyManager } from './proxy-manager.js';
export declare class BrowserPool {
    private instances;
    private maxConcurrent;
    private proxyManager;
    private headless;
    private reuseCount;
    constructor(proxyManager: ProxyManager, maxConcurrent?: number, headless?: boolean, reuseCount?: number);
    /**
     * Acquire a browser instance from the pool
     */
    acquire(): Promise<BrowserInstance>;
    /**
     * Release a browser instance back to the pool
     */
    release(instanceId: string, success?: boolean): Promise<void>;
    /**
     * Create a new browser instance with proxy and stealth mode
     */
    private createBrowserInstance;
    /**
     * Close a specific browser instance
     */
    private closeBrowserInstance;
    /**
     * Wait for an available browser instance (with timeout)
     */
    private waitForAvailableBrowser;
    /**
     * Close all browser instances
     */
    closeAll(): Promise<void>;
    /**
     * Get pool statistics
     */
    getStats(): {
        total_instances: number;
        in_use: number;
        available: number;
        max_concurrent: number;
        total_requests: number;
        instances: {
            id: string;
            in_use: boolean;
            request_count: number;
            created_at: Date;
            last_used: Date;
            proxy: string;
        }[];
    };
    /**
     * Health check - ensure browsers are still responsive
     */
    healthCheck(): Promise<boolean>;
}
export declare function getBrowserPool(proxyManager: ProxyManager): BrowserPool;
//# sourceMappingURL=browser-pool.d.ts.map