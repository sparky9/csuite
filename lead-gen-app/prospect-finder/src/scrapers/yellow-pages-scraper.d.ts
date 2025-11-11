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
import { BrowserInstance } from '../types/scraper.types.js';
import { YellowPagesResult } from '../types/prospect.types.js';
export interface YellowPagesSearchParams {
    industry: string;
    location: string;
    max_results?: number;
    page?: number;
}
export declare class YellowPagesScraper extends BaseScraper<YellowPagesSearchParams, YellowPagesResult[]> {
    protected validateParams(params: YellowPagesSearchParams): boolean;
    protected getRateLimitSource(): 'yellow_pages';
    protected performScrape(params: YellowPagesSearchParams, browser: BrowserInstance): Promise<YellowPagesResult[]>;
    /**
     * Extract business listings from current page
     */
    private extractBusinessListings;
    /**
     * Check if there's a next page
     */
    private hasNextPage;
    /**
     * Navigate to next page
     */
    private goToNextPage;
}
//# sourceMappingURL=yellow-pages-scraper.d.ts.map