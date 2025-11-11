/**
 * Yellow Pages Scraper
 *
 * PRIMARY data source for ProspectFinder MCP (Priority 1 - superior to Google Maps)
 *
 * Why Yellow Pages is better for B2B prospecting:
 * - More complete data: phone, address, website all in one place
 * - Business-focused: designed for B2B discovery (not consumers)
 * - Cleaner structure: consistent data format
 * - Better categorization: industry categories map perfectly to blue-collar businesses
 * - Less aggressive: easier to scrape than Google Maps, fewer anti-bot measures
 * - Up-to-date: businesses keep Yellow Pages current for lead generation
 *
 * Target URL: https://www.yellowpages.com/search?search_terms={industry}&geo_location_terms={location}
 */
import { BaseScraper } from './base-scraper.js';
import { logger } from '../utils/logger.js';
export class YellowPagesScraper extends BaseScraper {
    validateParams(params) {
        return (typeof params.industry === 'string' &&
            params.industry.length > 0 &&
            typeof params.location === 'string' &&
            params.location.length > 0 &&
            (!params.max_results || params.max_results > 0));
    }
    getRateLimitSource() {
        return 'yellow_pages';
    }
    async performScrape(params, browser) {
        const maxResults = params.max_results || 50;
        const results = [];
        logger.info('Starting Yellow Pages scrape (PRIMARY SOURCE)', {
            industry: params.industry,
            location: params.location,
            max_results: maxResults,
        });
        try {
            // Build Yellow Pages search URL
            const searchUrl = `https://www.yellowpages.com/search?search_terms=${encodeURIComponent(params.industry)}&geo_location_terms=${encodeURIComponent(params.location)}`;
            logger.debug('Navigating to Yellow Pages', { url: searchUrl });
            await browser.page.goto(searchUrl, {
                waitUntil: 'domcontentloaded',
                timeout: this.timeout,
            });
            // Wait for results to load
            await this.randomDelay(2000, 4000);
            // Wait for search results container
            try {
                await browser.page.waitForSelector('.search-results, .srp-listing, .result', { timeout: 10000 });
            }
            catch (error) {
                logger.warn('Results container not found, checking for no results message');
                const noResults = await browser.page.locator('text=/No results found|No matches found/i').count();
                if (noResults > 0) {
                    logger.info('No results found for query', { industry: params.industry, location: params.location });
                    return [];
                }
            }
            let currentPage = 1;
            let consecutiveEmptyPages = 0;
            // Paginate through results
            while (results.length < maxResults && consecutiveEmptyPages < 2) {
                logger.debug('Extracting businesses from page', {
                    page: currentPage,
                    results_so_far: results.length
                });
                // Extract business listings from current page
                const pageResults = await this.extractBusinessListings(browser.page);
                if (pageResults.length === 0) {
                    consecutiveEmptyPages++;
                    logger.warn('No results extracted from page', { page: currentPage });
                }
                else {
                    consecutiveEmptyPages = 0;
                    results.push(...pageResults);
                    logger.info('Extracted businesses from page', {
                        page: currentPage,
                        count: pageResults.length,
                        total: results.length
                    });
                }
                // Stop if we have enough results
                if (results.length >= maxResults) {
                    logger.info('Reached max results', { count: results.length });
                    break;
                }
                // Check for next page
                const hasNext = await this.hasNextPage(browser.page);
                if (!hasNext) {
                    logger.info('No more pages available');
                    break;
                }
                // Navigate to next page
                await this.goToNextPage(browser.page);
                await this.randomDelay(3000, 5000); // Longer delay between pages
                currentPage++;
            }
            // Limit to max_results
            const limitedResults = results.slice(0, maxResults);
            logger.info('Yellow Pages scrape completed', {
                results_found: limitedResults.length,
                pages_scraped: currentPage,
                industry: params.industry,
                location: params.location,
            });
            return limitedResults;
        }
        catch (error) {
            logger.error('Error during Yellow Pages scrape', {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }
    /**
     * Extract business listings from current page
     */
    async extractBusinessListings(page) {
        // @ts-ignore - This function runs in browser context where document/window are available
        return await page.evaluate(() => {
            const results = [];
            // Yellow Pages uses multiple possible selectors for listings
            const listingSelectors = [
                '.result',
                '.srp-listing',
                '.search-results .business-listing',
                '[data-listing-id]',
                '.organic'
            ];
            let listings = null;
            // Try each selector until we find listings
            for (const selector of listingSelectors) {
                listings = document.querySelectorAll(selector);
                if (listings && listings.length > 0) {
                    console.log(`Found ${listings.length} listings using selector: ${selector}`);
                    break;
                }
            }
            if (!listings || listings.length === 0) {
                console.warn('No listings found with any selector');
                return results;
            }
            listings.forEach((listing, index) => {
                try {
                    // Business name - try multiple selectors
                    const nameSelectors = [
                        '.business-name',
                        'h2.n a',
                        'a.business-name',
                        'h3 a',
                        '[itemprop="name"]',
                        '.listing-name a'
                    ];
                    let nameEl = null;
                    let name = '';
                    for (const selector of nameSelectors) {
                        nameEl = listing.querySelector(selector);
                        if (nameEl) {
                            name = nameEl.textContent?.trim() || '';
                            if (name)
                                break;
                        }
                    }
                    if (!name) {
                        console.warn(`Could not extract name for listing ${index}`);
                        return;
                    }
                    // Yellow Pages URL
                    const linkSelectors = [
                        'a.business-name',
                        'h2.n a',
                        'h3 a',
                        '.listing-name a'
                    ];
                    let linkEl = null;
                    let relativeUrl = '';
                    for (const selector of linkSelectors) {
                        linkEl = listing.querySelector(selector);
                        if (linkEl) {
                            relativeUrl = linkEl.getAttribute('href') || '';
                            if (relativeUrl)
                                break;
                        }
                    }
                    const yellow_pages_url = relativeUrl.startsWith('http')
                        ? relativeUrl
                        : relativeUrl.startsWith('/')
                            ? `https://www.yellowpages.com${relativeUrl}`
                            : '';
                    // Phone number(s)
                    const phoneSelectors = [
                        '.phone',
                        '[itemprop="telephone"]',
                        '.phones .phone',
                        '[class*="phone"]'
                    ];
                    let phoneEl = null;
                    let phone = null;
                    for (const selector of phoneSelectors) {
                        phoneEl = listing.querySelector(selector);
                        if (phoneEl) {
                            phone = phoneEl.textContent?.trim() || null;
                            if (phone)
                                break;
                        }
                    }
                    // Additional phones
                    const additionalPhones = [];
                    const phoneEls = listing.querySelectorAll('.phones .phone, [class*="phone"]');
                    phoneEls.forEach((el, idx) => {
                        if (idx > 0) {
                            const additionalPhone = el.textContent?.trim();
                            if (additionalPhone && additionalPhone !== phone) {
                                additionalPhones.push(additionalPhone);
                            }
                        }
                    });
                    // Address
                    const addressSelectors = [
                        '.street-address',
                        '[itemprop="streetAddress"]',
                        '.adr .street-address',
                        '[class*="street"]'
                    ];
                    let addressEl = null;
                    let address = null;
                    for (const selector of addressSelectors) {
                        addressEl = listing.querySelector(selector);
                        if (addressEl) {
                            address = addressEl.textContent?.trim() || null;
                            if (address)
                                break;
                        }
                    }
                    // City
                    const citySelectors = [
                        '.locality',
                        '[itemprop="addressLocality"]',
                        '.adr .locality',
                        '[class*="city"]'
                    ];
                    let cityEl = null;
                    let city = null;
                    for (const selector of citySelectors) {
                        cityEl = listing.querySelector(selector);
                        if (cityEl) {
                            city = cityEl.textContent?.trim() || null;
                            if (city)
                                break;
                        }
                    }
                    // State
                    const stateSelectors = [
                        '.region',
                        '[itemprop="addressRegion"]',
                        '.adr .region',
                        '[class*="state"]'
                    ];
                    let stateEl = null;
                    let state = null;
                    for (const selector of stateSelectors) {
                        stateEl = listing.querySelector(selector);
                        if (stateEl) {
                            state = stateEl.textContent?.trim() || null;
                            if (state)
                                break;
                        }
                    }
                    // ZIP
                    const zipSelectors = [
                        '.postal-code',
                        '[itemprop="postalCode"]',
                        '.adr .postal-code',
                        '[class*="zip"]'
                    ];
                    let zipEl = null;
                    let zip_code = null;
                    for (const selector of zipSelectors) {
                        zipEl = listing.querySelector(selector);
                        if (zipEl) {
                            zip_code = zipEl.textContent?.trim() || null;
                            if (zip_code)
                                break;
                        }
                    }
                    // Website
                    const websiteSelectors = [
                        '.track-visit-website',
                        'a[href*="website"]',
                        '.website-link',
                        '[class*="website"] a'
                    ];
                    let websiteEl = null;
                    let website = null;
                    for (const selector of websiteSelectors) {
                        websiteEl = listing.querySelector(selector);
                        if (websiteEl) {
                            website = websiteEl.getAttribute('href') || null;
                            if (website)
                                break;
                        }
                    }
                    // Category
                    const categorySelectors = [
                        '.categories a',
                        '.business-categories a',
                        '[itemprop="category"]',
                        '.category-link'
                    ];
                    let categoryEl = null;
                    let category = null;
                    for (const selector of categorySelectors) {
                        categoryEl = listing.querySelector(selector);
                        if (categoryEl) {
                            category = categoryEl.textContent?.trim() || null;
                            if (category)
                                break;
                        }
                    }
                    // Years in business
                    const yearsSelectors = [
                        '.years-in-business',
                        '.yrs-in-business',
                        '[class*="years"]'
                    ];
                    let yearsEl = null;
                    let yearsText = '';
                    let years_in_business = null;
                    for (const selector of yearsSelectors) {
                        yearsEl = listing.querySelector(selector);
                        if (yearsEl) {
                            yearsText = yearsEl.textContent?.trim() || '';
                            const yearsMatch = yearsText.match(/(\d+)/);
                            if (yearsMatch) {
                                years_in_business = parseInt(yearsMatch[1]);
                                break;
                            }
                        }
                    }
                    // Services (if listed)
                    const services = [];
                    const serviceEls = listing.querySelectorAll('.services li, .amenities li, [class*="service"] li');
                    serviceEls.forEach((el) => {
                        const service = el.textContent?.trim();
                        if (service)
                            services.push(service);
                    });
                    // BBB Rating
                    const bbbSelectors = [
                        '.bbb-rating',
                        '[class*="bbb"]',
                        '.rating-bbb'
                    ];
                    let bbbEl = null;
                    let bbb_rating = null;
                    for (const selector of bbbSelectors) {
                        bbbEl = listing.querySelector(selector);
                        if (bbbEl) {
                            bbb_rating = bbbEl.textContent?.trim() || null;
                            if (bbb_rating)
                                break;
                        }
                    }
                    // Only add if we have at minimum a name and Yellow Pages URL
                    if (name && yellow_pages_url) {
                        results.push({
                            name,
                            phone,
                            additional_phones: additionalPhones,
                            address,
                            city,
                            state,
                            zip_code,
                            website,
                            category,
                            years_in_business,
                            services,
                            bbb_rating,
                            yellow_pages_url,
                        });
                    }
                    else {
                        console.warn(`Skipping listing ${index}: missing required fields (name or URL)`);
                    }
                }
                catch (err) {
                    console.error(`Error extracting listing ${index}:`, err);
                }
            });
            console.log(`Successfully extracted ${results.length} businesses from page`);
            return results;
        });
    }
    /**
     * Check if there's a next page
     */
    async hasNextPage(page) {
        return await page.evaluate(() => {
            const nextSelectors = [
                '.next:not(.disabled)',
                'a.next:not(.disabled)',
                '.pagination .next:not(.disabled)',
                'a[aria-label="Next"]',
                '.pagination a:last-child:not(.disabled)'
            ];
            for (const selector of nextSelectors) {
                const nextButton = document.querySelector(selector);
                if (nextButton && !nextButton.classList.contains('disabled')) {
                    return true;
                }
            }
            return false;
        });
    }
    /**
     * Navigate to next page
     */
    async goToNextPage(page) {
        const clicked = await page.evaluate(() => {
            const nextSelectors = [
                '.next:not(.disabled)',
                'a.next:not(.disabled)',
                '.pagination .next:not(.disabled)',
                'a[aria-label="Next"]'
            ];
            for (const selector of nextSelectors) {
                const nextButton = document.querySelector(selector);
                if (nextButton && !nextButton.classList.contains('disabled')) {
                    nextButton.click();
                    return true;
                }
            }
            return false;
        });
        if (clicked) {
            await page.waitForLoadState('domcontentloaded');
            await this.randomDelay(2000, 3000);
        }
        else {
            throw new Error('Could not find or click next page button');
        }
    }
}
//# sourceMappingURL=yellow-pages-scraper.js.map