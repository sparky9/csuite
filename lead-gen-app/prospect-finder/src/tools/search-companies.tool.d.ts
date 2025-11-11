/**
 * search_companies tool implementation
 *
 * Searches for B2B companies matching criteria (industry, location, size).
 * PRIORITY 1: Uses Yellow Pages scraper (superior B2B data)
 * FALLBACK: Google Maps scraper if Yellow Pages fails
 */
export declare function searchCompaniesTool(args: unknown, dbConnected: boolean, userId?: string): Promise<{
    content: {
        type: string;
        text: string;
    }[];
}>;
//# sourceMappingURL=search-companies.tool.d.ts.map