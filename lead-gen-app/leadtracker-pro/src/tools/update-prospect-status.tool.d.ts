/**
 * Update Prospect Status Tool
 * Update the pipeline status of a prospect
 */
export declare function updateProspectStatusTool(args: any, dbConnected?: boolean, userId?: string): Promise<{
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
//# sourceMappingURL=update-prospect-status.tool.d.ts.map