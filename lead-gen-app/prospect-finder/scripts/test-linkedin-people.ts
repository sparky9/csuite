/**
 * Test script for LinkedIn People Scraper
 *
 * Usage: npm run test:linkedin-people -- "ABC Company" "Owner,CEO"
 */

import { LinkedInPeopleScraper } from '../src/scrapers/linkedin-people-scraper.js';
import { BrowserPool } from '../src/browser/browser-pool.js';
import { ProxyManager, getProxyManager } from '../src/browser/proxy-manager.js';
import { RateLimiter, getRateLimiter } from '../src/utils/rate-limiter.js';
import { logger } from '../src/utils/logger.js';

async function main() {
  const companyName = process.argv[2] || 'Microsoft';
  const jobTitles = process.argv[3]?.split(',') || ['CEO', 'Owner', 'President'];

  logger.info('LinkedIn People Scraper Test', { company_name: companyName, job_titles: jobTitles });

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
    const scraper = new LinkedInPeopleScraper(browserPool, proxyManager, rateLimiter);

    logger.info('Starting scrape...');
    console.log('\nWARNING: LinkedIn has VERY aggressive bot detection. This may fail without authentication.\n');

    // Perform scrape
    const result = await scraper.scrape({
      company_name: companyName,
      job_titles: jobTitles,
      max_results: 5,
    });

    // Display results
    console.log('\n' + '='.repeat(80));
    console.log('LINKEDIN PEOPLE SCRAPE RESULTS');
    console.log('='.repeat(80) + '\n');

    if (result.success && result.data) {
      console.log(`✓ Success! Found ${result.data.length} people`);
      console.log(`Duration: ${result.duration_ms}ms`);
      console.log(`Proxy Used: ${result.proxy_used}`);
      console.log(`Retries: ${result.retry_count}\n`);

      result.data.forEach((person, index) => {
        console.log(`${index + 1}. ${person.full_name}`);
        console.log(`   Title: ${person.title || 'N/A'}`);
        console.log(`   Company: ${person.company_name || 'N/A'}`);
        console.log(`   LinkedIn: ${person.linkedin_url}`);
        console.log('');
      });
    } else {
      console.log('✗ Failed or no results');
      console.log(`Error: ${result.error || 'No data'}`);
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
