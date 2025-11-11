/**
 * Add Prospect Tool
 * Create a new prospect in the CRM
 */
export declare function addProspectTool(args: any, dbConnected?: boolean, userId?: string): Promise<{
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
//# sourceMappingURL=add-prospect.tool.d.ts.map