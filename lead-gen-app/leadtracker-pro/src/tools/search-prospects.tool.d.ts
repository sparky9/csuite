/**
 * Search Prospects Tool
 * Search and filter prospects with flexible criteria
 */
export declare function searchProspectsTool(args: any, dbConnected?: boolean, userId?: string): Promise<{
    content: {
        type: string;
        text: string;
    }[];
    isError?: undefined;
} | {
    content: {
        type: string;
        text: string;
    }[];
    isError: boolean;
}>;
//# sourceMappingURL=search-prospects.tool.d.ts.map