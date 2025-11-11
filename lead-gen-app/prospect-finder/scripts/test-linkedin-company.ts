/**
 * Test script for LinkedIn Company Scraper
 *
 * Usage: npm run test:linkedin-company -- "ABC Company Dallas"
 */

import { LinkedInCompanyScraper } from '../src/scrapers/linkedin-company-scraper.js';
import { BrowserPool } from '../src/browser/browser-pool.js';
import { ProxyManager, getProxyManager } from '../src/browser/proxy-manager.js';
import { RateLimiter, getRateLimiter } from '../src/utils/rate-limiter.js';
import { logger } from '../src/utils/logger.js';

async function main() {
  const companyName = process.argv[2] || 'Microsoft';

  logger.info('LinkedIn Company Scraper Test', { company_name: companyName });

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
    const scraper = new LinkedInCompanyScraper(browserPool, proxyManager, rateLimiter);

    logger.info('Starting scrape...');
    console.log('\nWARNING: LinkedIn has aggressive bot detection. This may fail without proper setup.\n');

    // Perform scrape
    const result = await scraper.scrape({
      company_name: companyName,
    });

    // Display results
    console.log('\n' + '='.repeat(80));
    console.log('LINKEDIN COMPANY SCRAPE RESULTS');
    console.log('='.repeat(80) + '\n');

    if (result.success && result.data) {
      console.log(`✓ Success!`);
      console.log(`Duration: ${result.duration_ms}ms`);
      console.log(`Proxy Used: ${result.proxy_used}`);
      console.log(`Retries: ${result.retry_count}\n`);

      const company = result.data;
      console.log(`Company: ${company.name}`);
      console.log(`LinkedIn URL: ${company.linkedin_url}`);
      console.log(`Industry: ${company.industry || 'N/A'}`);
      console.log(`Employee Count: ${company.employee_count || 'N/A'}`);
      console.log(`Website: ${company.website || 'N/A'}`);
      console.log(`Description: ${company.description ? company.description.substring(0, 200) + '...' : 'N/A'}`);
    } else if (result.success && !result.data) {
      console.log('⚠ No company found (might be login wall)');
      console.log(`Duration: ${result.duration_ms}ms`);
    } else {
      console.log('✗ Failed');
      console.log(`Error: ${result.error}`);
      console.log(`Duration: ${result.duration_ms}ms`);
      console.log(`Retries: ${result.retry_count}`);
    }

    console.log('\n' + '='.repeat(80));
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
