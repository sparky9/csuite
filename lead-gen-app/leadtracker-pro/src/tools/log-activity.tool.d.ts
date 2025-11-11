/**
 * Log Activity Tool
 * Record calls, emails, meetings, and notes
 */
export declare function logActivityTool(args: any, dbConnected?: boolean, userId?: string): Promise<{
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
//# sourceMappingURL=log-activity.tool.d.ts.map