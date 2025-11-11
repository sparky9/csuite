/**
 * Campaign scheduler
 * Processes scheduled sends, manages timing, respects business hours
 */
import type { ScheduleParams, SendWindow } from '../types/email.types.js';
export declare class CampaignScheduler {
    /**
     * Process all pending scheduled sends
     */
    processScheduledSends(): Promise<{
        processed: number;
        sent: number;
        failed: number;
        skipped: number;
    }>;
    /**
     * Advance campaign prospect to next sequence
     */
    private advanceCampaignProspect;
    /**
     * Calculate next send time for a campaign prospect
     */
    calculateNextSendTime(params: ScheduleParams): Date;
    /**
     * Check if current time is within sending window
     */
    isWithinSendingWindow(params: ScheduleParams): Promise<SendWindow>;
    /**
     * Find next send day
     */
    private findNextSendDay;
    /**
     * Enroll prospects in campaign
     */
    enrollProspectsInCampaign(campaignId: string, prospectIds: string[]): Promise<number>;
    /**
     * Delay helper
     */
    private delay;
}
export declare const campaignScheduler: CampaignScheduler;
//# sourceMappingURL=scheduler.d.ts.map