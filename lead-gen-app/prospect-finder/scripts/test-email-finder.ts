/**
 * Test script for Email Finder
 *
 * Usage: npm run test:email-finder -- "example.com" "John Doe,Jane Smith"
 */

import { EmailFinder } from '../src/scrapers/email-finder.js';
import { BrowserPool } from '../src/browser/browser-pool.js';
import { ProxyManager, getProxyManager } from '../src/browser/proxy-manager.js';
import { RateLimiter, getRateLimiter } from '../src/utils/rate-limiter.js';
import { logger } from '../src/utils/logger.js';

async function main() {
  const domain = process.argv[2] || 'microsoft.com';
  const namesArg = process.argv[3];

  // Parse person names
  let personNames: Array<{ first_name: string; last_name: string }> = [];
  if (namesArg) {
    personNames = namesArg.split(',').map((name) => {
      const parts = name.trim().split(' ');
      return {
        first_name: parts[0] || '',
        last_name: parts[1] || '',
      };
    });
  }

  logger.info('Email Finder Test', { domain, person_count: personNames.length });

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
    const scraper = new EmailFinder(browserPool, proxyManager, rateLimiter);

    logger.info('Starting email search...');

    // Perform scrape
    const result = await scraper.scrape({
      domain,
      person_names: personNames.length > 0 ? personNames : undefined,
      search_website: true,
      use_hunter_api: true,
    });

    // Display results
    console.log('\n' + '='.repeat(80));
    console.log('EMAIL FINDER RESULTS');
    console.log('='.repeat(80) + '\n');

    if (result.success && result.data) {
      console.log(`✓ Success! Found ${result.data.length} email(s)`);
      console.log(`Duration: ${result.duration_ms}ms`);
      console.log(`Proxy Used: ${result.proxy_used}`);
      console.log(`Retries: ${result.retry_count}\n`);

      // Group by confidence
      const highConfidence = result.data.filter((e) => e.confidence === 'high');
      const mediumConfidence = result.data.filter((e) => e.confidence === 'medium');
      const lowConfidence = result.data.filter((e) => e.confidence === 'low');

      if (highConfidence.length > 0) {
        console.log('HIGH CONFIDENCE (found on website or verified):');
        highConfidence.forEach((email) => {
          console.log(`  ✓ ${email.email} (${email.source}${email.verified ? ', verified' : ''})`);
        });
        console.log('');
      }

      if (mediumConfidence.length > 0) {
        console.log('MEDIUM CONFIDENCE (pattern match, partially verified):');
        mediumConfidence.forEach((email) => {
          console.log(`  ? ${email.email} (${email.source})`);
        });
        console.log('');
      }

      if (lowConfidence.length > 0) {
        console.log('LOW CONFIDENCE (guessed patterns):');
        lowConfidence.forEach((email) => {
          console.log(`  - ${email.email} (${email.source})`);
        });
        console.log('');
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
