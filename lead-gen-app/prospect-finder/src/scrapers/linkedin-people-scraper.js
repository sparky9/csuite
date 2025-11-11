/**
 * LinkedIn People Scraper
 *
 * Searches LinkedIn for people at a specific company with target job titles.
 * IMPORTANT: LinkedIn has VERY aggressive bot detection - use sparingly.
 */
import { BaseScraper } from './base-scraper.js';
import { logger } from '../utils/logger.js';
export class LinkedInPeopleScraper extends BaseScraper {
    validateParams(params) {
        return (typeof params.company_name === 'string' &&
            params.company_name.length > 0 &&
            (!params.max_results || params.max_results > 0));
    }
    getRateLimitSource() {
        return 'linkedin_people';
    }
    async performScrape(params, browser) {
        const jobTitles = params.job_titles || ['Owner', 'CEO', 'President', 'Manager'];
        const maxResults = params.max_results || 5;
        const results = [];
        logger.info('Starting LinkedIn people scrape', {
            company_name: params.company_name,
            job_titles: jobTitles,
            max_results: maxResults,
        });
        try {
            // Search for each job title (to get diverse results)
            for (const jobTitle of jobTitles) {
                if (results.length >= maxResults) {
                    break;
                }
                logger.debug('Searching for job title', { job_title: jobTitle });
                // Build search query: "CEO at Company Name"
                const searchQuery = `${jobTitle} at ${params.company_name}`;
                const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(searchQuery)}`;
                logger.debug('Navigating to LinkedIn people search', { url: searchUrl });
                await browser.page.goto(searchUrl, {
                    waitUntil: 'domcontentloaded',
                    timeout: this.timeout,
                });
                // Longer delay for LinkedIn
                await this.randomDelay(4000, 6000);
                // Check for login wall
                const isLoginPage = await browser.page.locator('text=/sign in/i').count() > 0;
                if (isLoginPage) {
                    logger.warn('LinkedIn login wall detected - cannot scrape people without authentication');
                    break;
                }
                // Wait for search results
                try {
                    await browser.page.waitForSelector('.search-results-container', { timeout: 10000 });
                }
                catch (error) {
                    logger.warn('Search results container not found');
                    continue;
                }
                // Extract people from search results (don't visit profiles to avoid detection)
                const peopleCards = await browser.page.locator('.entity-result').all();
                logger.debug('Found people cards', { count: peopleCards.length });
                for (let i = 0; i < Math.min(peopleCards.length, maxResults - results.length); i++) {
                    try {
                        const card = peopleCards[i];
                        // Extract name
                        let fullName = null;
                        try {
                            const nameElement = card.locator('.entity-result__title-text a').first();
                            const nameText = await nameElement.textContent();
                            if (nameText) {
                                fullName = nameText.trim();
                            }
                        }
                        catch (error) {
                            logger.debug('Could not extract name from card', { index: i });
                            continue;
                        }
                        if (!fullName) {
                            continue;
                        }
                        // Extract title
                        let title = null;
                        try {
                            const titleElement = card.locator('.entity-result__primary-subtitle').first();
                            const titleText = await titleElement.textContent();
                            if (titleText) {
                                title = titleText.trim();
                            }
                        }
                        catch (error) {
                            logger.debug('Could not extract title from card', { name: fullName });
                        }
                        // Extract LinkedIn URL
                        let linkedinUrl = null;
                        try {
                            const linkElement = card.locator('.entity-result__title-text a').first();
                            const href = await linkElement.getAttribute('href');
                            if (href) {
                                linkedinUrl = href.split('?')[0]; // Remove query params
                            }
                        }
                        catch (error) {
                            logger.debug('Could not extract LinkedIn URL', { name: fullName });
                        }
                        // Verify company name is mentioned (to avoid false positives)
                        let companyNameMentioned = false;
                        try {
                            const cardText = await card.textContent();
                            if (cardText && cardText.toLowerCase().includes(params.company_name.toLowerCase())) {
                                companyNameMentioned = true;
                            }
                        }
                        catch (error) {
                            logger.debug('Could not verify company name in card');
                        }
                        // Only include if we have basic info
                        if (fullName && linkedinUrl) {
                            const result = {
                                full_name: fullName,
                                title: title,
                                linkedin_url: linkedinUrl,
                                company_name: companyNameMentioned ? params.company_name : null,
                            };
                            results.push(result);
                            logger.debug('Extracted person data', {
                                name: result.full_name,
                                title: result.title,
                            });
                        }
                    }
                    catch (error) {
                        logger.error('Error extracting person card data', {
                            index: i,
                            error: error.message,
                        });
                    }
                }
                // Don't search more titles if we hit rate limit signs
                const rateLimitIndicators = await browser.page.locator('text=/too many requests/i').count();
                if (rateLimitIndicators > 0) {
                    logger.warn('Possible rate limit detected, stopping search');
                    break;
                }
                // Longer delay between job title searches
                if (results.length < maxResults && jobTitles.indexOf(jobTitle) < jobTitles.length - 1) {
                    await this.randomDelay(5000, 8000);
                }
            }
            logger.info('LinkedIn people scrape completed', {
                results_found: results.length,
                company_name: params.company_name,
            });
            return results;
        }
        catch (error) {
            logger.error('Error during LinkedIn people scrape', {
                error: error.message,
                stack: error.stack,
            });
            // Check if it's a timeout or network error
            if (error.message?.includes('timeout') || error.message?.includes('net::')) {
                throw new Error('LinkedIn request timed out - possible rate limiting');
            }
            throw error;
        }
    }
}
//# sourceMappingURL=linkedin-people-scraper.js.map