/**
 * Campaign scheduler
 * Processes scheduled sends, manages timing, respects business hours
 */

import { DateTime } from 'luxon';
import { db } from '../db/client.js';
import { logger } from '../utils/logger.js';
import { emailSender } from '../email/email-sender.js';
import { generatePersonalizedEmail } from '../ai/personalization.js';
import type {
  PendingSend,
  ProspectData,
  ScheduleParams,
  SendWindow,
} from '../types/email.types.js';

export class CampaignScheduler {
  /**
   * Process all pending scheduled sends
   */
  async processScheduledSends(): Promise<{
    processed: number;
    sent: number;
    failed: number;
    skipped: number;
  }> {
    try {
      logger.info('Starting scheduled send processing');

      // Get pending sends from view
      const pendingSends = await db.query<PendingSend>(
        'SELECT * FROM pending_sends LIMIT 100'
      );

      if (pendingSends.rows.length === 0) {
        logger.info('No pending sends to process');
        return { processed: 0, sent: 0, failed: 0, skipped: 0 };
      }

      let sent = 0;
      let failed = 0;
      let skipped = 0;

      for (const send of pendingSends.rows) {
        try {
          // Check if within sending window
          const window = await this.isWithinSendingWindow({
            campaign_id: send.campaign_id,
            prospect_id: send.prospect_id,
            sequence_order: send.current_sequence_order + 1,
            day_offset: 0, // Already calculated in next_send_at
            timezone: 'America/Chicago', // Will be loaded from campaign
            send_days: [1, 2, 3, 4, 5],
            send_hours_start: 9,
            send_hours_end: 17,
            enrolled_at: new Date(),
          });

          if (!window.is_within_window) {
            logger.debug('Send outside window, skipping', {
              campaign_prospect_id: send.campaign_prospect_id,
              reason: window.reason,
              next_available: window.next_available,
            });
            skipped++;
            continue;
          }

          // Get prospect data
          const prospect = await db.queryOne<ProspectData>(
            'SELECT * FROM prospects WHERE id = $1',
            [send.prospect_id]
          );

          if (!prospect) {
            logger.warn('Prospect not found', { prospect_id: send.prospect_id });
            failed++;
            continue;
          }

          // Generate personalized email
          const personalized = send.use_ai_enhancement
            ? await generatePersonalizedEmail({
                prospect,
                template: send.body_template,
                subject_line: send.subject_line,
                instructions: send.personalization_instructions,
              })
            : {
                subject: send.subject_line,
                body_html: send.body_template,
                body_plain: '',
              };

          // Send email
          await emailSender.sendEmail({
            to_email: prospect.email,
            to_name: prospect.name,
            from_email: send.from_email,
            from_name: send.from_name,
            subject_line: personalized.subject,
            body_html: personalized.body_html,
            body_plain: personalized.body_plain,
            campaign_id: send.campaign_id,
            sequence_id: send.sequence_id,
            prospect_id: send.prospect_id,
            tracking_enabled: send.tracking_enabled,
          });

          // Update campaign_prospect to next sequence
          await this.advanceCampaignProspect(
            send.campaign_prospect_id,
            send.current_sequence_order + 1
          );

          sent++;

          // Small delay between sends
          await this.delay(200);
        } catch (error: any) {
          logger.error('Failed to process scheduled send', {
            error: error.message,
            campaign_prospect_id: send.campaign_prospect_id,
          });
          failed++;
        }
      }

      logger.info('Scheduled send processing completed', {
        processed: pendingSends.rows.length,
        sent,
        failed,
        skipped,
      });

      return {
        processed: pendingSends.rows.length,
        sent,
        failed,
        skipped,
      };
    } catch (error) {
      logger.error('Scheduled send processing failed', { error });
      throw error;
    }
  }

  /**
   * Advance campaign prospect to next sequence
   */
  private async advanceCampaignProspect(
    campaignProspectId: string,
    newSequenceOrder: number
  ): Promise<void> {
    // Get the next sequence for this campaign
    const nextSequence = await db.queryOne<{ day_offset: number }>(
      `SELECT day_offset FROM email_sequences
       WHERE campaign_id = (SELECT campaign_id FROM campaign_prospects WHERE id = $1)
         AND sequence_order = $2`,
      [campaignProspectId, newSequenceOrder + 1]
    );

    if (nextSequence) {
      // Calculate next send time
      const nextSendAt = DateTime.now().plus({ days: nextSequence.day_offset }).toJSDate();

      await db.query(
        `UPDATE campaign_prospects
         SET current_sequence_order = $1,
             next_send_at = $2
         WHERE id = $3`,
        [newSequenceOrder, nextSendAt, campaignProspectId]
      );
    } else {
      // No more sequences, mark as completed
      await db.query(
        `UPDATE campaign_prospects
         SET current_sequence_order = $1,
             next_send_at = NULL,
             status = 'completed',
             completed_at = NOW()
         WHERE id = $2`,
        [newSequenceOrder, campaignProspectId]
      );
    }
  }

