/**
 * Email tracking system
 * Handles open tracking, click tracking, and event recording
 */

import { db } from '../db/client.js';
import { logger } from '../utils/logger.js';
import type { EmailTrackingEvent } from '../types/email.types.js';

/**
 * Create tracking pixel HTML
 */
export function createTrackingPixel(html: string, trackingPixelId: string): string {
  const trackingUrl = getTrackingPixelUrl(trackingPixelId);

  const pixelHtml = `<img src="${trackingUrl}" width="1" height="1" alt="" style="display:none;" />`;

  // Insert before closing body tag if it exists
  if (html.includes('</body>')) {
    return html.replace('</body>', `${pixelHtml}</body>`);
  }

  // Otherwise append to end
  return html + pixelHtml;
}

/**
 * Get tracking pixel URL
 */
export function getTrackingPixelUrl(trackingPixelId: string): string {
  const baseUrl = process.env.TRACKING_BASE_URL || 'https://example.com/track';
  return `${baseUrl}/open/${trackingPixelId}.png`;
}

/**
 * Wrap links with click tracking
 */
export function wrapLinksWithTracking(html: string, sentEmailId: string): string {
  // Find all <a href="..."> tags
  const linkRegex = /<a\s+([^>]*\s+)?href="([^"]+)"([^>]*)>/gi;

  return html.replace(linkRegex, (match, before, url, after) => {
    // Skip unsubscribe links and tracking URLs
    if (
      url.includes('/unsubscribe/') ||
      url.includes('/track/') ||
      url.startsWith('mailto:')
    ) {
      return match;
    }

    const trackingUrl = getClickTrackingUrl(sentEmailId, url);
    return `<a ${before || ''}href="${trackingUrl}"${after || ''}>`;
  });
}

/**
 * Get click tracking URL
 */
export function getClickTrackingUrl(sentEmailId: string, originalUrl: string): string {
  const baseUrl = process.env.TRACKING_BASE_URL || 'https://example.com/track';
  const encodedUrl = encodeURIComponent(originalUrl);
  return `${baseUrl}/click/${sentEmailId}?url=${encodedUrl}`;
}

/**
 * Record email tracking event
 */
