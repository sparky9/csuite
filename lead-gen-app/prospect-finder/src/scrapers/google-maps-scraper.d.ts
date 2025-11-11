/**
 * Google Maps Scraper
 *
 * Searches Google Maps for businesses by location + industry.
 * Extracts: name, phone, address, city, state, zip, website, rating, reviews, Google Maps URL.
 */
import { BaseScraper } from './base-scraper.js';
import { BrowserInstance } from '../types/scraper.types.js';
import { GoogleMapsResult } from '../types/prospect.types.js';
export interface GoogleMapsSearchParams {
    query: string;
    max_results?: number;
    min_rating?: number;
}
export declare class GoogleMapsScraper extends BaseScraper<GoogleMapsSearchParams, GoogleMapsResult[]> {
    protected validateParams(params: GoogleMapsSearchParams): boolean;
    protected getRateLimitSource(): 'google_maps';
    protected performScrape(params: GoogleMapsSearchParams, browser: BrowserInstance): Promise<GoogleMapsResult[]>;
    /**
     * Parse address into components
     */
    private parseAddress;
}
//# sourceMappingURL=google-maps-scraper.d.ts.map