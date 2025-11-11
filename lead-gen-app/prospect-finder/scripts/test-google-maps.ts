/**
 * Test script for Google Maps Scraper
 *
 * Usage: npm run test:google-maps -- "HVAC Dallas TX"
 */

import { GoogleMapsScraper } from '../src/scrapers/google-maps-scraper.js';
import { BrowserPool } from '../src/browser/browser-pool.js';
import { ProxyManager, getProxyManager } from '../src/browser/proxy-manager.js';
import { RateLimiter, getRateLimiter } from '../src/utils/rate-limiter.js';
import { logger } from '../src/utils/logger.js';

async function main() {
  const query = process.argv[2] || 'HVAC companies in Dallas, TX';
  const maxResults = parseInt(process.argv[3] || '10', 10);

  logger.info('Google Maps Scraper Test', { query, max_results: maxResults });

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
    const scraper = new GoogleMapsScraper(browserPool, proxyManager, rateLimiter);

    logger.info('Starting scrape...');

    // Perform scrape
    const result = await scraper.scrape({
      query,
      max_results: maxResults,
      min_rating: 3.5,
    });

    // Display results
    console.log('\n' + '='.repeat(80));
    console.log('GOOGLE MAPS SCRAPE RESULTS');
    console.log('='.repeat(80) + '\n');

    if (result.success && result.data) {
      console.log(`✓ Success! Found ${result.data.length} businesses`);
      console.log(`Duration: ${result.duration_ms}ms`);
      console.log(`Proxy Used: ${result.proxy_used}`);
      console.log(`Retries: ${result.retry_count}\n`);

      result.data.forEach((business, index) => {
        console.log(`${index + 1}. ${business.name}`);
        console.log(`   Phone: ${business.phone || 'N/A'}`);
        console.log(`   Address: ${business.address || 'N/A'}, ${business.city || 'N/A'}, ${business.state || 'N/A'} ${business.zip_code || ''}`);
        console.log(`   Website: ${business.website || 'N/A'}`);
        console.log(`   Category: ${business.category || 'N/A'}`);
        console.log(`   Rating: ${business.rating ? `${business.rating} (${business.review_count} reviews)` : 'N/A'}`);
        console.log(`   URL: ${business.google_maps_url}`);
        console.log('');
      });
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
