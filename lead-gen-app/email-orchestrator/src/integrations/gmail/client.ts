/**
 * Gmail API Client Wrapper
 * Provides methods for interacting with Gmail API with error handling and retry logic
 */

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { logger } from '../../utils/logger.js';
import { GmailAuth } from './auth.js';

const { gmail } = google;

export class GmailClient {
  private userId?: string;
  private gmailService: any = null;

  constructor(userId?: string) {
    this.userId = userId;
  }

  /**
   * Initialize Gmail service with authentication
   */
  async initialize(): Promise<void> {
    const oauth2Client = await GmailAuth.loadAndSetTokens(this.userId);

    if (!oauth2Client) {
      throw new Error(
        'Gmail not authenticated. Please authenticate first using the OAuth flow.'
      );
    }

    this.gmailService = gmail({ version: 'v1', auth: oauth2Client });
    logger.debug('Gmail client initialized', { userId: this.userId });
  }

  /**
   * Ensure client is initialized before operations
   */
  private ensureInitialized(): void {
    if (!this.gmailService) {
      throw new Error('Gmail client not initialized. Call initialize() first.');
    }
  }

  /**
   * List messages with optional query
   */
  async listMessages(options: {
    maxResults?: number;
    query?: string;
    labelIds?: string[];
    pageToken?: string;
  }): Promise<{
    messages: Array<{ id: string; threadId: string }>;
    nextPageToken?: string;
    resultSizeEstimate: number;
  }> {
    this.ensureInitialized();

    try {
      const response = await this.gmailService.users.messages.list({
        userId: 'me',
        maxResults: options.maxResults || 50,
        q: options.query,
        labelIds: options.labelIds,
        pageToken: options.pageToken,
      });

      logger.debug('Listed Gmail messages', {
        userId: this.userId,
        count: response.data.messages?.length || 0,
      });

      return {
        messages: response.data.messages || [],
        nextPageToken: response.data.nextPageToken,
        resultSizeEstimate: response.data.resultSizeEstimate || 0,
      };
    } catch (error: any) {
      logger.error('Failed to list Gmail messages', { error: error.message, userId: this.userId });
      throw new Error(`Gmail listMessages failed: ${error.message}`);
    }
  }

  /**
   * Get a specific message by ID
   */
  async getMessage(messageId: string, format: 'full' | 'metadata' | 'minimal' | 'raw' = 'full'): Promise<any> {
    this.ensureInitialized();

    try {
      const response = await this.gmailService.users.messages.get({
        userId: 'me',
        id: messageId,
        format,
      });

      logger.debug('Retrieved Gmail message', { userId: this.userId, messageId });

      return response.data;
    } catch (error: any) {
      logger.error('Failed to get Gmail message', {
        error: error.message,
        userId: this.userId,
        messageId,
      });
      throw new Error(`Gmail getMessage failed: ${error.message}`);
    }
  }

  /**
   * Get a thread with all messages
   */
  async getThread(threadId: string, format: 'full' | 'metadata' | 'minimal' = 'full'): Promise<any> {
    this.ensureInitialized();

    try {
      const response = await this.gmailService.users.threads.get({
        userId: 'me',
        id: threadId,
        format,
      });

      logger.debug('Retrieved Gmail thread', {
        userId: this.userId,
        threadId,
        messageCount: response.data.messages?.length || 0,
      });

      return response.data;
    } catch (error: any) {
      logger.error('Failed to get Gmail thread', {
        error: error.message,
        userId: this.userId,
        threadId,
      });
      throw new Error(`Gmail getThread failed: ${error.message}`);
    }
  }

  /**
   * Send an email message
   */
  async sendMessage(rawMessage: string): Promise<{ id: string; threadId: string; labelIds: string[] }> {
    this.ensureInitialized();

    try {
      // Encode as base64url
      const encodedMessage = Buffer.from(rawMessage)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await this.gmailService.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });

      logger.info('Gmail message sent', {
        userId: this.userId,
        messageId: response.data.id,
        threadId: response.data.threadId,
      });

