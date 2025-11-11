/**
 * get_scraping_stats tool implementation
 *
 * Returns statistics about scraping jobs, data quality, and system performance.
 * Useful for monitoring progress and troubleshooting.
 */
export declare function getScrapingStatsTool(args: unknown, dbConnected: boolean, userId?: string): Promise<{
    content: {
        type: string;
        text: string;
    }[];
}>;
//# sourceMappingURL=get-scraping-stats.tool.d.ts.map