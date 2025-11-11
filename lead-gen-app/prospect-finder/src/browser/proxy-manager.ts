/**
 * Proxy Manager
 *
 * Provider-agnostic HTTP proxy rotation with health tracking and multiple strategies.
 * Reads configuration from config/proxies.json and manages proxy lifecycle.
 */

import fs from 'fs/promises';
import { ProxyConfig, ProxyServer } from '../types/scraper.types.js';
import { logger } from '../utils/logger.js';

export class ProxyManager {
  private config: ProxyConfig | null = null;
  private proxies: ProxyServer[] = [];
  private currentIndex = 0;
  private configPath: string;

  constructor(configPath: string = './config/proxies.json') {
    this.configPath = configPath;
  }

  /**
   * Load proxy configuration from JSON file
   */
  async initialize(): Promise<void> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      this.config = JSON.parse(configData) as ProxyConfig;
      this.proxies = this.config.proxies.filter((p) => p.enabled);

      logger.info('Proxy manager initialized', {
        provider: this.config.provider,
        strategy: this.config.rotation_strategy,
        proxy_count: this.proxies.length,
        enabled_count: this.proxies.filter((p) => p.enabled).length,
      });

      if (this.proxies.length === 0) {
        logger.warn('No enabled proxies found. Running without proxy rotation.');
      }
    } catch (error) {
      logger.warn('Failed to load proxy configuration. Running without proxies.', {
        error,
        path: this.configPath,
      });
      this.config = null;
      this.proxies = [];
    }
  }

  /**
   * Get next proxy based on rotation strategy
   */
  getNextProxy(): ProxyServer | null {
    if (this.proxies.length === 0) {
      return null;
    }

    const enabledProxies = this.proxies.filter((p) => p.enabled);
    if (enabledProxies.length === 0) {
      logger.error('All proxies disabled due to failures');
      return null;
    }

    let selectedProxy: ProxyServer;

    switch (this.config?.rotation_strategy) {
      case 'round_robin':
        selectedProxy = enabledProxies[this.currentIndex % enabledProxies.length];
        this.currentIndex++;
        break;

      case 'random':
        const randomIndex = Math.floor(Math.random() * enabledProxies.length);
        selectedProxy = enabledProxies[randomIndex];
        break;

      case 'least_used':
        selectedProxy = enabledProxies.reduce((least, current) => {
          const leastTime = least.last_used ? new Date(least.last_used).getTime() : 0;
          const currentTime = current.last_used ? new Date(current.last_used).getTime() : 0;
          return currentTime < leastTime ? current : least;
        });
        break;

      default:
        selectedProxy = enabledProxies[0];
    }

    // Update last used timestamp
    selectedProxy.last_used = new Date();

    logger.debug('Proxy selected', {
      host: selectedProxy.host,
      strategy: this.config?.rotation_strategy,
      country: selectedProxy.country,
    });

    return selectedProxy;
  }

  /**
   * Convert ProxyServer to Playwright proxy configuration
   */
  getPlaywrightProxyConfig(proxy: ProxyServer | null) {
    if (!proxy) {
      return undefined;
    }

    const proxyConfig: any = {
      server: `${proxy.protocol}://${proxy.host}:${proxy.port}`,
    };

    if (proxy.username && proxy.password) {
      proxyConfig.username = proxy.username;
      proxyConfig.password = proxy.password;
    }

    return proxyConfig;
  }

  /**
   * Format proxy for display in logs (without password)
   */
  formatProxyForDisplay(proxy: ProxyServer | null): string {
    if (!proxy) {
      return 'No proxy';
    }
    return `${proxy.protocol}://${proxy.username ? proxy.username + '@' : ''}${proxy.host}:${proxy.port}`;
  }

  /**
   * Record proxy failure and disable if threshold exceeded
   */
  recordFailure(proxy: ProxyServer): void {
    proxy.failure_count++;

    logger.warn('Proxy failure recorded', {
      host: proxy.host,
      failure_count: proxy.failure_count,
      max_failures: this.config?.max_failures_before_disable,
    });

    if (
      this.config?.max_failures_before_disable &&
      proxy.failure_count >= this.config.max_failures_before_disable
    ) {
      proxy.enabled = false;
      logger.error('Proxy disabled due to excessive failures', {
        host: proxy.host,
        failure_count: proxy.failure_count,
      });

      // Check if we're running out of proxies
      const remainingProxies = this.proxies.filter((p) => p.enabled).length;
      if (remainingProxies === 0) {
        logger.error('CRITICAL: All proxies disabled. Scraping cannot continue.');
      } else if (remainingProxies <= 2) {
        logger.warn('WARNING: Only ' + remainingProxies + ' proxies remaining');
      }
    }
  }

  /**
   * Record successful proxy use (reset failure count)
   */
  recordSuccess(proxy: ProxyServer): void {
    if (proxy.failure_count > 0) {
      logger.info('Proxy recovered', {
        host: proxy.host,
        previous_failures: proxy.failure_count,
      });
    }
    proxy.failure_count = 0;
  }

  /**
   * Reset failure counts for all proxies (manual recovery)
   */
  resetAllFailures(): void {
    this.proxies.forEach((proxy) => {
      proxy.failure_count = 0;
      proxy.enabled = true;
    });
    logger.info('All proxy failure counts reset');
  }

  /**
   * Get proxy statistics
   */
  getStats() {
    return {
      total_proxies: this.proxies.length,
      enabled_proxies: this.proxies.filter((p) => p.enabled).length,
      disabled_proxies: this.proxies.filter((p) => !p.enabled).length,
      strategy: this.config?.rotation_strategy || 'none',
      provider: this.config?.provider || 'none',
      proxies: this.proxies.map((p) => ({
        host: p.host,
        port: p.port,
        enabled: p.enabled,
        failure_count: p.failure_count,
        last_used: p.last_used,
        country: p.country,
      })),
    };
  }

  /**
   * Check if proxy manager has any available proxies
   */
  hasAvailableProxies(): boolean {
    return this.proxies.filter((p) => p.enabled).length > 0;
  }

  /**
   * Get recommended proxy count based on rate limits
   */
  getRecommendedProxyCount(concurrentBrowsers: number): number {
    // Rule of thumb: 2-3 proxies per concurrent browser
    // This allows rotation while maintaining good distribution
    return Math.max(concurrentBrowsers * 2, 2);
  }
}

// Export singleton instance
let proxyManager: ProxyManager | null = null;

export function getProxyManager(): ProxyManager {
  if (!proxyManager) {
    const configPath = process.env.PROXY_CONFIG_PATH || './config/proxies.json';
    proxyManager = new ProxyManager(configPath);
  }
  return proxyManager;
}
