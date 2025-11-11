/**
 * LinkedIn Company Scraper
 *
 * Searches LinkedIn for company pages and extracts company data.
 * IMPORTANT: LinkedIn has aggressive bot detection - use with caution.
 */
import { BaseScraper } from './base-scraper.js';
import { BrowserInstance } from '../types/scraper.types.js';
import { LinkedInCompanyResult } from '../types/prospect.types.js';
export interface LinkedInCompanySearchParams {
    company_name: string;
}
export declare class LinkedInCompanyScraper extends BaseScraper<LinkedInCompanySearchParams, LinkedInCompanyResult | null> {
    protected validateParams(params: LinkedInCompanySearchParams): boolean;
    protected getRateLimitSource(): 'linkedin_company';
    protected performScrape(params: LinkedInCompanySearchParams, browser: BrowserInstance): Promise<LinkedInCompanyResult | null>;
}
//# sourceMappingURL=linkedin-company-scraper.d.ts.map