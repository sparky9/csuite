/**
 * find_decision_makers tool implementation
 *
 * Finds decision makers (owners, managers, executives) at a specific company.
 * Uses LinkedIn scraper to find real decision makers.
 */
export declare function findDecisionMakersTool(args: unknown, dbConnected: boolean, userId?: string): Promise<{
    content: {
        type: string;
        text: string;
    }[];
}>;
//# sourceMappingURL=find-decision-makers.tool.d.ts.map