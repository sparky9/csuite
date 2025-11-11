/**
 * LinkedIn Company Scraper
 *
 * Searches LinkedIn for company pages and extracts company data.
 * IMPORTANT: LinkedIn has aggressive bot detection - use with caution.
 */
import { BaseScraper } from './base-scraper.js';
import { logger } from '../utils/logger.js';
export class LinkedInCompanyScraper extends BaseScraper {
    validateParams(params) {
        return typeof params.company_name === 'string' && params.company_name.length > 0;
    }
    getRateLimitSource() {
        return 'linkedin_company';
    }
    async performScrape(params, browser) {
        logger.info('Starting LinkedIn company scrape', {
            company_name: params.company_name,
        });
        try {
            // Navigate to LinkedIn company search
            const searchUrl = `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(params.company_name)}`;
            logger.debug('Navigating to LinkedIn search', { url: searchUrl });
            await browser.page.goto(searchUrl, {
                waitUntil: 'domcontentloaded',
                timeout: this.timeout,
            });
            // Longer delay for LinkedIn (more aggressive detection)
            await this.randomDelay(3000, 5000);
            // Check for login wall
            const isLoginPage = await browser.page.locator('text=/sign in/i').count() > 0;
            if (isLoginPage) {
                logger.warn('LinkedIn login wall detected - cannot scrape without authentication');
                return null;
            }
            // Wait for search results
            try {
                await browser.page.waitForSelector('.search-results-container', { timeout: 10000 });
            }
            catch (error) {
                logger.warn('Search results container not found');
                return null;
            }
            // Find the first company result
            const firstResult = browser.page.locator('.search-results-container .entity-result').first();
            const resultCount = await browser.page.locator('.entity-result').count();
            if (resultCount === 0) {
                logger.info('No company results found', { company_name: params.company_name });
                return null;
            }
            // Extract company URL from first result
            let companyUrl = null;
            try {
                const linkElement = firstResult.locator('a.app-aware-link').first();
                const href = await linkElement.getAttribute('href');
                if (href && href.includes('/company/')) {
                    companyUrl = href.split('?')[0]; // Remove query params
                }
            }
            catch (error) {
                logger.error('Could not extract company URL from search results');
                return null;
            }
            if (!companyUrl) {
                logger.warn('No company URL found in search results');
                return null;
            }
            logger.debug('Found company URL', { url: companyUrl });
            // Navigate to company page
            await browser.page.goto(companyUrl, {
                waitUntil: 'domcontentloaded',
                timeout: this.timeout,
            });
            await this.randomDelay(3000, 5000);
            // Check for login wall again
            const isLoginPageAgain = await browser.page.locator('text=/sign in/i').count() > 0;
            if (isLoginPageAgain) {
                logger.warn('LinkedIn login wall on company page - returning partial data');
                return {
                    name: params.company_name,
                    linkedin_url: companyUrl,
                    industry: null,
                    employee_count: null,
                    website: null,
                    description: null,
                };
            }
            // Extract company data
            const result = {
                name: params.company_name,
                linkedin_url: companyUrl,
                industry: null,
                employee_count: null,
                website: null,
                description: null,
            };
            // Extract company name (more accurate from page)
            try {
                const nameElement = browser.page.locator('h1').first();
                const name = await nameElement.textContent();
                if (name) {
                    result.name = name.trim();
                }
            }
            catch (error) {
                logger.debug('Could not extract company name from page');
            }
            // Extract employee count
            try {
                const employeeText = await browser.page
                    .locator('text=/\\d+[,\\d]*\\s+(employees|employee)/i')
                    .first()
                    .textContent();
                if (employeeText) {
                    const match = employeeText.match(/([\\d,]+)\\s+(employees|employee)/i);
                    if (match) {
                        const countStr = match[1].replace(/,/g, '');
                        result.employee_count = parseInt(countStr, 10);
                    }
                }
            }
            catch (error) {
                logger.debug('Could not extract employee count');
            }
            // Extract industry
            try {
                // Look for industry in the about section
                const industryElement = browser.page.locator('text=/Industry/i').first();
                const parent = industryElement.locator('..');
                const industryText = await parent.textContent();
                if (industryText) {
                    const match = industryText.match(/Industry\\s*(.+)/i);
                    if (match) {
                        result.industry = match[1].trim();
                    }
                }
            }
            catch (error) {
                logger.debug('Could not extract industry');
            }
            // Extract website
            try {
                const websiteLink = browser.page.locator('a[href*="http"]:has-text("Website")').first();
                const href = await websiteLink.getAttribute('href');
                if (href && this.isValidUrl(href)) {
                    result.website = href;
                }
            }
            catch (error) {
                // Try alternative method
                try {
                    const websiteLink = browser.page
                        .locator('a[data-tracking-control-name*="website"]')
                        .first();
                    const href = await websiteLink.getAttribute('href');
                    if (href && this.isValidUrl(href)) {
                        result.website = href;
                    }
                }
                catch (innerError) {
                    logger.debug('Could not extract website');
                }
            }
            // Extract description/about
            try {
                const aboutSection = browser.page.locator('section:has-text("About")').first();
                const descElement = aboutSection.locator('p').first();
                const description = await descElement.textContent();
                if (description) {
                    result.description = description.trim().substring(0, 500); // Limit to 500 chars
                }
            }
            catch (error) {
                logger.debug('Could not extract description');
            }
            logger.info('LinkedIn company scrape completed', {
                name: result.name,
                employee_count: result.employee_count,
                has_website: !!result.website,
            });
            return result;
        }
        catch (error) {
            logger.error('Error during LinkedIn company scrape', {
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
//# sourceMappingURL=linkedin-company-scraper.js.map