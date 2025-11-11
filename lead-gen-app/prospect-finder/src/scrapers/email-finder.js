/**
 * Email Finder
 *
 * Finds/guesses emails for decision makers using three strategies:
 * 1. Pattern matching (common email formats)
 * 2. Website scraping (contact pages)
 * 3. Hunter.io API (if API key provided)
 */
import { BaseScraper } from './base-scraper.js';
import { logger } from '../utils/logger.js';
export class EmailFinder extends BaseScraper {
    hunterApiKey = null;
    constructor(browserPool, proxyManager, rateLimiter) {
        super(browserPool, proxyManager, rateLimiter);
        this.hunterApiKey = process.env.HUNTER_API_KEY || null;
    }
    validateParams(params) {
        return (typeof params.domain === 'string' &&
            params.domain.length > 0 &&
            this.extractDomain(params.domain) !== null);
    }
    getRateLimitSource() {
        return 'email_finder';
    }
    async performScrape(params, browser) {
        const results = [];
        const domain = this.extractDomain(params.domain) || params.domain;
        logger.info('Starting email finder', {
            domain,
            search_website: params.search_website,
            use_hunter_api: params.use_hunter_api && !!this.hunterApiKey,
            person_count: params.person_names?.length || 0,
        });
        try {
            // Strategy 1: Generate pattern-based emails if person names provided
            if (params.person_names && params.person_names.length > 0) {
                logger.debug('Generating pattern-based emails');
                for (const person of params.person_names) {
                    const patterns = this.generateEmailPatterns(person.first_name, person.last_name, domain);
                    for (const email of patterns) {
                        results.push({
                            email,
                            confidence: 'low', // Pattern guesses are low confidence until verified
                            source: 'pattern',
                            verified: false,
                        });
                    }
                }
            }
            // Strategy 2: Scrape website for emails
            if (params.search_website !== false) {
                logger.debug('Scraping website for emails');
                const websiteEmails = await this.scrapeWebsiteForEmails(domain, browser);
                for (const email of websiteEmails) {
                    // Check if already in results
                    const exists = results.find((r) => r.email.toLowerCase() === email.toLowerCase());
                    if (!exists) {
                        results.push({
                            email,
                            confidence: 'high', // Found on website = high confidence
                            source: 'website',
                            verified: true,
                        });
                    }
                    else {
                        // Upgrade confidence if found on website
                        exists.confidence = 'high';
                        exists.source = 'website';
                        exists.verified = true;
                    }
                }
            }
            // Strategy 3: Use Hunter.io API if available
            if (params.use_hunter_api !== false && this.hunterApiKey && params.person_names) {
                logger.debug('Using Hunter.io API for verification');
                for (const result of results) {
                    if (!result.verified) {
                        const hunterResult = await this.verifyEmailWithHunter(result.email);
                        if (hunterResult) {
                            result.verified = hunterResult.verified;
                            if (hunterResult.verified) {
                                result.confidence = 'high';
                                result.source = 'api';
                            }
                            else if (result.confidence === 'low') {
                                result.confidence = 'medium';
                            }
                        }
                    }
                }
            }
            // Add generic emails if no results found
            if (results.length === 0) {
                logger.debug('No emails found, adding generic patterns');
                const genericEmails = this.generateGenericEmails(domain);
                for (const email of genericEmails) {
                    results.push({
                        email,
                        confidence: 'low',
                        source: 'pattern',
                        verified: false,
                    });
                }
            }
            logger.info('Email finder completed', {
                domain,
                results_found: results.length,
                high_confidence: results.filter((r) => r.confidence === 'high').length,
            });
            return results;
        }
        catch (error) {
            logger.error('Error during email finding', {
                error: error.message,
                stack: error.stack,
            });
            throw error;
        }
    }
    /**
     * Generate common email patterns for a person
     */
    generateEmailPatterns(firstName, lastName, domain) {
        const first = firstName.toLowerCase().trim();
        const last = lastName.toLowerCase().trim();
        const patterns = [];
        // Common patterns
        patterns.push(`${first}@${domain}`); // john@example.com
        patterns.push(`${first}.${last}@${domain}`); // john.doe@example.com
        patterns.push(`${first}${last}@${domain}`); // johndoe@example.com
        patterns.push(`${first[0]}${last}@${domain}`); // jdoe@example.com
        patterns.push(`${first}_${last}@${domain}`); // john_doe@example.com
        patterns.push(`${last}@${domain}`); // doe@example.com
        // Validate and deduplicate
        const validPatterns = patterns.filter((email) => this.isValidEmail(email));
        return [...new Set(validPatterns)];
    }
    /**
     * Generate generic company emails
     */
    generateGenericEmails(domain) {
        return [
            `info@${domain}`,
            `contact@${domain}`,
            `sales@${domain}`,
            `hello@${domain}`,
            `support@${domain}`,
        ].filter((email) => this.isValidEmail(email));
    }
    /**
     * Scrape website for email addresses
     */
    async scrapeWebsiteForEmails(domain, browser) {
        const emails = new Set();
        const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/g;
        // Pages to check
        const pagesToCheck = [
            `https://${domain}`,
            `https://${domain}/contact`,
            `https://${domain}/contact-us`,
            `https://${domain}/about`,
            `https://${domain}/about-us`,
            `https://${domain}/team`,
            `https://${domain}/our-team`,
        ];
        for (const url of pagesToCheck) {
            try {
                logger.debug('Scraping page for emails', { url });
                await browser.page.goto(url, {
                    waitUntil: 'domcontentloaded',
                    timeout: 10000,
                });
                await this.randomDelay(1000, 2000);
                // Get page content
                const bodyText = await browser.page.locator('body').textContent();
                if (bodyText) {
                    // Find all emails in page text
                    const matches = bodyText.match(emailRegex);
                    if (matches) {
                        for (const email of matches) {
                            const cleanEmail = email.toLowerCase().trim();
                            // Filter out common false positives
                            if (this.isValidEmail(cleanEmail) &&
                                !cleanEmail.includes('@example.com') &&
                                !cleanEmail.includes('@domain.com') &&
                                !cleanEmail.endsWith('.png') &&
                                !cleanEmail.endsWith('.jpg') &&
                                cleanEmail.includes(domain)) {
                                emails.add(cleanEmail);
                            }
                        }
                    }
                }
                // Check mailto: links
                const mailtoLinks = await browser.page.locator('a[href^="mailto:"]').all();
                for (const link of mailtoLinks) {
                    try {
                        const href = await link.getAttribute('href');
                        if (href) {
                            const email = href.replace('mailto:', '').split('?')[0].toLowerCase().trim();
                            if (this.isValidEmail(email) && email.includes(domain)) {
                                emails.add(email);
                            }
                        }
                    }
                    catch (error) {
                        // Ignore individual link errors
                    }
                }
            }
            catch (error) {
                logger.debug('Could not scrape page for emails', {
                    url,
                    error: error.message,
                });
                // Continue to next page
            }
        }
        return Array.from(emails);
    }
    /**
     * Verify email using Hunter.io API
     */
    async verifyEmailWithHunter(email) {
        if (!this.hunterApiKey) {
            return null;
        }
        try {
            const url = `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${this.hunterApiKey}`;
            logger.debug('Verifying email with Hunter.io', { email });
            const response = await fetch(url);
            const data = await response.json();
            if (data.data) {
                const status = data.data.status;
                const verified = status === 'valid' || status === 'accept_all';
                logger.debug('Hunter.io verification result', {
                    email,
                    status,
                    verified,
                });
                return { verified };
            }
            return null;
        }
        catch (error) {
            logger.warn('Hunter.io API error', {
                email,
                error: error.message,
            });
            return null;
        }
    }
}
//# sourceMappingURL=email-finder.js.map