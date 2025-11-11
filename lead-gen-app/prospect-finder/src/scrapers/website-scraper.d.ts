/**
 * Website Scraper
 *
 * Extracts additional data from company websites:
 * - Contact emails
 * - Phone numbers
 * - Employee names (from team pages)
 * - Services offered
 */
import { BaseScraper } from './base-scraper.js';
import { BrowserInstance } from '../types/scraper.types.js';
export interface WebsiteScrapeParams {
    website_url: string;
}
export interface WebsiteScrapeResult {
    emails: string[];
    phones: string[];
    employee_names: string[];
    services: string[];
    social_links: {
        facebook?: string;
        twitter?: string;
        linkedin?: string;
        instagram?: string;
    };
}
export declare class WebsiteScraper extends BaseScraper<WebsiteScrapeParams, WebsiteScrapeResult> {
    protected validateParams(params: WebsiteScrapeParams): boolean;
    protected getRateLimitSource(): 'email_finder';
    protected performScrape(params: WebsiteScrapeParams, browser: BrowserInstance): Promise<WebsiteScrapeResult>;
    /**
     * Extract contact information (emails and phones)
     */
    private extractContactInfo;
    /**
     * Extract team member names
     */
    private extractTeamMembers;
    /**
     * Extract services offered
     */
    private extractServices;
    /**
     * Extract social media links
     */
    private extractSocialLinks;
}
//# sourceMappingURL=website-scraper.d.ts.map