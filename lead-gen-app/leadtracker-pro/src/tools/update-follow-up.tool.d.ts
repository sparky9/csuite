/**
 * Update Follow-up Tool
 * Reschedule or adjust an existing follow-up reminder
 */
export declare function updateFollowUpTool(
  args: any,
  dbConnected?: boolean,
  userId?: string
): Promise<
  | {
      content: {
        type: string;
        text: string;
      }[];
      isError?: undefined;
    }
  | {
      content: {
        type: string;
        text: string;
      }[];
      isError: boolean;
    }
>;
//# sourceMappingURL=update-follow-up.tool.d.ts.map
