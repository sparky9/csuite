/**
 * CAN-SPAM compliance utilities
 * Ensures all emails meet legal requirements
 */
import { db } from '../db/client.js';
import { logger } from './logger.js';
/**
 * Build compliant email footer with unsubscribe link and physical address
 */
export function buildEmailFooter(companyInfo, unsubscribeUrl) {
    return `
<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
  <p style="margin: 8px 0;">
    <strong>${companyInfo.name}</strong><br>
    ${companyInfo.address}${companyInfo.phone ? '<br>' + companyInfo.phone : ''}
  </p>
  <p style="margin: 8px 0;">
    You received this email because you are a valued prospect.
    If you no longer wish to receive emails from us, you may
    <a href="${unsubscribeUrl}" style="color: #3b82f6; text-decoration: underline;">unsubscribe here</a>.
  </p>
  <p style="margin: 8px 0; color: #9ca3af;">
    This email was sent as part of a business communication.
    All rights reserved.
  </p>
</div>
`;
}
/**
 * Add unsubscribe link to email HTML
 */
export function addUnsubscribeLink(html, sentEmailId) {
    const unsubscribeUrl = generateUnsubscribeUrl(sentEmailId);
    // If HTML already has a closing body tag, insert before it
    if (html.includes('</body>')) {
        return html.replace('</body>', `<div style="text-align: center; margin-top: 20px; font-size: 11px; color: #9ca3af;">
        <a href="${unsubscribeUrl}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a>
      </div></body>`);
    }
    // Otherwise append to end
    return (html +
        `<div style="text-align: center; margin-top: 20px; font-size: 11px; color: #9ca3af;">
      <a href="${unsubscribeUrl}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a>
    </div>`);
}
/**
 * Generate unsubscribe URL for a sent email
 */
export function generateUnsubscribeUrl(sentEmailId) {
    // In production, this would be your actual unsubscribe endpoint
    // For now, return a placeholder that includes the email ID
    const baseUrl = process.env.UNSUBSCRIBE_BASE_URL || 'https://example.com/unsubscribe';
    return `${baseUrl}/${sentEmailId}`;
}
/**
 * Handle unsubscribe request
 */
export async function handleUnsubscribe(sentEmailId, reason) {
    try {
        // Get the email address from sent_emails
        const sentEmail = await db.queryOne('SELECT to_email, campaign_id FROM sent_emails WHERE id = $1', [sentEmailId]);
        if (!sentEmail) {
            return { success: false, error: 'Email not found' };
        }
        // Check if already unsubscribed
        const existing = await db.queryOne('SELECT id FROM unsubscribes WHERE email = $1', [sentEmail.to_email]);
        if (existing) {
            return { success: true, email: sentEmail.to_email };
        }
        // Add to unsubscribes table
        await db.query(`INSERT INTO unsubscribes (email, unsubscribe_reason, campaign_id, sent_email_id)
       VALUES ($1, $2, $3, $4)`, [sentEmail.to_email, reason || 'User requested', sentEmail.campaign_id, sentEmailId]);
        // Pause all active campaign prospects for this email
        if (sentEmail.campaign_id) {
            await db.query(`UPDATE campaign_prospects
         SET status = 'unsubscribed',
             paused_reason = 'User unsubscribed'
         WHERE prospect_id IN (
           SELECT id FROM prospects WHERE email = $1
         )
         AND status = 'active'`, [sentEmail.to_email]);
        }
        logger.info('Email unsubscribed', {
            email: sentEmail.to_email,
            sent_email_id: sentEmailId,
            reason,
        });
        return { success: true, email: sentEmail.to_email };
    }
    catch (error) {
        logger.error('Failed to handle unsubscribe', { error, sent_email_id: sentEmailId });
        return { success: false, error: String(error) };
    }
}
/**
 * Check if an email address is unsubscribed
 */
export async function isUnsubscribed(email) {
    const result = await db.queryOne('SELECT id FROM unsubscribes WHERE LOWER(email) = LOWER($1)', [email]);
    return result !== null;
}
/**
 * Get company info from database config
 */
export async function getCompanyInfo() {
    const results = await db.query(`SELECT key, value FROM email_config
     WHERE key IN ('company_name', 'company_address', 'company_phone')`);
    const config = results.rows.reduce((acc, row) => {
        acc[row.key] = row.value;
        return acc;
    }, {});
    return {
        name: config.company_name || 'Your Company',
        address: config.company_address || '123 Main St, City, ST 12345',
        phone: config.company_phone,
    };
}
/**
 * Add CAN-SPAM compliant footer to email HTML
 */
export async function addCompliantFooter(html, sentEmailId) {
    const companyInfo = await getCompanyInfo();
    const unsubscribeUrl = generateUnsubscribeUrl(sentEmailId);
    const footer = buildEmailFooter(companyInfo, unsubscribeUrl);
    // If HTML has a closing body tag, insert before it
    if (html.includes('</body>')) {
        return html.replace('</body>', footer + '</body>');
    }
    // Otherwise append to end
    return html + footer;
}
/**
 * Validate email content for compliance
 */
export function validateEmailCompliance(html) {
    const errors = [];
    // Check for physical address (loose check - just look for common patterns)
    const hasAddress = html.includes('St,') ||
        html.includes('Street,') ||
        html.includes('Ave,') ||
        html.includes('Avenue,') ||
        html.includes('Blvd,') ||
        html.includes('Boulevard,');
    if (!hasAddress) {
        errors.push('Missing physical mailing address (required by CAN-SPAM)');
    }
    // Check for unsubscribe link
    const hasUnsubscribe = html.toLowerCase().includes('unsubscribe') && html.toLowerCase().includes('href=');
    if (!hasUnsubscribe) {
        errors.push('Missing unsubscribe link (required by CAN-SPAM)');
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
/**
 * Strip HTML tags for plain text version
 */
export function htmlToPlainText(html) {
    return (html
        // Remove script and style elements
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        // Convert line breaks
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n\n')
        .replace(/<\/li>/gi, '\n')
        // Remove remaining HTML tags
        .replace(/<[^>]+>/g, '')
        // Decode HTML entities
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        // Clean up whitespace
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .trim());
}
//# sourceMappingURL=compliance.js.map