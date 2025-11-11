/**
 * Auto-pause logic for campaigns
 * Automatically pauses prospects when they reply or engage
 */
/**
 * Pause campaign prospect (e.g., when they reply)
 */
export declare function pauseCampaignProspect(prospectId: string, campaignId: string, reason: string): Promise<void>;
/**
 * Mark prospect as replied and auto-pause
 */
export declare function handleProspectReply(prospectId: string, campaignId: string, sentEmailId?: string): Promise<void>;
/**
 * Resume paused campaign prospect
 */
export declare function resumeCampaignProspect(prospectId: string, campaignId: string): Promise<void>;
/**
 * Auto-pause all prospects in a campaign
 */
export declare function pauseCampaign(campaignId: string, reason: string): Promise<number>;
/**
 * Resume all paused prospects in a campaign
 */
export declare function resumeCampaign(campaignId: string): Promise<number>;
/**
 * Check for bounced emails and auto-pause
 */
export declare function handleBounce(sentEmailId: string, bounceReason: string): Promise<void>;
//# sourceMappingURL=auto-pause.d.ts.map