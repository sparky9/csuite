/**
 * Test script for Yellow Pages Scraper
 *
 * Usage: npm run test:yellow-pages -- hvac "Dallas, TX" 10
 *
 * This tests the PRIMARY data source for ProspectFinder MCP.
 * Yellow Pages provides superior B2B data compared to Google Maps.
 */

import { YellowPagesScraper } from '../src/scrapers/yellow-pages-scraper.js';
import { BrowserPool } from '../src/browser/browser-pool.js';
import { getProxyManager } from '../src/browser/proxy-manager.js';
import { getRateLimiter } from '../src/utils/rate-limiter.js';
import { logger } from '../src/utils/logger.js';
import fs from 'fs';
import path from 'path';

async function main() {
  const industry = process.argv[2] || 'hvac';
  const location = process.argv[3] || 'Dallas, TX';
  const maxResults = parseInt(process.argv[4] || '10', 10);

  logger.info('Yellow Pages Scraper Test (PRIMARY SOURCE)', {
    industry,
    location,
    max_results: maxResults,
  });

  console.log('\n' + '='.repeat(80));
  console.log('YELLOW PAGES SCRAPER TEST');
  console.log('PRIMARY DATA SOURCE FOR B2B PROSPECTING');
  console.log('='.repeat(80) + '\n');

  // Initialize proxy manager
  const proxyManager = getProxyManager();
  await proxyManager.initialize();

  // Initialize rate limiter
  const rateLimiter = getRateLimiter();
  await rateLimiter.initialize();

  // Initialize browser pool (headless=false to watch the scraping)
  const browserPool = new BrowserPool(proxyManager, 1, false);

  try {
    // Create scraper instance
    const scraper = new YellowPagesScraper(browserPool, proxyManager, rateLimiter);

    logger.info('Starting Yellow Pages scrape...');

    // Perform scrape
    const result = await scraper.scrape({
      industry,
      location,
      max_results: maxResults,
    });

    // Display results
    console.log('\n' + '='.repeat(80));
    console.log('YELLOW PAGES SCRAPE RESULTS');
    console.log('='.repeat(80) + '\n');

    if (result.success && result.data) {
      console.log(`✓ SUCCESS! Found ${result.data.length} businesses`);
      console.log(`Duration: ${result.duration_ms}ms (${(result.duration_ms / 1000).toFixed(2)}s)`);
      console.log(`Proxy Used: ${result.proxy_used || 'None'}`);
      console.log(`Retries: ${result.retry_count}\n`);

      console.log('Why Yellow Pages is Superior for B2B:');
      console.log('  • More complete data (phone + address + website)');
      console.log('  • Business-focused (not consumer-oriented)');
      console.log('  • Cleaner structure and consistent format');
      console.log('  • Better categorization for industries');
      console.log('  • Less aggressive anti-bot measures\n');

      console.log('='.repeat(80) + '\n');

      // Display each business
      result.data.forEach((business, index) => {
        console.log(`${index + 1}. ${business.name}`);
        console.log(`   Phone: ${business.phone || 'N/A'}`);
        if (business.additional_phones.length > 0) {
          console.log(`   Additional Phones: ${business.additional_phones.join(', ')}`);
        }
        console.log(
          `   Address: ${business.address || 'N/A'}, ${business.city || 'N/A'}, ${business.state || 'N/A'} ${business.zip_code || ''}`
        );
        console.log(`   Website: ${business.website || 'N/A'}`);
        console.log(`   Category: ${business.category || 'N/A'}`);
        if (business.years_in_business) {
          console.log(`   Years in Business: ${business.years_in_business}`);
        }
        if (business.services.length > 0) {
          console.log(`   Services: ${business.services.join(', ')}`);
        }
        if (business.bbb_rating) {
          console.log(`   BBB Rating: ${business.bbb_rating}`);
        }
        console.log(`   Yellow Pages URL: ${business.yellow_pages_url}`);
        console.log('');
      });

      // Calculate data completeness statistics
      const stats = {
        total: result.data.length,
        with_phone: result.data.filter((b) => b.phone).length,
        with_website: result.data.filter((b) => b.website).length,
        with_address: result.data.filter((b) => b.address).length,
        with_years: result.data.filter((b) => b.years_in_business).length,
        with_bbb: result.data.filter((b) => b.bbb_rating).length,
      };

      console.log('='.repeat(80));
      console.log('DATA COMPLETENESS STATISTICS');
      console.log('='.repeat(80) + '\n');
      console.log(`Total Businesses: ${stats.total}`);
      console.log(
        `With Phone: ${stats.with_phone} (${((stats.with_phone / stats.total) * 100).toFixed(1)}%)`
      );
      console.log(
        `With Website: ${stats.with_website} (${((stats.with_website / stats.total) * 100).toFixed(1)}%)`
      );
      console.log(
        `With Address: ${stats.with_address} (${((stats.with_address / stats.total) * 100).toFixed(1)}%)`
      );
      console.log(
        `With Years in Business: ${stats.with_years} (${((stats.with_years / stats.total) * 100).toFixed(1)}%)`
      );
      console.log(
        `With BBB Rating: ${stats.with_bbb} (${((stats.with_bbb / stats.total) * 100).toFixed(1)}%)`
      );

      // Save to file
      const outputDir = path.join(process.cwd(), 'test-results');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `yellow-pages-${industry.replace(/\s+/g, '-')}-${timestamp}.json`;
      const filepath = path.join(outputDir, filename);

      fs.writeFileSync(filepath, JSON.stringify(result.data, null, 2));
      console.log(`\nResults saved to: ${filepath}`);
    } else {
      console.log('✗ FAILED');
      console.log(`Error: ${result.error}`);
      console.log(`Duration: ${result.duration_ms}ms`);
      console.log(`Retries: ${result.retry_count}`);
    }

    console.log('\n' + '='.repeat(80));
  } catch (error: any) {
    logger.error('Test failed', { error: error.message, stack: error.stack });
    console.error('\n✗ Test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    // Cleanup
    await browserPool.closeAll();
    logger.info('Browser pool closed');
  }
}

main();
