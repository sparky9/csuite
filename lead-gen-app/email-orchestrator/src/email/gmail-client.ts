/**
 * Gmail API integration for sending emails
 * Uses OAuth 2.0 for authentication
 */

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { logger } from '../utils/logger.js';
import { db } from '../db/client.js';
import type { GmailTokens, GmailSendParams, GmailQuotaStatus } from '../types/email.types.js';

const { gmail } = google;

export class GmailClient {
  private oauth2Client: OAuth2Client | null = null;
  private gmailService: any = null;

  constructor() {}

  /**
   * Initialize Gmail client with OAuth tokens
   */
  async initialize(): Promise<void> {
    try {
      const clientId = process.env.GMAIL_CLIENT_ID;
      const clientSecret = process.env.GMAIL_CLIENT_SECRET;
      const redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/oauth/callback';

      if (!clientId || !clientSecret) {
        throw new Error(
          'Gmail OAuth credentials not found. Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET'
        );
      }

      this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

      // Load tokens from database
      const tokens = await this.loadTokens();
      if (tokens) {
        this.oauth2Client.setCredentials({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_type: tokens.token_type,
          expiry_date: tokens.expiry_date,
        });

        // Set up token refresh
        this.oauth2Client.on('tokens', (newTokens) => {
          logger.info('Gmail access token refreshed');
          this.saveTokens({
            ...tokens,
            access_token: newTokens.access_token || tokens.access_token,
            expiry_date: newTokens.expiry_date || tokens.expiry_date,
          });
        });

        this.gmailService = gmail({ version: 'v1', auth: this.oauth2Client });
        logger.info('Gmail client initialized successfully');
      } else {
        logger.warn('No Gmail tokens found. Run gmail:auth script to authenticate.');
      }
    } catch (error) {
      logger.error('Failed to initialize Gmail client', { error });
      throw error;
    }
  }

  /**
   * Load OAuth tokens from database
   */
  private async loadTokens(): Promise<GmailTokens | null> {
    try {
      const result = await db.query<{ key: string; value: string }>(
        `SELECT key, value FROM email_config
         WHERE key IN ('gmail_access_token', 'gmail_refresh_token', 'gmail_token_expiry')`
      );

      if (result.rows.length === 0) {
        return null;
      }

      const config = result.rows.reduce(
        (acc, row) => {
          acc[row.key] = row.value;
          return acc;
        },
        {} as Record<string, string>
      );

      if (!config.gmail_access_token || !config.gmail_refresh_token) {
        return null;
      }

      return {
        access_token: config.gmail_access_token,
        refresh_token: config.gmail_refresh_token,
        scope: 'https://www.googleapis.com/auth/gmail.send',
        token_type: 'Bearer',
        expiry_date: parseInt(config.gmail_token_expiry || '0', 10),
      };
    } catch (error) {
      logger.error('Failed to load Gmail tokens', { error });
      return null;
    }
  }

  /**
   * Save OAuth tokens to database
   */
  async saveTokens(tokens: GmailTokens): Promise<void> {
    try {
      await db.query(
        `INSERT INTO email_config (key, value, updated_at)
         VALUES
           ('gmail_access_token', $1, NOW()),
           ('gmail_refresh_token', $2, NOW()),
           ('gmail_token_expiry', $3, NOW())
         ON CONFLICT (key) DO UPDATE SET
           value = EXCLUDED.value,
           updated_at = NOW()`,
        [tokens.access_token, tokens.refresh_token, tokens.expiry_date.toString()]
      );

      logger.info('Gmail tokens saved to database');
    } catch (error) {
      logger.error('Failed to save Gmail tokens', { error });
      throw error;
    }
  }

