/**
 * Email sending orchestration
 * Handles quota management, compliance, tracking, and delivery
 */

import { gmailClient } from './gmail-client.js';
import { smtpClient } from './smtp-client.js';
import { db } from '../db/client.js';
import { logger } from '../utils/logger.js';
import {
  addCompliantFooter,
  htmlToPlainText,
  isUnsubscribed,
} from '../utils/compliance.js';
import { createTrackingPixel } from './tracking.js';
import type {
  EmailProvider,
  EmailQuotaStatus,
  GmailSendParams,
  SendEmailParams,
  SentEmail,
} from '../types/email.types.js';

export class EmailSender {
  /**
   * Send an email with full orchestration
   */
  async sendEmail(params: SendEmailParams): Promise<SentEmail> {
    const {
      to_email,
      to_name,
      from_email,
      from_name,
      subject_line,
      body_html,
      body_plain,
      campaign_id,
      sequence_id,
      prospect_id,
      tracking_enabled = true,
    } = params;

    const provider = this.resolveProvider(params.provider);

    try {
      // Check if email is unsubscribed
      if (await isUnsubscribed(to_email)) {
        throw new Error(`Email ${to_email} has unsubscribed`);
      }

      // Ensure provider client is ready
      await this.ensureProviderInitialized(provider);

      // Check provider quota
      const quota = await this.getQuotaStatus(provider);
      if (!quota.can_send) {
        throw this.createQuotaError(provider, quota);
      }

      // Create sent_email record (queued status)
      const trackingPixelId = tracking_enabled ? this.generateTrackingId() : undefined;

      const sentEmailResult = await db.query<{ id: string }>(
        `INSERT INTO sent_emails (
          campaign_id, sequence_id, prospect_id,
          from_email, from_name, to_email, to_name,
          subject_line, body_html, body_plain,
          status, provider, tracking_pixel_id, tracking_enabled
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id`,
        [
          campaign_id || null,
          sequence_id || null,
          prospect_id || null,
          from_email,
          from_name || null,
          to_email,
          to_name || null,
          subject_line,
          body_html,
          body_plain || htmlToPlainText(body_html),
          'queued',
          provider,
          trackingPixelId,
          tracking_enabled,
        ]
      );

      const sentEmailId = sentEmailResult.rows[0].id;

      // Add compliant footer
      let finalHtml = body_html;
      finalHtml = await addCompliantFooter(finalHtml, sentEmailId);

      // Add tracking pixel if enabled
      if (tracking_enabled && trackingPixelId) {
        finalHtml = createTrackingPixel(finalHtml, trackingPixelId);
      }

      const finalPlainText = body_plain || htmlToPlainText(finalHtml);

      // Update sent_email with final content
      await db.query(
        `UPDATE sent_emails SET body_html = $1, body_plain = $2 WHERE id = $3`,
        [finalHtml, finalPlainText, sentEmailId]
      );

      // Send via configured provider
      const fromAddress = from_name ? `"${from_name}" <${from_email}>` : from_email;
      const toAddress = to_name ? `"${to_name}" <${to_email}>` : to_email;

      const result = await this.sendViaProvider(provider, {
        from: fromAddress,
        to: toAddress,
        subject: subject_line,
        html: finalHtml,
        text: finalPlainText,
      });

      // Update sent_email with success
      await db.query(
        `UPDATE sent_emails
         SET status = 'sent',
             sent_at = NOW(),
             provider_message_id = $1
         WHERE id = $2`,
        [result.messageId, sentEmailId]
      );

      // Update campaign_prospects if part of campaign
      if (campaign_id && prospect_id) {
        await db.query(
          `UPDATE campaign_prospects
           SET emails_sent = emails_sent + 1
           WHERE campaign_id = $1 AND prospect_id = $2`,
          [campaign_id, prospect_id]
        );
      }

      logger.info('Email sent successfully', {
        sent_email_id: sentEmailId,
        to: to_email,
        campaign_id,
        provider,
        provider_message_id: result.messageId,
      });

      // Fetch and return the sent email
      const sentEmail = await db.queryOne<SentEmail>(
        'SELECT * FROM sent_emails WHERE id = $1',
        [sentEmailId]
      );

      return sentEmail!;
    } catch (error: any) {
      logger.error('Failed to send email', {
        error: error.message,
        to: to_email,
        campaign_id,
        provider,
      });

      // If we created a sent_email record, update it with error
      if (error.sentEmailId) {
        await db.query(
          `UPDATE sent_emails
           SET status = 'failed',
               error_message = $1
           WHERE id = $2`,
          [error.message, error.sentEmailId]
        );
      }

      throw error;
    }
  }

  /**
   * Send batch of emails (respects rate limits)
   */
  async sendBatch(emails: SendEmailParams[]): Promise<{
    sent: SentEmail[];
    failed: Array<{ email: SendEmailParams; error: string }>;
    skipped: number;
  }> {
    const sent: SentEmail[] = [];
    const failed: Array<{ email: SendEmailParams; error: string }> = [];
    let skipped = 0;

    for (const emailParams of emails) {
      try {
        const sentEmail = await this.sendEmail(emailParams);
        sent.push(sentEmail);

        // Small delay between sends (100ms)
        await this.delay(100);
      } catch (error: any) {
        if (error?.code === 'QUOTA_EXCEEDED') {
          const provider = (error?.provider as EmailProvider | undefined) ??
            this.resolveProvider(emailParams.provider);
          logger.warn('Email quota reached, stopping batch send', {
            provider,
            wait_until: error.waitUntil,
          });
          skipped = emails.length - sent.length - failed.length;
          break;
        }

        failed.push({
          email: emailParams,
          error: error.message,
        });
      }
    }

    logger.info('Batch send completed', {
      total: emails.length,
      sent: sent.length,
      failed: failed.length,
      skipped,
    });

    return { sent, failed, skipped };
  }

  private resolveProvider(provider?: EmailProvider | string): EmailProvider {
    if (provider === 'smtp') {
      return 'smtp';
    }

    if (provider === 'gmail') {
      return 'gmail';
    }

    const envProvider = process.env.EMAIL_PROVIDER?.toLowerCase();
    return envProvider === 'smtp' ? 'smtp' : 'gmail';
  }

  private async ensureProviderInitialized(provider: EmailProvider): Promise<void> {
    if (provider === 'smtp') {
      await smtpClient.initialize();
      return;
    }

    if (!gmailClient.isAuthenticated()) {
      await gmailClient.initialize();
    }
  }

  private async getQuotaStatus(provider: EmailProvider): Promise<EmailQuotaStatus> {
    return provider === 'smtp'
      ? smtpClient.getQuotaStatus()
      : gmailClient.getQuotaStatus();
  }

  private async sendViaProvider(
    provider: EmailProvider,
    payload: GmailSendParams
  ): Promise<{ messageId: string }> {
    return provider === 'smtp'
      ? smtpClient.sendEmail(payload)
      : gmailClient.sendEmail(payload);
  }

  private createQuotaError(provider: EmailProvider, quota: EmailQuotaStatus): Error {
    const providerLabel = provider === 'smtp' ? 'SMTP' : 'Gmail';
    const waitUntil = quota.wait_until?.toISOString() || 'later';
    const error = new Error(`${providerLabel} quota exceeded. Wait until ${waitUntil}`);
    (error as any).code = 'QUOTA_EXCEEDED';
    (error as any).provider = provider;
    (error as any).waitUntil = quota.wait_until;
    return error;
  }

  /**
   * Generate unique tracking ID
   */
  private generateTrackingId(): string {
    return `trk_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const emailSender = new EmailSender();