  /**
   * Calculate next send time for a campaign prospect
   */
  calculateNextSendTime(params: ScheduleParams): Date {
    const {
      day_offset,
      timezone,
      send_days,
      send_hours_start,
      send_hours_end,
      enrolled_at,
    } = params;

    // Start with the day offset from enrollment
    let nextSend = DateTime.fromJSDate(enrolled_at, { zone: timezone }).plus({
      days: day_offset,
    });

    // Set to a random time within send hours
    const randomHour =
      send_hours_start + Math.floor(Math.random() * (send_hours_end - send_hours_start));
    const randomMinute = Math.floor(Math.random() * 60);

    nextSend = nextSend.set({
      hour: randomHour,
      minute: randomMinute,
      second: 0,
      millisecond: 0,
    });

    // If not on a send day, move to next send day
    while (!send_days.includes(nextSend.weekday)) {
      nextSend = nextSend.plus({ days: 1 });
    }

    return nextSend.toJSDate();
  }

  /**
   * Check if current time is within sending window
   */
  async isWithinSendingWindow(params: ScheduleParams): Promise<SendWindow> {
    const { timezone, send_days, send_hours_start, send_hours_end } = params;

    const now = DateTime.now().setZone(timezone);
    const currentDay = now.weekday; // 1 = Monday, 7 = Sunday
    const currentHour = now.hour;

    // Check if today is a send day
    if (!send_days.includes(currentDay)) {
      // Find next send day
      const nextSendDay = this.findNextSendDay(currentDay, send_days, timezone);
      return {
        is_within_window: false,
        next_available: nextSendDay,
        reason: 'Not a configured send day',
      };
    }

    // Check if within send hours
    if (currentHour < send_hours_start || currentHour >= send_hours_end) {
      let nextAvailable: DateTime;

      if (currentHour < send_hours_start) {
        // Later today
        nextAvailable = now.set({ hour: send_hours_start, minute: 0, second: 0 });
      } else {
        // Next send day
        const nextSendDay = this.findNextSendDay(currentDay, send_days, timezone);
        nextAvailable = DateTime.fromJSDate(nextSendDay, { zone: timezone });
      }

      return {
        is_within_window: false,
        next_available: nextAvailable.toJSDate(),
        reason: 'Outside configured send hours',
      };
    }

    return {
      is_within_window: true,
    };
  }

  /**
   * Find next send day
   */
  private findNextSendDay(currentDay: number, sendDays: number[], timezone: string): Date {
    let next = DateTime.now().setZone(timezone).plus({ days: 1 });

    // Find next available send day
    while (!sendDays.includes(next.weekday)) {
      next = next.plus({ days: 1 });
    }

    // Set to start of send hours
    return next.set({ hour: 9, minute: 0, second: 0, millisecond: 0 }).toJSDate();
  }

  /**
   * Enroll prospects in campaign
   */
  async enrollProspectsInCampaign(
    campaignId: string,
    prospectIds: string[]
  ): Promise<number> {
    try {
      // Get campaign details
      const campaign = await db.queryOne<{
        send_days_of_week: number[];
        send_hours_start: number;
        send_hours_end: number;
        send_timezone: string;
      }>('SELECT * FROM campaigns WHERE id = $1', [campaignId]);

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      let enrolled = 0;

      for (const prospectId of prospectIds) {
        // Check if already enrolled
        const existing = await db.queryOne(
          'SELECT id FROM campaign_prospects WHERE campaign_id = $1 AND prospect_id = $2',
          [campaignId, prospectId]
        );

        if (existing) {
          logger.debug('Prospect already enrolled', { prospect_id: prospectId });
          continue;
        }

        // Get first sequence
        const firstSequence = await db.queryOne<{ day_offset: number }>(
          `SELECT day_offset FROM email_sequences
           WHERE campaign_id = $1 AND sequence_order = 1
           ORDER BY sequence_order ASC LIMIT 1`,
          [campaignId]
        );

        if (!firstSequence) {
          logger.warn('No sequences found for campaign', { campaign_id: campaignId });
          continue;
        }

        // Calculate first send time
        const nextSendAt = this.calculateNextSendTime({
          campaign_id: campaignId,
          prospect_id: prospectId,
          sequence_order: 1,
          day_offset: firstSequence.day_offset,
          timezone: campaign.send_timezone,
          send_days: campaign.send_days_of_week,
          send_hours_start: campaign.send_hours_start,
          send_hours_end: campaign.send_hours_end,
          enrolled_at: new Date(),
        });

        // Enroll prospect
        await db.query(
          `INSERT INTO campaign_prospects (
            campaign_id, prospect_id, current_sequence_order, next_send_at, status
          ) VALUES ($1, $2, 0, $3, 'active')`,
          [campaignId, prospectId, nextSendAt]
        );

        enrolled++;
      }

      // Update campaign total_prospects count
      await db.query(
        `UPDATE campaigns
         SET total_prospects = (
           SELECT COUNT(*) FROM campaign_prospects WHERE campaign_id = $1
         )
         WHERE id = $1`,
        [campaignId]
      );

      logger.info('Prospects enrolled in campaign', {
        campaign_id: campaignId,
        enrolled,
        total_prospects: prospectIds.length,
      });

      return enrolled;
    } catch (error) {
      logger.error('Failed to enroll prospects', { error, campaign_id: campaignId });
      throw error;
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const campaignScheduler = new CampaignScheduler();
