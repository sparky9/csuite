/**
 * Auto-pause logic for campaigns
 * Automatically pauses prospects when they reply or engage
 */
import { db } from '../db/client.js';
import { logger } from '../utils/logger.js';
/**
 * Pause campaign prospect (e.g., when they reply)
 */
export async function pauseCampaignProspect(prospectId, campaignId, reason) {
    try {
        await db.query(`UPDATE campaign_prospects
       SET status = 'paused',
           paused_reason = $1
       WHERE prospect_id = $2 AND campaign_id = $3 AND status = 'active'`, [reason, prospectId, campaignId]);
        logger.info('Campaign prospect paused', {
            prospect_id: prospectId,
            campaign_id: campaignId,
            reason,
        });
    }
    catch (error) {
        logger.error('Failed to pause campaign prospect', {
            error,
            prospect_id: prospectId,
            campaign_id: campaignId,
        });
        throw error;
    }
}
/**
 * Mark prospect as replied and auto-pause
 */
export async function handleProspectReply(prospectId, campaignId, sentEmailId) {
    try {
        // Update campaign_prospect
        await db.query(`UPDATE campaign_prospects
       SET replied = TRUE,
           replied_at = NOW(),
           status = 'paused',
           paused_reason = 'Prospect replied'
       WHERE prospect_id = $1 AND campaign_id = $2`, [prospectId, campaignId]);
        // Update campaign stats
        await db.query(`UPDATE campaigns
       SET emails_replied = emails_replied + 1
       WHERE id = $1`, [campaignId]);
        logger.info('Prospect reply recorded and campaign auto-paused', {
            prospect_id: prospectId,
            campaign_id: campaignId,
            sent_email_id: sentEmailId,
        });
    }
    catch (error) {
        logger.error('Failed to handle prospect reply', {
            error,
            prospect_id: prospectId,
            campaign_id: campaignId,
        });
        throw error;
    }
}
/**
 * Resume paused campaign prospect
 */
export async function resumeCampaignProspect(prospectId, campaignId) {
    try {
        // Calculate next send time based on current sequence
        const campaignProspect = await db.queryOne(`SELECT current_sequence_order FROM campaign_prospects
       WHERE prospect_id = $1 AND campaign_id = $2`, [prospectId, campaignId]);
        if (!campaignProspect) {
            throw new Error('Campaign prospect not found');
        }
        // Get next sequence
        const nextSequence = await db.queryOne(`SELECT day_offset FROM email_sequences
       WHERE campaign_id = $1 AND sequence_order = $2`, [campaignId, campaignProspect.current_sequence_order + 1]);
        if (!nextSequence) {
            throw new Error('No more sequences available');
        }
        // Calculate next send time (1 day from now by default)
        const nextSendAt = new Date();
        nextSendAt.setDate(nextSendAt.getDate() + (nextSequence.day_offset || 1));
        await db.query(`UPDATE campaign_prospects
       SET status = 'active',
           paused_reason = NULL,
           next_send_at = $1
       WHERE prospect_id = $2 AND campaign_id = $3`, [nextSendAt, prospectId, campaignId]);
        logger.info('Campaign prospect resumed', {
            prospect_id: prospectId,
            campaign_id: campaignId,
            next_send_at: nextSendAt,
        });
    }
    catch (error) {
        logger.error('Failed to resume campaign prospect', {
            error,
            prospect_id: prospectId,
            campaign_id: campaignId,
        });
        throw error;
    }
}
/**
 * Auto-pause all prospects in a campaign
 */
export async function pauseCampaign(campaignId, reason) {
    try {
        const result = await db.query(`UPDATE campaign_prospects
       SET status = 'paused',
           paused_reason = $1
       WHERE campaign_id = $2 AND status = 'active'`, [reason, campaignId]);
        const pausedCount = result.rowCount || 0;
        // Update campaign status
        await db.query(`UPDATE campaigns SET status = 'paused' WHERE id = $1`, [campaignId]);
        logger.info('Campaign paused', {
            campaign_id: campaignId,
            paused_prospects: pausedCount,
            reason,
        });
        return pausedCount;
    }
    catch (error) {
        logger.error('Failed to pause campaign', { error, campaign_id: campaignId });
        throw error;
    }
}
/**
 * Resume all paused prospects in a campaign
 */
export async function resumeCampaign(campaignId) {
    try {
        // Resume campaign status
        await db.query(`UPDATE campaigns SET status = 'active' WHERE id = $1`, [campaignId]);
        // Get all paused prospects
        const pausedProspects = await db.query(`SELECT id, prospect_id, current_sequence_order FROM campaign_prospects
       WHERE campaign_id = $1 AND status = 'paused'`, [campaignId]);
        let resumedCount = 0;
        for (const cp of pausedProspects.rows) {
            try {
                // Get next sequence
                const nextSequence = await db.queryOne(`SELECT day_offset FROM email_sequences
           WHERE campaign_id = $1 AND sequence_order = $2`, [campaignId, cp.current_sequence_order + 1]);
                if (nextSequence) {
                    // Calculate next send time
                    const nextSendAt = new Date();
                    nextSendAt.setDate(nextSendAt.getDate() + (nextSequence.day_offset || 1));
                    await db.query(`UPDATE campaign_prospects
             SET status = 'active',
                 paused_reason = NULL,
                 next_send_at = $1
             WHERE id = $2`, [nextSendAt, cp.id]);
                    resumedCount++;
                }
            }
            catch (error) {
                logger.error('Failed to resume individual prospect', {
                    error,
                    prospect_id: cp.prospect_id,
                });
            }
        }
        logger.info('Campaign resumed', {
            campaign_id: campaignId,
            resumed_prospects: resumedCount,
        });
        return resumedCount;
    }
    catch (error) {
        logger.error('Failed to resume campaign', { error, campaign_id: campaignId });
        throw error;
    }
}
/**
 * Check for bounced emails and auto-pause
 */
export async function handleBounce(sentEmailId, bounceReason) {
    try {
        // Get email details
        const sentEmail = await db.queryOne('SELECT prospect_id, campaign_id FROM sent_emails WHERE id = $1', [sentEmailId]);
        if (!sentEmail || !sentEmail.prospect_id || !sentEmail.campaign_id) {
            return;
        }
        // Mark as bounced
        await db.query(`UPDATE sent_emails
       SET status = 'bounced', bounce_reason = $1
       WHERE id = $2`, [bounceReason, sentEmailId]);
        // Pause campaign prospect
        await pauseCampaignProspect(sentEmail.prospect_id, sentEmail.campaign_id, `Email bounced: ${bounceReason}`);
        // Update campaign stats
        await db.query(`UPDATE campaigns SET emails_bounced = emails_bounced + 1 WHERE id = $1`, [sentEmail.campaign_id]);
        logger.info('Bounce handled and prospect paused', {
            sent_email_id: sentEmailId,
            prospect_id: sentEmail.prospect_id,
            campaign_id: sentEmail.campaign_id,
            bounce_reason: bounceReason,
        });
    }
    catch (error) {
        logger.error('Failed to handle bounce', { error, sent_email_id: sentEmailId });
    }
}
//# sourceMappingURL=auto-pause.js.map