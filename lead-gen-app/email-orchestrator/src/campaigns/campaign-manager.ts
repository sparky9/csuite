/**
 * Campaign management
 * Create, update, start, stop campaigns
 */

import { db } from '../db/client.js';
import { logger } from '../utils/logger.js';
import { campaignScheduler } from './scheduler.js';
import type {
  Campaign,
  CreateCampaignParams,
  CreateSequenceParams,
  CampaignStatus,
} from '../types/email.types.js';

export class CampaignManager {
  /**
   * Create a new campaign
   */
  async createCampaign(params: CreateCampaignParams): Promise<Campaign> {
    try {
      const {
        name,
        description,
        from_email,
        from_name,
        target_prospect_ids,
        target_tags,
        target_status,
        send_days_of_week,
        send_hours_start,
        send_hours_end,
        send_timezone,
        tracking_enabled,
      } = params;

      const result = await db.query<Campaign>(
        `INSERT INTO campaigns (
          name, description, from_email, from_name,
          target_prospect_ids, target_tags, target_status,
          send_days_of_week, send_hours_start, send_hours_end, send_timezone,
          tracking_enabled, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'draft')
        RETURNING *`,
        [
          name,
          description || null,
          from_email,
          from_name || null,
          target_prospect_ids || null,
          target_tags || null,
          target_status || null,
          send_days_of_week || [1, 2, 3, 4, 5],
          send_hours_start || 9,
          send_hours_end || 17,
          send_timezone || 'America/Chicago',
          tracking_enabled !== undefined ? tracking_enabled : true,
        ]
      );

      const campaign = result.rows[0];

      logger.info('Campaign created', {
        campaign_id: campaign.id,
        name: campaign.name,
      });

      return campaign;
    } catch (error) {
      logger.error('Failed to create campaign', { error });
      throw error;
    }
  }

  /**
   * Add email sequence to campaign
   */
  async addSequence(params: CreateSequenceParams): Promise<void> {
    try {
      await db.query(
        `INSERT INTO email_sequences (
          campaign_id, sequence_order, day_offset,
          template_id, subject_line, subject_variants, body_template,
          personalization_instructions, use_ai_enhancement
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          params.campaign_id,
          params.sequence_order,
          params.day_offset,
          params.template_id || null,
          params.subject_line,
          params.subject_variants || null,
          params.body_template,
          params.personalization_instructions || null,
          params.use_ai_enhancement !== undefined ? params.use_ai_enhancement : true,
        ]
      );

      logger.info('Sequence added to campaign', {
        campaign_id: params.campaign_id,
        sequence_order: params.sequence_order,
      });
    } catch (error) {
      logger.error('Failed to add sequence', { error });
      throw error;
    }
  }

  /**
   * Start a campaign
   */
  async startCampaign(campaignId: string): Promise<number> {
    try {
      // Check if campaign has sequences
      const sequenceCount = await db.queryOne<{ count: string }>(
        'SELECT COUNT(*) as count FROM email_sequences WHERE campaign_id = $1',
        [campaignId]
      );

      if (!sequenceCount || parseInt(sequenceCount.count) === 0) {
        throw new Error('Campaign must have at least one email sequence');
      }

      // Get campaign target criteria
      const campaign = await db.queryOne<{
        target_prospect_ids: string[] | null;
        target_tags: string[] | null;
        target_status: string | null;
      }>('SELECT target_prospect_ids, target_tags, target_status FROM campaigns WHERE id = $1', [
        campaignId,
      ]);

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Find matching prospects
      let prospectIds: string[] = [];

      if (campaign.target_prospect_ids && campaign.target_prospect_ids.length > 0) {
        // Use specific prospect IDs
        prospectIds = campaign.target_prospect_ids;
      } else {
        // Query prospects based on criteria
        const conditions: string[] = [];
        const values: any[] = [];
        let paramCount = 0;

        if (campaign.target_tags && campaign.target_tags.length > 0) {
          paramCount++;
          conditions.push(`tags && $${paramCount}`);
          values.push(campaign.target_tags);
        }

        if (campaign.target_status) {
          paramCount++;
          conditions.push(`status = $${paramCount}`);
          values.push(campaign.target_status);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const prospects = await db.query<{ id: string }>(
          `SELECT id FROM prospects ${whereClause}`,
          values
        );

        prospectIds = prospects.rows.map((p) => p.id);
      }

      if (prospectIds.length === 0) {
        throw new Error('No prospects match campaign criteria');
      }

      // Enroll prospects
      const enrolledCount = await campaignScheduler.enrollProspectsInCampaign(
        campaignId,
        prospectIds
      );

      // Update campaign status
      await db.query(
        `UPDATE campaigns
         SET status = 'active',
             started_at = NOW()
         WHERE id = $1`,
        [campaignId]
      );

      logger.info('Campaign started', {
        campaign_id: campaignId,
        enrolled_prospects: enrolledCount,
      });

      return enrolledCount;
    } catch (error) {
      logger.error('Failed to start campaign', { error, campaign_id: campaignId });
      throw error;
    }
  }

  /**
   * Update campaign status
   */
  async updateCampaignStatus(campaignId: string, status: CampaignStatus): Promise<void> {
    try {
      await db.query('UPDATE campaigns SET status = $1, updated_at = NOW() WHERE id = $2', [
        status,
        campaignId,
      ]);

      logger.info('Campaign status updated', {
        campaign_id: campaignId,
        status,
      });
    } catch (error) {
      logger.error('Failed to update campaign status', { error, campaign_id: campaignId });
      throw error;
    }
  }

  /**
   * Get campaign details
   */
  async getCampaign(campaignId: string): Promise<Campaign | null> {
    return await db.queryOne<Campaign>('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
  }

  /**
   * Get campaign sequences
   */
  async getCampaignSequences(campaignId: string) {
    return await db.query(
      'SELECT * FROM email_sequences WHERE campaign_id = $1 ORDER BY sequence_order ASC',
      [campaignId]
    );
  }

  /**
   * Update campaign stats
   */
  async updateCampaignStats(campaignId: string): Promise<void> {
    try {
      await db.query('SELECT update_campaign_stats($1)', [campaignId]);
      logger.debug('Campaign stats updated', { campaign_id: campaignId });
    } catch (error) {
      logger.error('Failed to update campaign stats', { error, campaign_id: campaignId });
    }
  }

  /**
   * Delete campaign
   */
  async deleteCampaign(campaignId: string): Promise<void> {
    try {
      await db.query('DELETE FROM campaigns WHERE id = $1', [campaignId]);
      logger.info('Campaign deleted', { campaign_id: campaignId });
    } catch (error) {
      logger.error('Failed to delete campaign', { error, campaign_id: campaignId });
      throw error;
    }
  }
}

// Export singleton instance
export const campaignManager = new CampaignManager();
