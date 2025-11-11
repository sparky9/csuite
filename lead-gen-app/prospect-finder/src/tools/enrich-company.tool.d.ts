/**
 * enrich_company tool implementation
 *
 * Enriches a company record with additional data from LinkedIn and website.
 * Uses LinkedIn company scraper and website scraper to gather real data.
 */
export declare function enrichCompanyTool(args: unknown, dbConnected: boolean, userId?: string): Promise<{
    content: {
        type: string;
        text: string;
    }[];
}>;
//# sourceMappingURL=enrich-company.tool.d.ts.map