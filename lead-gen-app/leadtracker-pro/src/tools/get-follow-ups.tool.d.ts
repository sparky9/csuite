/**
 * Get Follow-ups Tool
 * Retrieve pending and overdue follow-up reminders
 */
export declare function getFollowUpsTool(args: any, dbConnected?: boolean, userId?: string): Promise<{
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
//# sourceMappingURL=get-follow-ups.tool.d.ts.map