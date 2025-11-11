/**
 * Add Contact Tool
 * Create a new contact for a prospect
 */
export declare function addContactTool(args: any, dbConnected?: boolean, userId?: string): Promise<{
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
//# sourceMappingURL=add-contact.tool.d.ts.map