/**
 * Import Prospects Tool
 * Import prospects from ProspectFinder JSON exports
 */
export declare function importProspectsTool(args: any, dbConnected?: boolean, userId?: string): Promise<{
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
//# sourceMappingURL=import-prospects.tool.d.ts.map