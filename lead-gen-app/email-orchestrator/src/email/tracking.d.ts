/**
 * Email tracking system
 * Handles open tracking, click tracking, and event recording
 */
import type { EmailTrackingEvent } from '../types/email.types.js';
/**
 * Create tracking pixel HTML
 */
export declare function createTrackingPixel(html: string, trackingPixelId: string): string;
/**
 * Get tracking pixel URL
 */
export declare function getTrackingPixelUrl(trackingPixelId: string): string;
/**
 * Wrap links with click tracking
 */
export declare function wrapLinksWithTracking(html: string, sentEmailId: string): string;
/**
 * Get click tracking URL
 */
export declare function getClickTrackingUrl(sentEmailId: string, originalUrl: string): string;
/**
 * Record email tracking event
 */
export declare function recordTrackingEvent(sentEmailId: string, eventType: EmailTrackingEvent, eventData?: {
    ip_address?: string;
    user_agent?: string;
    clicked_url?: string;
    [key: string]: any;
}): Promise<void>;
/**
 * Get tracking stats for a sent email
 */
export declare function getEmailTrackingStats(sentEmailId: string): Promise<{
    opens: number;
    clicks: number;
    first_opened_at?: Date;
    last_opened_at?: Date;
    clicked_urls: string[];
}>;
/**
 * Get tracking stats for a campaign
 */
export declare function getCampaignTrackingStats(campaignId: string): Promise<{
    total_sent: number;
    total_delivered: number;
    total_opens: number;
    total_clicks: number;
    unique_opens: number;
    unique_clicks: number;
    open_rate: number;
    click_rate: number;
}>;
//# sourceMappingURL=tracking.d.ts.map