/**
 * Email sending orchestration
 * Handles quota management, compliance, tracking, and delivery
 */
import type { SendEmailParams, SentEmail } from '../types/email.types.js';
export declare class EmailSender {
    /**
     * Send an email with full orchestration
     */
    sendEmail(params: SendEmailParams): Promise<SentEmail>;
    /**
     * Send batch of emails (respects rate limits)
     */
    sendBatch(emails: SendEmailParams[]): Promise<{
        sent: SentEmail[];
        failed: Array<{
            email: SendEmailParams;
            error: string;
        }>;
        skipped: number;
    }>;
    private resolveProvider;
    private ensureProviderInitialized;
    private getQuotaStatus;
    private sendViaProvider;
    private createQuotaError;
    /**
     * Generate unique tracking ID
     */
    private generateTrackingId;
    /**
     * Delay helper
     */
    private delay;
}
export declare const emailSender: EmailSender;
//# sourceMappingURL=email-sender.d.ts.map