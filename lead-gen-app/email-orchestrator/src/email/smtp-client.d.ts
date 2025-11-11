/**
 * SMTP integration for sending emails
 * Uses Nodemailer transport defined via environment configuration
 */
import type { EmailQuotaStatus, GmailSendParams } from '../types/email.types.js';
export declare class SmtpClient {
    private transporter;
    private initialized;
    /**
     * Initialize SMTP transporter from environment variables
     */
    initialize(): Promise<void>;
    private ensureTransporter;
    /**
     * Send an email using SMTP
     */
    sendEmail(params: GmailSendParams): Promise<{
        messageId: string;
    }>;
    /**
     * Check SMTP sending quota based on stored configuration
     */
    getQuotaStatus(): Promise<EmailQuotaStatus>;
}
export declare const smtpClient: SmtpClient;
//# sourceMappingURL=smtp-client.d.ts.map
