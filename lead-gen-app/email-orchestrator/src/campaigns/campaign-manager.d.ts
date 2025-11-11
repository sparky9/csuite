/**
 * Campaign management
 * Create, update, start, stop campaigns
 */
import type { Campaign, CreateCampaignParams, CreateSequenceParams, CampaignStatus } from '../types/email.types.js';
export declare class CampaignManager {
    /**
     * Create a new campaign
     */
    createCampaign(params: CreateCampaignParams): Promise<Campaign>;
    /**
     * Add email sequence to campaign
     */
    addSequence(params: CreateSequenceParams): Promise<void>;
    /**
     * Start a campaign
     */
    startCampaign(campaignId: string): Promise<number>;
    /**
     * Update campaign status
     */
    updateCampaignStatus(campaignId: string, status: CampaignStatus): Promise<void>;
    /**
     * Get campaign details
     */
    getCampaign(campaignId: string): Promise<Campaign | null>;
    /**
     * Get campaign sequences
     */
    getCampaignSequences(campaignId: string): Promise<import("pg").QueryResult<any>>;
    /**
     * Update campaign stats
     */
    updateCampaignStats(campaignId: string): Promise<void>;
    /**
     * Delete campaign
     */
    deleteCampaign(campaignId: string): Promise<void>;
}
export declare const campaignManager: CampaignManager;
//# sourceMappingURL=campaign-manager.d.ts.map