  /**
   * Send an email via Gmail API
   */
  async sendEmail(params: GmailSendParams): Promise<{ messageId: string }> {
    if (!this.gmailService) {
      throw new Error('Gmail client not initialized. Run initialize() first.');
    }

    try {
      // Build email message in RFC 2822 format
      const email = this.buildEmailMessage(params);

      // Encode as base64url
      const encodedEmail = Buffer.from(email)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      // Send via Gmail API
      const response = await this.gmailService.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail,
        },
      });

      logger.info('Email sent via Gmail', {
        message_id: response.data.id,
        to: params.to,
        subject: params.subject,
      });

      return { messageId: response.data.id };
    } catch (error: any) {
      logger.error('Failed to send email via Gmail', {
        error: error.message,
        to: params.to,
      });
      throw new Error(`Gmail send failed: ${error.message}`);
    }
  }

  /**
   * Build RFC 2822 compliant email message
   */
  private buildEmailMessage(params: GmailSendParams): string {
    const { to, from, subject, html, text, headers = {} } = params;

    const lines: string[] = [];

    // Required headers
    lines.push(`To: ${to}`);
    lines.push(`From: ${from}`);
    lines.push(`Subject: ${subject}`);

    // Additional headers
    Object.entries(headers).forEach(([key, value]) => {
      lines.push(`${key}: ${value}`);
    });

    // MIME headers
    lines.push('MIME-Version: 1.0');

    if (text && html) {
      // Multipart email with both plain text and HTML
      const boundary = `boundary_${Date.now()}`;
      lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
      lines.push('');

      // Plain text part
      lines.push(`--${boundary}`);
      lines.push('Content-Type: text/plain; charset="UTF-8"');
      lines.push('Content-Transfer-Encoding: 7bit');
      lines.push('');
      lines.push(text);
      lines.push('');

      // HTML part
      lines.push(`--${boundary}`);
      lines.push('Content-Type: text/html; charset="UTF-8"');
      lines.push('Content-Transfer-Encoding: 7bit');
      lines.push('');
      lines.push(html);
      lines.push('');

      lines.push(`--${boundary}--`);
    } else if (html) {
      // HTML only
      lines.push('Content-Type: text/html; charset="UTF-8"');
      lines.push('Content-Transfer-Encoding: 7bit');
      lines.push('');
      lines.push(html);
    } else {
      // Plain text only
      lines.push('Content-Type: text/plain; charset="UTF-8"');
      lines.push('Content-Transfer-Encoding: 7bit');
      lines.push('');
      lines.push(text || '');
    }

    return lines.join('\r\n');
  }

  /**
   * Check Gmail quota status
   */
  async getQuotaStatus(): Promise<GmailQuotaStatus> {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const hourStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours()
      );

      // Get daily and hourly limits from config
      const limits = await db.query<{ key: string; value: string }>(
        `SELECT key, value FROM email_config
         WHERE key IN ('gmail_daily_limit', 'gmail_hourly_limit')`
      );

      const limitConfig = limits.rows.reduce(
        (acc, row) => {
          acc[row.key] = parseInt(row.value, 10);
          return acc;
        },
        {} as Record<string, number>
      );

      const dailyLimit = limitConfig.gmail_daily_limit || 500;
      const hourlyLimit = limitConfig.gmail_hourly_limit || 50;

      // Count emails sent today
      const dailyCount = await db.queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM sent_emails
         WHERE sent_at >= $1 AND provider = 'gmail'`,
        [todayStart]
      );

      // Count emails sent this hour
      const hourlyCount = await db.queryOne<{ count: string }>(
        `SELECT COUNT(*) as count FROM sent_emails
         WHERE sent_at >= $1 AND provider = 'gmail'`,
        [hourStart]
      );

      const dailySent = parseInt(dailyCount?.count || '0', 10);
      const hourlySent = parseInt(hourlyCount?.count || '0', 10);

      const canSend = dailySent < dailyLimit && hourlySent < hourlyLimit;

      // Calculate when we can send next
      let waitUntil: Date | undefined;
      if (!canSend) {
        if (hourlySent >= hourlyLimit) {
          // Wait until next hour
          waitUntil = new Date(hourStart);
          waitUntil.setHours(waitUntil.getHours() + 1);
        } else if (dailySent >= dailyLimit) {
          // Wait until tomorrow
          waitUntil = new Date(todayStart);
          waitUntil.setDate(waitUntil.getDate() + 1);
        }
      }

      return {
        daily_sent: dailySent,
        daily_limit: dailyLimit,
        hourly_sent: hourlySent,
        hourly_limit: hourlyLimit,
        can_send: canSend,
        wait_until: waitUntil,
      };
    } catch (error) {
      logger.error('Failed to check Gmail quota', { error });
      throw error;
    }
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthUrl(): string {
    if (!this.oauth2Client) {
      throw new Error('OAuth client not initialized');
    }

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/gmail.send'],
      prompt: 'consent', // Force consent screen to get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code: string): Promise<GmailTokens> {
    if (!this.oauth2Client) {
      throw new Error('OAuth client not initialized');
    }

    try {
      const { tokens } = await this.oauth2Client.getToken(code);

      const gmailTokens: GmailTokens = {
        access_token: tokens.access_token!,
        refresh_token: tokens.refresh_token!,
        scope: tokens.scope!,
        token_type: tokens.token_type!,
        expiry_date: tokens.expiry_date!,
      };

      await this.saveTokens(gmailTokens);

      return gmailTokens;
    } catch (error) {
      logger.error('Failed to exchange code for tokens', { error });
      throw error;
    }
  }

  /**
   * Check if Gmail is authenticated
   */
  isAuthenticated(): boolean {
    return this.oauth2Client !== null && this.gmailService !== null;
  }
}

// Export singleton instance
export const gmailClient = new GmailClient();
