/**
 * Test script for Website Scraper
 *
 * Usage: npm run test:website-scraper -- "https://example.com"
 */

import { WebsiteScraper } from '../src/scrapers/website-scraper.js';
import { BrowserPool } from '../src/browser/browser-pool.js';
import { ProxyManager, getProxyManager } from '../src/browser/proxy-manager.js';
import { RateLimiter, getRateLimiter } from '../src/utils/rate-limiter.js';
import { logger } from '../src/utils/logger.js';

async function main() {
  const websiteUrl = process.argv[2] || 'https://www.microsoft.com';

  logger.info('Website Scraper Test', { website_url: websiteUrl });

  // Initialize proxy manager
  const proxyManager = getProxyManager();
  await proxyManager.initialize();

  // Initialize rate limiter
  const rateLimiter = getRateLimiter();
  await rateLimiter.initialize();

  // Initialize browser pool
  const browserPool = new BrowserPool(proxyManager, 1, false); // Headless=false for debugging

  try {
    // Create scraper instance
    const scraper = new WebsiteScraper(browserPool, proxyManager, rateLimiter);

    logger.info('Starting website scrape...');

    // Perform scrape
    const result = await scraper.scrape({
      website_url: websiteUrl,
    });

    // Display results
    console.log('\n' + '='.repeat(80));
    console.log('WEBSITE SCRAPER RESULTS');
    console.log('='.repeat(80) + '\n');

    if (result.success && result.data) {
      console.log(`✓ Success!`);
      console.log(`Duration: ${result.duration_ms}ms`);
      console.log(`Proxy Used: ${result.proxy_used}`);
      console.log(`Retries: ${result.retry_count}\n`);

      const data = result.data;

      if (data.emails.length > 0) {
        console.log(`Emails Found (${data.emails.length}):`);
        data.emails.forEach((email) => console.log(`  - ${email}`));
        console.log('');
      }

      if (data.phones.length > 0) {
        console.log(`Phone Numbers Found (${data.phones.length}):`);
        data.phones.forEach((phone) => console.log(`  - ${phone}`));
        console.log('');
      }

      if (data.employee_names.length > 0) {
        console.log(`Employee Names Found (${data.employee_names.length}):`);
        data.employee_names.forEach((name) => console.log(`  - ${name}`));
        console.log('');
      }

      if (data.services.length > 0) {
        console.log(`Services Found (${data.services.length}):`);
        data.services.slice(0, 10).forEach((service) => console.log(`  - ${service}`));
        if (data.services.length > 10) {
          console.log(`  ... and ${data.services.length - 10} more`);
        }
        console.log('');
      }

      if (Object.keys(data.social_links).length > 0) {
        console.log('Social Media Links:');
        Object.entries(data.social_links).forEach(([platform, url]) => {
          console.log(`  ${platform}: ${url}`);
        });
        console.log('');
      }

      if (
        data.emails.length === 0 &&
        data.phones.length === 0 &&
        data.employee_names.length === 0 &&
        data.services.length === 0
      ) {
        console.log('⚠ No data found on website');
      }
    } else {
      console.log('✗ Failed');
      console.log(`Error: ${result.error}`);
      console.log(`Duration: ${result.duration_ms}ms`);
      console.log(`Retries: ${result.retry_count}`);
    }

    console.log('='.repeat(80));
  } catch (error: any) {
    logger.error('Test failed', { error: error.message, stack: error.stack });
    console.error('Test failed:', error.message);
    process.exit(1);
  } finally {
    // Cleanup
    await browserPool.closeAll();
    logger.info('Browser pool closed');
  }
}

main();
