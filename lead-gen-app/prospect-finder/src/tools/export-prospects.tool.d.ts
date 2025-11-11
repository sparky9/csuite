/**
 * export_prospects tool implementation
 *
 * Exports prospect data for outreach in various formats (CSV, JSON, Google Sheets).
 * Includes filtering by quality score, industry, location, and decision makers.
 */
export declare function exportProspectsTool(args: unknown, dbConnected: boolean, userId?: string): Promise<{
    content: {
        type: string;
        text: string;
    }[];
}>;
//# sourceMappingURL=export-prospects.tool.d.ts.map