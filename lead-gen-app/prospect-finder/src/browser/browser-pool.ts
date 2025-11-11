/**
 * Browser Pool Manager
 *
 * Manages Playwright browser instances with proxy rotation and stealth mode.
 * Reuses browsers for efficiency and includes anti-detection measures.
 */

import { chromium } from 'playwright';
import { BrowserInstance } from '../types/scraper.types.js';
import { ProxyManager } from './proxy-manager.js';
import { logger } from '../utils/logger.js';
import { randomUUID } from 'crypto';

export class BrowserPool {
  private instances: Map<string, BrowserInstance> = new Map();
  private maxConcurrent: number;
  private proxyManager: ProxyManager;
  private headless: boolean;
  private reuseCount: number;

  constructor(
    proxyManager: ProxyManager,
    maxConcurrent: number = 2,
    headless: boolean = true,
    reuseCount: number = 50
  ) {
    this.proxyManager = proxyManager;
    this.maxConcurrent = maxConcurrent;
    this.headless = headless;
    this.reuseCount = reuseCount;

    logger.info('Browser pool initialized', {
      max_concurrent: maxConcurrent,
      headless,
      reuse_count: reuseCount,
    });
  }

  /**
   * Acquire a browser instance from the pool
   */
  async acquire(): Promise<BrowserInstance> {
    // Check for available (not in use) browser
    for (const [id, instance] of this.instances) {
      if (!instance.in_use && instance.request_count < this.reuseCount) {
        instance.in_use = true;
        instance.last_used = new Date();
        logger.debug('Reusing browser instance', {
          id,
          request_count: instance.request_count,
        });
        return instance;
      }
    }

    // Create new browser if under concurrent limit
    if (this.instances.size < this.maxConcurrent) {
      const instance = await this.createBrowserInstance();
      this.instances.set(instance.id, instance);
      return instance;
    }

    // Wait for available browser if at limit
    logger.debug('Browser pool at capacity, waiting for available instance');
    return this.waitForAvailableBrowser();
  }

  /**
   * Release a browser instance back to the pool
   */
  async release(instanceId: string, success: boolean = true): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      logger.warn('Attempted to release unknown browser instance', { id: instanceId });
      return;
    }

    instance.in_use = false;
    instance.last_used = new Date();
    instance.request_count++;

    // Record proxy success/failure
    if (instance.proxy) {
      if (success) {
        this.proxyManager.recordSuccess(instance.proxy);
      } else {
        this.proxyManager.recordFailure(instance.proxy);
      }
    }

    // Close browser if it has exceeded reuse count
    if (instance.request_count >= this.reuseCount) {
      logger.info('Browser instance exceeded reuse count, closing', {
        id: instanceId,
        request_count: instance.request_count,
      });
      await this.closeBrowserInstance(instanceId);
    }

    logger.debug('Browser instance released', {
      id: instanceId,
      request_count: instance.request_count,
      success,
    });
  }

  /**
   * Create a new browser instance with proxy and stealth mode
   */
  private async createBrowserInstance(): Promise<BrowserInstance> {
    const id = randomUUID();
    const proxy = this.proxyManager.getNextProxy();

    logger.info('Creating new browser instance', {
      id,
      proxy: this.proxyManager.formatProxyForDisplay(proxy),
    });

    try {
      // Launch browser with proxy if available
      const browser = await chromium.launch({
        headless: this.headless,
        proxy: this.proxyManager.getPlaywrightProxyConfig(proxy),
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
        ],
      });

      // Create context with stealth settings
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'en-US',
        timezoneId: 'America/New_York',
        permissions: [],
        javaScriptEnabled: true,
      });

      // Add stealth scripts to hide automation
      await context.addInitScript(`
        // Override navigator.webdriver
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });

        // Override plugins to look real
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });

        // Override languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });

        // Override chrome object
        window.chrome = {
          runtime: {},
        };

        // Override permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) =>
          parameters.name === 'notifications'
            ? Promise.resolve({ state: 'denied' })
            : originalQuery(parameters);
      `);

      const page = await context.newPage();

      const instance: BrowserInstance = {
        id,
        browser,
        page,
        proxy,
        in_use: true,
        created_at: new Date(),
        last_used: new Date(),
        request_count: 0,
      };

      logger.info('Browser instance created successfully', { id });
      return instance;
    } catch (error) {
      logger.error('Failed to create browser instance', { id, error });
      throw error;
    }
  }

  /**
   * Close a specific browser instance
   */
  private async closeBrowserInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) return;

    try {
      await instance.browser.close();
      this.instances.delete(instanceId);
      logger.info('Browser instance closed', { id: instanceId });
    } catch (error) {
      logger.error('Error closing browser instance', { id: instanceId, error });
    }
  }

  /**
   * Wait for an available browser instance (with timeout)
   */
  private async waitForAvailableBrowser(timeoutMs: number = 30000): Promise<BrowserInstance> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(async () => {
        // Check for available browser
        for (const [_id, instance] of this.instances) {
          if (!instance.in_use) {
            clearInterval(checkInterval);
            instance.in_use = true;
            instance.last_used = new Date();
            resolve(instance);
            return;
          }
        }

        // Check timeout
        if (Date.now() - startTime > timeoutMs) {
          clearInterval(checkInterval);
          reject(new Error('Timeout waiting for available browser'));
        }
      }, 100);
    });
  }

  /**
   * Close all browser instances
   */
  async closeAll(): Promise<void> {
    logger.info('Closing all browser instances', { count: this.instances.size });

    const closePromises = Array.from(this.instances.keys()).map((id) =>
      this.closeBrowserInstance(id)
    );

    await Promise.all(closePromises);
    this.instances.clear();

    logger.info('All browser instances closed');
  }

  /**
   * Get pool statistics
   */
  getStats() {
    const instances = Array.from(this.instances.values());

    return {
      total_instances: instances.length,
      in_use: instances.filter((i) => i.in_use).length,
      available: instances.filter((i) => !i.in_use).length,
      max_concurrent: this.maxConcurrent,
      total_requests: instances.reduce((sum, i) => sum + i.request_count, 0),
      instances: instances.map((i) => ({
        id: i.id,
        in_use: i.in_use,
        request_count: i.request_count,
        created_at: i.created_at,
        last_used: i.last_used,
        proxy: this.proxyManager.formatProxyForDisplay(i.proxy),
      })),
    };
  }

  /**
   * Health check - ensure browsers are still responsive
   */
  async healthCheck(): Promise<boolean> {
    try {
      const instances = Array.from(this.instances.values());

      for (const instance of instances) {
        if (!instance.in_use) {
          // Try to execute a simple operation
          await instance.page.evaluate(() => true);
        }
      }

      return true;
    } catch (error) {
      logger.error('Browser pool health check failed', { error });
      return false;
    }
  }
}

// Export singleton instance
let browserPool: BrowserPool | null = null;

export function getBrowserPool(proxyManager: ProxyManager): BrowserPool {
  if (!browserPool) {
    const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_BROWSERS || '2', 10);
    const headless = process.env.HEADLESS !== 'false';

    browserPool = new BrowserPool(proxyManager, maxConcurrent, headless);
  }
  return browserPool;
}
