/**
 * CAN-SPAM compliance utilities
 * Ensures all emails meet legal requirements
 */
import type { CompanyInfo } from '../types/email.types.js';
/**
 * Build compliant email footer with unsubscribe link and physical address
 */
export declare function buildEmailFooter(companyInfo: CompanyInfo, unsubscribeUrl: string): string;
/**
 * Add unsubscribe link to email HTML
 */
export declare function addUnsubscribeLink(html: string, sentEmailId: string): string;
/**
 * Generate unsubscribe URL for a sent email
 */
export declare function generateUnsubscribeUrl(sentEmailId: string): string;
/**
 * Handle unsubscribe request
 */
export declare function handleUnsubscribe(sentEmailId: string, reason?: string): Promise<{
    success: boolean;
    email?: string;
    error?: string;
}>;
/**
 * Check if an email address is unsubscribed
 */
export declare function isUnsubscribed(email: string): Promise<boolean>;
/**
 * Get company info from database config
 */
export declare function getCompanyInfo(): Promise<CompanyInfo>;
/**
 * Add CAN-SPAM compliant footer to email HTML
 */
export declare function addCompliantFooter(html: string, sentEmailId: string): Promise<string>;
/**
 * Validate email content for compliance
 */
export declare function validateEmailCompliance(html: string): {
    valid: boolean;
    errors: string[];
};
/**
 * Strip HTML tags for plain text version
 */
export declare function htmlToPlainText(html: string): string;
//# sourceMappingURL=compliance.d.ts.map