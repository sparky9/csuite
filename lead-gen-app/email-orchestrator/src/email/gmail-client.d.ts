/**
 * Gmail API integration for sending emails
 * Uses OAuth 2.0 for authentication
 */
import type { GmailTokens, GmailSendParams, GmailQuotaStatus } from '../types/email.types.js';
export declare class GmailClient {
    private oauth2Client;
    private gmailService;
    constructor();
    /**
     * Initialize Gmail client with OAuth tokens
     */
    initialize(): Promise<void>;
    /**
     * Load OAuth tokens from database
     */
    private loadTokens;
    /**
     * Save OAuth tokens to database
     */
    saveTokens(tokens: GmailTokens): Promise<void>;
    /**
     * Send an email via Gmail API
     */
    sendEmail(params: GmailSendParams): Promise<{
        messageId: string;
    }>;
    /**
     * Build RFC 2822 compliant email message
     */
    private buildEmailMessage;
    /**
     * Check Gmail quota status
     */
    getQuotaStatus(): Promise<GmailQuotaStatus>;
    /**
     * Generate OAuth authorization URL
     */
    getAuthUrl(): string;
    /**
     * Exchange authorization code for tokens
     */
    getTokensFromCode(code: string): Promise<GmailTokens>;
    /**
     * Check if Gmail is authenticated
     */
    isAuthenticated(): boolean;
}
export declare const gmailClient: GmailClient;
//# sourceMappingURL=gmail-client.d.ts.map