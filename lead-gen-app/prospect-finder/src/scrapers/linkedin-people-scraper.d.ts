/**
 * LinkedIn People Scraper
 *
 * Searches LinkedIn for people at a specific company with target job titles.
 * IMPORTANT: LinkedIn has VERY aggressive bot detection - use sparingly.
 */
import { BaseScraper } from './base-scraper.js';
import { BrowserInstance } from '../types/scraper.types.js';
import { LinkedInPersonResult } from '../types/prospect.types.js';
export interface LinkedInPeopleSearchParams {
    company_name: string;
    job_titles?: string[];
    max_results?: number;
}
export declare class LinkedInPeopleScraper extends BaseScraper<LinkedInPeopleSearchParams, LinkedInPersonResult[]> {
    protected validateParams(params: LinkedInPeopleSearchParams): boolean;
    protected getRateLimitSource(): 'linkedin_people';
    protected performScrape(params: LinkedInPeopleSearchParams, browser: BrowserInstance): Promise<LinkedInPersonResult[]>;
}
//# sourceMappingURL=linkedin-people-scraper.d.ts.map