import { BrowserPool } from '../src/browser/browser-pool.js';
import { ProxyManager } from '../src/browser/proxy-manager.js';
import { RateLimiter } from '../src/utils/rate-limiter.js';
import { YellowPagesScraper } from '../src/scrapers/yellow-pages-scraper.js';
import { logger } from '../src/utils/logger.js';
import fs from 'fs';
import path from 'path';

interface BulkSearchConfig {
  industries: string[];
  locations: string[];
  max_results_per_search: number;
}

async function bulkScrape() {
  // Configuration
  const config: BulkSearchConfig = {
    industries: [
      'hvac',
      'plumbing',
      'electrical contractor',
      'roofing contractor',
      'general contractor'
    ],
    locations: [
      'Dallas, TX',
      'Houston, TX',
      'Phoenix, AZ',
      'Miami, FL',
      'Atlanta, GA'
    ],
    max_results_per_search: 20
  };

  console.log('================================================================================');
  console.log('BULK YELLOW PAGES SCRAPER');
  console.log('================================================================================\n');
  console.log(`Industries: ${config.industries.length}`);
  console.log(`Locations: ${config.locations.length}`);
  console.log(`Total searches: ${config.industries.length * config.locations.length}`);
  console.log(`Max results per search: ${config.max_results_per_search}`);
  console.log(`Estimated total prospects: ${config.industries.length * config.locations.length * config.max_results_per_search}\n`);

  // Initialize
  const browserPool = new BrowserPool({ maxConcurrent: 2, headless: true });
  const proxyManager = null;
  const rateLimitConfig = JSON.parse(fs.readFileSync('./config/scraper-limits.json', 'utf-8'));
  const rateLimiter = new RateLimiter(rateLimitConfig);

  await browserPool.initialize();

  const allResults: any[] = [];
  let totalSearches = 0;
  let successfulSearches = 0;

  try {
    const scraper = new YellowPagesScraper(browserPool, proxyManager, rateLimiter);

    for (const industry of config.industries) {
      for (const location of config.locations) {
        totalSearches++;

        console.log(`\n[${totalSearches}/${config.industries.length * config.locations.length}] Scraping: ${industry} in ${location}`);

        const result = await scraper.scrape({
          industry,
          location,
          max_results: config.max_results_per_search
        });

        if (result.success && result.data) {
          successfulSearches++;
          console.log(`  ✅ Found ${result.data.length} businesses`);

          // Add metadata to each result
          const enrichedResults = result.data.map(r => ({
            ...r,
            search_industry: industry,
            search_location: location,
            scraped_at: new Date().toISOString()
          }));

          allResults.push(...enrichedResults);
        } else {
          console.log(`  ❌ Failed: ${result.error}`);
        }

        // Delay between searches to be respectful
        if (totalSearches < config.industries.length * config.locations.length) {
          console.log('  ⏳ Waiting 5 seconds before next search...');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }

    // Save results
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
    const outputFile = path.join('test-results', `bulk-scrape-${timestamp}.json`);

    fs.mkdirSync('test-results', { recursive: true });
    fs.writeFileSync(outputFile, JSON.stringify(allResults, null, 2));

    console.log('\n================================================================================');
    console.log('BULK SCRAPE COMPLETE');
    console.log('================================================================================');
    console.log(`Total searches: ${totalSearches}`);
    console.log(`Successful: ${successfulSearches}`);
    console.log(`Total prospects: ${allResults.length}`);
    console.log(`Saved to: ${outputFile}`);
    console.log(`\n💡 Run: npm run export:csv ${outputFile}`);

  } finally {
    await browserPool.shutdown();
  }
}

bulkScrape().catch(console.error);
