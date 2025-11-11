/**
 * Get Pipeline Stats Tool
 * Retrieve pipeline metrics, conversion rates, and revenue data
 */
export declare function getPipelineStatsTool(args: any, dbConnected?: boolean, userId?: string): Promise<{
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
//# sourceMappingURL=get-pipeline-stats.tool.d.ts.map