export async function recordTrackingEvent(
  sentEmailId: string,
  eventType: EmailTrackingEvent,
  eventData?: {
    ip_address?: string;
    user_agent?: string;
    clicked_url?: string;
    [key: string]: any;
  }
): Promise<void> {
  try {
    await db.query(
      `INSERT INTO email_tracking (
        sent_email_id, event_type, event_data,
        ip_address, user_agent, clicked_url
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        sentEmailId,
        eventType,
        eventData ? JSON.stringify(eventData) : null,
        eventData?.ip_address || null,
        eventData?.user_agent || null,
        eventData?.clicked_url || null,
      ]
    );

    // Update sent_emails status if needed
    if (eventType === 'open') {
      await db.query(
        `UPDATE sent_emails SET status = 'delivered', delivered_at = NOW()
         WHERE id = $1 AND status = 'sent'`,
        [sentEmailId]
      );

      // Update campaign_prospects open count
      await db.query(
        `UPDATE campaign_prospects cp
         SET emails_opened = emails_opened + 1
         WHERE prospect_id = (SELECT prospect_id FROM sent_emails WHERE id = $1)
           AND campaign_id = (SELECT campaign_id FROM sent_emails WHERE id = $1)
           AND NOT EXISTS (
             SELECT 1 FROM email_tracking
             WHERE sent_email_id = $1 AND event_type = 'open'
             LIMIT 1
           )`,
        [sentEmailId]
      );
    } else if (eventType === 'click') {
      // Update campaign_prospects click count (only count first click)
      await db.query(
        `UPDATE campaign_prospects cp
         SET emails_clicked = emails_clicked + 1
         WHERE prospect_id = (SELECT prospect_id FROM sent_emails WHERE id = $1)
           AND campaign_id = (SELECT campaign_id FROM sent_emails WHERE id = $1)
           AND NOT EXISTS (
             SELECT 1 FROM email_tracking
             WHERE sent_email_id = $1 AND event_type = 'click'
             LIMIT 1
           )`,
        [sentEmailId]
      );
    } else if (eventType === 'bounce') {
      await db.query(
        `UPDATE sent_emails SET status = 'bounced', bounce_reason = $1
         WHERE id = $2`,
        [eventData?.bounce_reason || 'Unknown', sentEmailId]
      );

      // Pause campaign prospect on hard bounce
      await db.query(
        `UPDATE campaign_prospects
         SET status = 'bounced', paused_reason = 'Email bounced'
         WHERE prospect_id = (SELECT prospect_id FROM sent_emails WHERE id = $1)
           AND campaign_id = (SELECT campaign_id FROM sent_emails WHERE id = $1)`,
        [sentEmailId]
      );
    }

    logger.info('Tracking event recorded', {
      sent_email_id: sentEmailId,
      event_type: eventType,
    });
  } catch (error) {
    logger.error('Failed to record tracking event', {
      error,
      sent_email_id: sentEmailId,
      event_type: eventType,
    });
  }
}

/**
 * Get tracking stats for a sent email
 */
export async function getEmailTrackingStats(sentEmailId: string): Promise<{
  opens: number;
  clicks: number;
  first_opened_at?: Date;
  last_opened_at?: Date;
  clicked_urls: string[];
}> {
  try {
    const events = await db.query<{
      event_type: string;
      occurred_at: Date;
      clicked_url: string | null;
    }>(
      `SELECT event_type, occurred_at, clicked_url
       FROM email_tracking
       WHERE sent_email_id = $1
       ORDER BY occurred_at ASC`,
      [sentEmailId]
    );

    const opens = events.rows.filter((e) => e.event_type === 'open').length;
    const clicks = events.rows.filter((e) => e.event_type === 'click').length;

    const openEvents = events.rows.filter((e) => e.event_type === 'open');
    const clickEvents = events.rows.filter((e) => e.event_type === 'click');

    return {
      opens,
      clicks,
      first_opened_at: openEvents[0]?.occurred_at,
      last_opened_at: openEvents[openEvents.length - 1]?.occurred_at,
      clicked_urls: clickEvents
        .map((e) => e.clicked_url)
        .filter((url): url is string => url !== null),
    };
  } catch (error) {
    logger.error('Failed to get tracking stats', { error, sent_email_id: sentEmailId });
    return {
      opens: 0,
      clicks: 0,
      clicked_urls: [],
    };
  }
}

/**
 * Get tracking stats for a campaign
 */
export async function getCampaignTrackingStats(campaignId: string): Promise<{
  total_sent: number;
  total_delivered: number;
  total_opens: number;
  total_clicks: number;
  unique_opens: number;
  unique_clicks: number;
  open_rate: number;
  click_rate: number;
}> {
  try {
    const stats = await db.queryOne<{
      total_sent: string;
      total_delivered: string;
      total_opens: string;
      total_clicks: string;
      unique_opens: string;
      unique_clicks: string;
    }>(
      `SELECT
        COUNT(DISTINCT se.id) as total_sent,
        COUNT(DISTINCT CASE WHEN se.status = 'delivered' THEN se.id END) as total_delivered,
        COUNT(CASE WHEN et.event_type = 'open' THEN 1 END) as total_opens,
        COUNT(CASE WHEN et.event_type = 'click' THEN 1 END) as total_clicks,
        COUNT(DISTINCT CASE WHEN et.event_type = 'open' THEN se.id END) as unique_opens,
        COUNT(DISTINCT CASE WHEN et.event_type = 'click' THEN se.id END) as unique_clicks
       FROM sent_emails se
       LEFT JOIN email_tracking et ON et.sent_email_id = se.id
       WHERE se.campaign_id = $1 AND se.sent_at IS NOT NULL`,
      [campaignId]
    );

    if (!stats) {
      return {
        total_sent: 0,
        total_delivered: 0,
        total_opens: 0,
        total_clicks: 0,
        unique_opens: 0,
        unique_clicks: 0,
        open_rate: 0,
        click_rate: 0,
      };
    }

    const totalSent = parseInt(stats.total_sent, 10);
    const totalDelivered = parseInt(stats.total_delivered, 10);
    const uniqueOpens = parseInt(stats.unique_opens, 10);
    const uniqueClicks = parseInt(stats.unique_clicks, 10);

    const openRate = totalDelivered > 0 ? (uniqueOpens / totalDelivered) * 100 : 0;
    const clickRate = totalDelivered > 0 ? (uniqueClicks / totalDelivered) * 100 : 0;

    return {
      total_sent: totalSent,
      total_delivered: totalDelivered,
      total_opens: parseInt(stats.total_opens, 10),
      total_clicks: parseInt(stats.total_clicks, 10),
      unique_opens: uniqueOpens,
      unique_clicks: uniqueClicks,
      open_rate: Math.round(openRate * 100) / 100,
      click_rate: Math.round(clickRate * 100) / 100,
    };
  } catch (error) {
    logger.error('Failed to get campaign tracking stats', { error, campaign_id: campaignId });
    throw error;
  }
}
