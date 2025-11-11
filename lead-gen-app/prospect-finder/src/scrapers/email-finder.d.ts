/**
 * Email Finder
 *
 * Finds/guesses emails for decision makers using three strategies:
 * 1. Pattern matching (common email formats)
 * 2. Website scraping (contact pages)
 * 3. Hunter.io API (if API key provided)
 */
import { BaseScraper } from './base-scraper.js';
import { BrowserInstance } from '../types/scraper.types.js';
import { EmailFinderResult } from '../types/prospect.types.js';
export interface EmailFinderParams {
    domain: string;
    person_names?: Array<{
        first_name: string;
        last_name: string;
    }>;
    search_website?: boolean;
    use_hunter_api?: boolean;
}
export declare class EmailFinder extends BaseScraper<EmailFinderParams, EmailFinderResult[]> {
    private hunterApiKey;
    constructor(browserPool: any, proxyManager: any, rateLimiter: any);
    protected validateParams(params: EmailFinderParams): boolean;
    protected getRateLimitSource(): 'email_finder';
    protected performScrape(params: EmailFinderParams, browser: BrowserInstance): Promise<EmailFinderResult[]>;
    /**
     * Generate common email patterns for a person
     */
    private generateEmailPatterns;
    /**
     * Generate generic company emails
     */
    private generateGenericEmails;
    /**
     * Scrape website for email addresses
     */
    private scrapeWebsiteForEmails;
    /**
     * Verify email using Hunter.io API
     */
    private verifyEmailWithHunter;
}
//# sourceMappingURL=email-finder.d.ts.map