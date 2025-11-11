/**
 * Gmail OAuth 2.0 Authentication Module
 * Handles token management and OAuth flow for Gmail API
 */

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { logger } from '../../utils/logger.js';
import { db } from '../../db/client.js';
import type { OAuthTokens } from '../../types/email.types.js';

export class GmailAuth {
  private static instances: Map<string, OAuth2Client> = new Map();

  /**
   * Get or create OAuth2 client for a user
   */
  static getOAuth2Client(userId?: string): OAuth2Client {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth/callback';

    if (!clientId || !clientSecret) {
      throw new Error('Gmail OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
    }

    const cacheKey = userId || 'default';

    if (!this.instances.has(cacheKey)) {
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
      this.instances.set(cacheKey, oauth2Client);
    }

    return this.instances.get(cacheKey)!;
  }

  /**
   * Generate OAuth authorization URL
   */
  static getAuthUrl(userId?: string, emailHint?: string): string {
    const oauth2Client = this.getOAuth2Client(userId);

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/gmail.compose',
      ],
      prompt: 'consent', // Force consent to get refresh token
      login_hint: emailHint,
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  static async exchangeCodeForTokens(
    code: string,
    userId?: string,
    emailAddress?: string
  ): Promise<OAuthTokens> {
    const oauth2Client = this.getOAuth2Client(userId);

    try {
      const { tokens } = await oauth2Client.getToken(code);

      if (!tokens.access_token || !tokens.refresh_token) {
        throw new Error('Failed to obtain access or refresh token');
      }

      // Save tokens to database
      const savedTokens = await this.saveTokens(
        {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
          scope: tokens.scope || '',
          email_address: emailAddress,
        },
        userId
      );

      // Set credentials on the client
      oauth2Client.setCredentials(tokens);

      logger.info('Gmail OAuth tokens exchanged successfully', { userId, email: emailAddress });

      return savedTokens;
    } catch (error: any) {
      logger.error('Failed to exchange code for tokens', { error: error.message, userId });
      throw new Error(`Token exchange failed: ${error.message}`);
    }
  }

  /**
   * Load tokens from database and initialize OAuth client
   */
  static async loadAndSetTokens(userId?: string): Promise<OAuth2Client | null> {
    try {
      const tokens = await this.loadTokens(userId);

      if (!tokens) {
        logger.warn('No Gmail tokens found for user', { userId });
        return null;
      }

      const oauth2Client = this.getOAuth2Client(userId);

      oauth2Client.setCredentials({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || undefined,
        expiry_date: tokens.token_expiry ? tokens.token_expiry.getTime() : undefined,
      });

      // Set up automatic token refresh
      oauth2Client.on('tokens', async (newTokens) => {
        logger.info('Gmail access token auto-refreshed', { userId });

        await this.updateTokens(
          {
            access_token: newTokens.access_token || tokens.access_token,
            token_expiry: newTokens.expiry_date ? new Date(newTokens.expiry_date) : tokens.token_expiry,
          },
          userId
        );
      });

      logger.info('Gmail OAuth client initialized', { userId, email: tokens.email_address });

      return oauth2Client;
    } catch (error: any) {
      logger.error('Failed to load and set tokens', { error: error.message, userId });
      return null;
    }
  }

  /**
   * Save OAuth tokens to database
   */
  private static async saveTokens(
    tokenData: {
      access_token: string;
      refresh_token?: string;
      token_expiry?: Date;
      scope: string;
      email_address?: string;
    },
    userId?: string
  ): Promise<OAuthTokens> {
    try {
      const result = await db.queryOne<OAuthTokens>(
        `INSERT INTO email_oauth_tokens (
          user_id, provider, access_token, refresh_token,
          token_expiry, scope, email_address, updated_at
        )
        VALUES ($1, 'gmail', $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (user_id, provider)
        DO UPDATE SET
          access_token = EXCLUDED.access_token,
          refresh_token = COALESCE(EXCLUDED.refresh_token, email_oauth_tokens.refresh_token),
          token_expiry = EXCLUDED.token_expiry,
          scope = EXCLUDED.scope,
          email_address = COALESCE(EXCLUDED.email_address, email_oauth_tokens.email_address),
          updated_at = NOW()
        RETURNING *`,
        [
          userId || null,
          tokenData.access_token,
          tokenData.refresh_token || null,
          tokenData.token_expiry || null,
          tokenData.scope,
          tokenData.email_address || null,
        ]
      );

      if (!result) {
        throw new Error('Failed to save tokens to database');
      }

      logger.info('Gmail tokens saved to database', { userId });

      return result;
    } catch (error: any) {
      logger.error('Failed to save Gmail tokens', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Update existing tokens (for refresh)
   */
  private static async updateTokens(
    tokenData: {
      access_token: string;
      token_expiry?: Date;
    },
    userId?: string
  ): Promise<void> {
    try {
      await db.query(
        `UPDATE email_oauth_tokens
         SET access_token = $1,
             token_expiry = $2,
             updated_at = NOW()
         WHERE user_id = $3 AND provider = 'gmail'`,
        [tokenData.access_token, tokenData.token_expiry || null, userId || null]
      );

      logger.debug('Gmail tokens updated', { userId });
    } catch (error: any) {
      logger.error('Failed to update tokens', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Load tokens from database
   */
  private static async loadTokens(userId?: string): Promise<OAuthTokens | null> {
    try {
      const result = await db.queryOne<OAuthTokens>(
        `SELECT * FROM email_oauth_tokens
         WHERE user_id = $1 AND provider = 'gmail'
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId || null]
      );

      return result;
    } catch (error: any) {
      logger.error('Failed to load Gmail tokens', { error: error.message, userId });
      return null;
    }
  }

  /**
   * Revoke OAuth tokens and remove from database
   */
  static async revokeAccess(userId?: string): Promise<void> {
    try {
      const oauth2Client = this.getOAuth2Client(userId);
      const tokens = await this.loadTokens(userId);

      if (tokens?.access_token) {
        await oauth2Client.revokeToken(tokens.access_token);
      }

      await db.query(
        `DELETE FROM email_oauth_tokens
         WHERE user_id = $1 AND provider = 'gmail'`,
        [userId || null]
      );

      // Clear cached client
      this.instances.delete(userId || 'default');

      logger.info('Gmail access revoked', { userId });
    } catch (error: any) {
      logger.error('Failed to revoke Gmail access', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Check if user has valid Gmail authentication
   */
  static async isAuthenticated(userId?: string): Promise<boolean> {
    const tokens = await this.loadTokens(userId);
    return tokens !== null && !!tokens.access_token;
  }

  /**
   * Get user's Gmail email address
   */
  static async getEmailAddress(userId?: string): Promise<string | null> {
    const tokens = await this.loadTokens(userId);
    return tokens?.email_address || null;
  }
}
