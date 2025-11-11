/**
 * Google Maps Scraper
 *
 * Searches Google Maps for businesses by location + industry.
 * Extracts: name, phone, address, city, state, zip, website, rating, reviews, Google Maps URL.
 */
import { BaseScraper } from './base-scraper.js';
import { logger } from '../utils/logger.js';
export class GoogleMapsScraper extends BaseScraper {
    validateParams(params) {
        return (typeof params.query === 'string' &&
            params.query.length > 0 &&
            (!params.max_results || params.max_results > 0) &&
            (!params.min_rating || (params.min_rating >= 1.0 && params.min_rating <= 5.0)));
    }
    getRateLimitSource() {
        return 'google_maps';
    }
    async performScrape(params, browser) {
        const maxResults = params.max_results || 50;
        const minRating = params.min_rating || 0;
        const results = [];
        logger.info('Starting Google Maps scrape', {
            query: params.query,
            max_results: maxResults,
            min_rating: minRating,
        });
        try {
            // Navigate to Google Maps search
            const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(params.query)}`;
            logger.debug('Navigating to Google Maps', { url: searchUrl });
            await browser.page.goto(searchUrl, {
                waitUntil: 'domcontentloaded',
                timeout: this.timeout,
            });
            // Wait for results to load
            await this.randomDelay(2000, 4000);
            // Wait for the results panel to appear
            try {
                await browser.page.waitForSelector('[role="feed"]', { timeout: 10000 });
            }
            catch (error) {
                logger.warn('Results feed not found, checking if any results exist');
                const noResults = await browser.page.locator('text=No results found').count();
                if (noResults > 0) {
                    logger.info('No results found for query', { query: params.query });
                    return [];
                }
            }
            // Scroll to load more results
            let previousCount = 0;
            let scrollAttempts = 0;
            const maxScrollAttempts = Math.ceil(maxResults / 20); // Roughly 20 results per scroll
            while (results.length < maxResults && scrollAttempts < maxScrollAttempts) {
                // Get all visible business cards
                const businessCards = await browser.page.locator('[role="feed"] > div').all();
                logger.debug('Found business cards', {
                    count: businessCards.length,
                    scroll_attempt: scrollAttempts + 1,
                });
                // Extract data from each business card
                for (let i = previousCount; i < businessCards.length && results.length < maxResults; i++) {
                    try {
                        const card = businessCards[i];
                        // Extract business name
                        const nameElement = card.locator('a[aria-label]').first();
                        const ariaLabel = await nameElement.getAttribute('aria-label');
                        const name = ariaLabel || await nameElement.textContent() || 'Unknown';
                        if (!name || name === 'Unknown') {
                            continue;
                        }
                        // Click on the card to reveal details
                        await card.click();
                        await this.randomDelay(1000, 2000);
                        // Extract details from the detail panel
                        const detailPanel = browser.page.locator('[role="main"]');
                        // Get rating
                        let rating = null;
                        let reviewCount = null;
                        try {
                            const ratingText = await detailPanel
                                .locator('[role="img"][aria-label*="stars"]')
                                .first()
                                .getAttribute('aria-label');
                            if (ratingText) {
                                const match = ratingText.match(/([\d.]+)\s+stars?/i);
                                if (match) {
                                    rating = parseFloat(match[1]);
                                }
                            }
                            // Get review count
                            const reviewText = await detailPanel
                                .locator('text=/\\d+\\s+reviews?/i')
                                .first()
                                .textContent();
                            if (reviewText) {
                                const match = reviewText.match(/(\d+)/);
                                if (match) {
                                    reviewCount = parseInt(match[1], 10);
                                }
                            }
                        }
                        catch (error) {
                            logger.debug('Could not extract rating/reviews', { name });
                        }
                        // Skip if rating is below minimum
                        if (minRating > 0 && (rating === null || rating < minRating)) {
                            logger.debug('Skipping business due to low rating', { name, rating, min_rating: minRating });
                            continue;
                        }
                        // Get phone number
                        let phone = null;
                        try {
                            const phoneButton = detailPanel.locator('button[data-item-id*="phone"]').first();
                            const phoneAria = await phoneButton.getAttribute('aria-label');
                            if (phoneAria) {
                                const phoneMatch = phoneAria.match(/Phone:\s*(.+)/i);
                                if (phoneMatch) {
                                    phone = this.normalizePhone(phoneMatch[1]);
                                }
                            }
                        }
                        catch (error) {
                            // Try alternative selector
                            try {
                                const phoneText = await detailPanel
                                    .locator('text=/\\(\\d{3}\\)\\s*\\d{3}-\\d{4}/i')
                                    .first()
                                    .textContent();
                                if (phoneText) {
                                    phone = this.normalizePhone(phoneText);
                                }
                            }
                            catch (innerError) {
                                logger.debug('Could not extract phone', { name });
                            }
                        }
                        // Get address
                        let address = null;
                        let city = null;
                        let state = null;
                        let zipCode = null;
                        try {
                            const addressButton = detailPanel.locator('button[data-item-id*="address"]').first();
                            const addressAria = await addressButton.getAttribute('aria-label');
                            if (addressAria) {
                                const addressMatch = addressAria.match(/Address:\s*(.+)/i);
                                if (addressMatch) {
                                    const fullAddress = addressMatch[1];
                                    const parsed = this.parseAddress(fullAddress);
                                    address = parsed.address;
                                    city = parsed.city;
                                    state = parsed.state;
                                    zipCode = parsed.zipCode;
                                }
                            }
                        }
                        catch (error) {
                            logger.debug('Could not extract address', { name });
                        }
                        // Get website
                        let website = null;
                        try {
                            const websiteLink = detailPanel.locator('a[data-item-id*="authority"]').first();
                            const websiteHref = await websiteLink.getAttribute('href');
                            if (websiteHref && this.isValidUrl(websiteHref)) {
                                website = websiteHref;
                            }
                        }
                        catch (error) {
                            logger.debug('Could not extract website', { name });
                        }
                        // Get category
                        let category = null;
                        try {
                            const categoryButton = detailPanel.locator('button[jsaction*="category"]').first();
                            category = await categoryButton.textContent();
                        }
                        catch (error) {
                            logger.debug('Could not extract category', { name });
                        }
                        // Get Google Maps URL
                        const googleMapsUrl = browser.page.url();
                        // Create result
                        const result = {
                            name: name.trim(),
                            phone,
                            address,
                            city,
                            state,
                            zip_code: zipCode,
                            website,
                            category,
                            rating,
                            review_count: reviewCount,
                            google_maps_url: googleMapsUrl,
                        };
                        results.push(result);
                        logger.debug('Extracted business data', {
                            name: result.name,
                            phone: result.phone,
                            rating: result.rating,
                        });
                    }
                    catch (error) {
                        logger.error('Error extracting business card data', {
                            index: i,
                            error: error.message,
                        });
                    }
                }
                previousCount = businessCards.length;
                // Check if we need more results
                if (results.length >= maxResults) {
                    break;
                }
                // Scroll to load more
                logger.debug('Scrolling to load more results', {
                    current_results: results.length,
                    target: maxResults,
                });
                await browser.page.locator('[role="feed"]').last().scrollIntoViewIfNeeded();
                await this.humanScroll(browser, 2);
                await this.randomDelay(2000, 3000);
                // Check if we reached the end
                const endOfList = await browser.page.locator('text=You\'ve reached the end of the list').count();
                if (endOfList > 0) {
                    logger.info('Reached end of Google Maps results');
                    break;
                }
                scrollAttempts++;
            }
            logger.info('Google Maps scrape completed', {
                results_found: results.length,
                query: params.query,
            });
            return results;
        }
        catch (error) {
            logger.error('Error during Google Maps scrape', {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }
    /**
     * Parse address into components
     */
    parseAddress(fullAddress) {
        try {
            // US address format: "123 Main St, Dallas, TX 75201"
            const parts = fullAddress.split(',').map((p) => p.trim());
            if (parts.length >= 3) {
                const address = parts[0];
                const city = parts[1];
                // Last part should be "STATE ZIP"
                const stateZipMatch = parts[parts.length - 1].match(/([A-Z]{2})\s+(\d{5}(-\d{4})?)/);
                if (stateZipMatch) {
                    return {
                        address,
                        city,
                        state: stateZipMatch[1],
                        zipCode: stateZipMatch[2],
                    };
                }
                // Try without zip code
                const stateMatch = parts[parts.length - 1].match(/([A-Z]{2})/);
                if (stateMatch) {
                    return {
                        address,
                        city,
                        state: stateMatch[1],
                        zipCode: null,
                    };
                }
                return {
                    address,
                    city,
                    state: null,
                    zipCode: null,
                };
            }
            // Couldn't parse, return full address
            return {
                address: fullAddress,
                city: null,
                state: null,
                zipCode: null,
            };
        }
        catch (error) {
            logger.debug('Error parsing address', { address: fullAddress, error });
            return {
                address: fullAddress,
                city: null,
                state: null,
                zipCode: null,
            };
        }
    }
}
//# sourceMappingURL=google-maps-scraper.js.map