      return {
        id: response.data.id,
        threadId: response.data.threadId,
        labelIds: response.data.labelIds || [],
      };
    } catch (error: any) {
      logger.error('Failed to send Gmail message', { error: error.message, userId: this.userId });
      throw new Error(`Gmail sendMessage failed: ${error.message}`);
    }
  }

  /**
   * Create a draft
   */
  async createDraft(rawMessage: string): Promise<{ id: string; message: any }> {
    this.ensureInitialized();

    try {
      const encodedMessage = Buffer.from(rawMessage)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await this.gmailService.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw: encodedMessage,
          },
        },
      });

      logger.info('Gmail draft created', { userId: this.userId, draftId: response.data.id });

      return {
        id: response.data.id,
        message: response.data.message,
      };
    } catch (error: any) {
      logger.error('Failed to create Gmail draft', { error: error.message, userId: this.userId });
      throw new Error(`Gmail createDraft failed: ${error.message}`);
    }
  }

  /**
   * Modify message labels
   */
  async modifyMessage(
    messageId: string,
    addLabelIds?: string[],
    removeLabelIds?: string[]
  ): Promise<{ id: string; labelIds: string[] }> {
    this.ensureInitialized();

    try {
      const response = await this.gmailService.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds,
          removeLabelIds,
        },
      });

      logger.debug('Gmail message modified', {
        userId: this.userId,
        messageId,
        added: addLabelIds?.length || 0,
        removed: removeLabelIds?.length || 0,
      });

      return {
        id: response.data.id,
        labelIds: response.data.labelIds || [],
      };
    } catch (error: any) {
      logger.error('Failed to modify Gmail message', {
        error: error.message,
        userId: this.userId,
        messageId,
      });
      throw new Error(`Gmail modifyMessage failed: ${error.message}`);
    }
  }

  /**
   * Batch modify messages
   */
  async batchModifyMessages(
    messageIds: string[],
    addLabelIds?: string[],
    removeLabelIds?: string[]
  ): Promise<void> {
    this.ensureInitialized();

    try {
      await this.gmailService.users.messages.batchModify({
        userId: 'me',
        requestBody: {
          ids: messageIds,
          addLabelIds,
          removeLabelIds,
        },
      });

      logger.debug('Gmail messages batch modified', {
        userId: this.userId,
        count: messageIds.length,
        added: addLabelIds?.length || 0,
        removed: removeLabelIds?.length || 0,
      });
    } catch (error: any) {
      logger.error('Failed to batch modify Gmail messages', {
        error: error.message,
        userId: this.userId,
        count: messageIds.length,
      });
      throw new Error(`Gmail batchModify failed: ${error.message}`);
    }
  }

  /**
   * Delete a message (move to trash)
   */
  async trashMessage(messageId: string): Promise<{ id: string }> {
    this.ensureInitialized();

    try {
      const response = await this.gmailService.users.messages.trash({
        userId: 'me',
        id: messageId,
      });

      logger.debug('Gmail message trashed', { userId: this.userId, messageId });

      return { id: response.data.id };
    } catch (error: any) {
      logger.error('Failed to trash Gmail message', {
        error: error.message,
        userId: this.userId,
        messageId,
      });
      throw new Error(`Gmail trash failed: ${error.message}`);
    }
  }

  /**
   * Permanently delete a message
   */
  async deleteMessage(messageId: string): Promise<void> {
    this.ensureInitialized();

    try {
      await this.gmailService.users.messages.delete({
        userId: 'me',
        id: messageId,
      });

      logger.debug('Gmail message permanently deleted', { userId: this.userId, messageId });
    } catch (error: any) {
      logger.error('Failed to delete Gmail message', {
        error: error.message,
        userId: this.userId,
        messageId,
      });
      throw new Error(`Gmail delete failed: ${error.message}`);
    }
  }

  /**
   * Get user's labels
   */
  async listLabels(): Promise<Array<{ id: string; name: string; type: string }>> {
    this.ensureInitialized();

    try {
      const response = await this.gmailService.users.labels.list({
        userId: 'me',
      });

      logger.debug('Listed Gmail labels', {
        userId: this.userId,
        count: response.data.labels?.length || 0,
      });

      return response.data.labels || [];
    } catch (error: any) {
      logger.error('Failed to list Gmail labels', { error: error.message, userId: this.userId });
      throw new Error(`Gmail listLabels failed: ${error.message}`);
    }
  }

  /**
   * Get attachment data
   */
  async getAttachment(messageId: string, attachmentId: string): Promise<string> {
    this.ensureInitialized();

    try {
      const response = await this.gmailService.users.messages.attachments.get({
        userId: 'me',
        messageId,
        id: attachmentId,
      });

      logger.debug('Retrieved Gmail attachment', {
        userId: this.userId,
        messageId,
        attachmentId,
      });

      return response.data.data; // Base64url encoded data
    } catch (error: any) {
      logger.error('Failed to get Gmail attachment', {
        error: error.message,
        userId: this.userId,
        messageId,
        attachmentId,
      });
      throw new Error(`Gmail getAttachment failed: ${error.message}`);
    }
  }
}
