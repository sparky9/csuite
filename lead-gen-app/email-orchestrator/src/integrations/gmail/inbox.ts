/**
 * Gmail Inbox Management Module
 * Handles fetching, searching, and reading emails
 */

import { GmailClient } from './client.js';
import { logger } from '../../utils/logger.js';
import { db } from '../../db/client.js';
import type {
  EmailMessage,
  EmailThread,
  EmailAttachment,
  InboxFetchOptions,
  EmailSearchParams,
} from '../../types/email.types.js';

/**
 * Parse Gmail message into normalized format
 */
function parseGmailMessage(gmailMessage: any, userId?: string): EmailMessage {
  const headers = gmailMessage.payload?.headers || [];
  const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  // Extract email addresses
  const parseEmails = (headerValue: string): string[] => {
    if (!headerValue) return [];
    // Extract email addresses from header (handles "Name <email>" format)
    const matches = headerValue.match(/[\w.-]+@[\w.-]+\.\w+/g);
    return matches || [];
  };

  const fromHeader = getHeader('From');
  const fromMatch = fromHeader.match(/(.*?)\s*<([\w.-]+@[\w.-]+\.\w+)>/) || fromHeader.match(/([\w.-]+@[\w.-]+\.\w+)/);
  const fromName = fromMatch?.[1]?.trim().replace(/^["']|["']$/g, '') || '';
  const fromEmail = fromMatch?.[2] || fromMatch?.[1] || '';

  // Parse body
  const getBody = (part: any): { plain?: string; html?: string } => {
    const result: { plain?: string; html?: string } = {};

    if (part.mimeType === 'text/plain' && part.body?.data) {
      result.plain = Buffer.from(part.body.data, 'base64').toString('utf-8');
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      result.html = Buffer.from(part.body.data, 'base64').toString('utf-8');
    } else if (part.parts) {
      for (const subPart of part.parts) {
        const subResult = getBody(subPart);
        if (subResult.plain) result.plain = subResult.plain;
        if (subResult.html) result.html = subResult.html;
      }
    }

    return result;
  };

  const body = getBody(gmailMessage.payload || {});

  // Parse attachments
  const attachments: EmailAttachment[] = [];
  const extractAttachments = (part: any) => {
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        filename: part.filename,
        mime_type: part.mimeType,
        size: part.body.size || 0,
        attachment_id: part.body.attachmentId,
      });
    }
    if (part.parts) {
      part.parts.forEach(extractAttachments);
    }
  };

  if (gmailMessage.payload) {
    extractAttachments(gmailMessage.payload);
  }

  return {
    id: gmailMessage.id,
    message_id: getHeader('Message-ID'),
    thread_id: gmailMessage.threadId,
    from_email: fromEmail,
    from_name: fromName || undefined,
    to_emails: parseEmails(getHeader('To')),
    cc_emails: parseEmails(getHeader('Cc')),
    bcc_emails: parseEmails(getHeader('Bcc')),
    subject: getHeader('Subject'),
    snippet: gmailMessage.snippet || '',
    body_plain: body.plain,
    body_html: body.html,
    date: new Date(parseInt(gmailMessage.internalDate, 10)),
    is_unread: gmailMessage.labelIds?.includes('UNREAD') || false,
    labels: gmailMessage.labelIds || [],
    has_attachments: attachments.length > 0,
    attachments: attachments.length > 0 ? attachments : undefined,
    provider: 'gmail',
  };
}

/**
 * Fetch inbox emails
 */
export async function fetchInbox(
  userId: string | undefined,
  options: InboxFetchOptions = {}
): Promise<EmailMessage[]> {
  const client = new GmailClient(userId);

  try {
    await client.initialize();

    // Build Gmail query
    let query = options.query || '';

    if (options.unread_only) {
      query += ' is:unread';
    }

    if (options.after) {
      const afterDate = Math.floor(options.after.getTime() / 1000);
      query += ` after:${afterDate}`;
    }

    if (options.before) {
      const beforeDate = Math.floor(options.before.getTime() / 1000);
      query += ` before:${beforeDate}`;
    }

    // List messages
    const listResult = await client.listMessages({
      maxResults: options.max_results || 50,
      query: query.trim() || undefined,
      labelIds: options.label_ids,
    });

    if (listResult.messages.length === 0) {
      logger.info('No messages found in inbox', { userId, options });
      return [];
    }

    // Fetch full message details
    const messages: EmailMessage[] = [];

    for (const msg of listResult.messages) {
      try {
        const fullMessage = await client.getMessage(msg.id, 'full');
        const parsed = parseGmailMessage(fullMessage, userId);
        messages.push(parsed);

        // Cache message in database
        await cacheEmail(parsed, userId);
      } catch (error: any) {
        logger.error('Failed to fetch message', { error: error.message, messageId: msg.id });
        // Continue with other messages
      }
    }

    logger.info('Fetched inbox messages', { userId, count: messages.length });

    return messages;
  } catch (error: any) {
    logger.error('Failed to fetch inbox', { error: error.message, userId });
    throw new Error(`Inbox fetch failed: ${error.message}`);
  }
}

/**
 * Search emails with advanced filters
 */
export async function searchEmails(
  userId: string | undefined,
  params: EmailSearchParams
): Promise<EmailMessage[]> {
  const client = new GmailClient(userId);

  try {
    await client.initialize();

    // Build advanced Gmail query
    let query = params.query || '';

    if (params.from) {
      query += ` from:${params.from}`;
    }

    if (params.to) {
      query += ` to:${params.to}`;
    }

    if (params.subject) {
      query += ` subject:${params.subject}`;
    }

    if (params.has_attachment) {
      query += ' has:attachment';
    }

    if (params.after) {
      const afterDate = Math.floor(params.after.getTime() / 1000);
      query += ` after:${afterDate}`;
    }

    if (params.before) {
      const beforeDate = Math.floor(params.before.getTime() / 1000);
      query += ` before:${beforeDate}`;
    }

    const listResult = await client.listMessages({
      maxResults: params.max_results || 50,
      query: query.trim(),
      labelIds: params.label_ids,
    });

    if (listResult.messages.length === 0) {
      logger.info('No messages found matching search', { userId, query });
      return [];
    }

    // Fetch full message details
    const messages: EmailMessage[] = [];

    for (const msg of listResult.messages) {
      try {
        const fullMessage = await client.getMessage(msg.id, 'full');
        const parsed = parseGmailMessage(fullMessage, userId);
        messages.push(parsed);

        // Cache message
        await cacheEmail(parsed, userId);
      } catch (error: any) {
        logger.error('Failed to fetch search result message', {
          error: error.message,
          messageId: msg.id,
        });
      }
    }

    logger.info('Email search completed', { userId, query, count: messages.length });

    return messages;
  } catch (error: any) {
    logger.error('Email search failed', { error: error.message, userId });
    throw new Error(`Email search failed: ${error.message}`);
  }
}

/**
 * Get full email thread with all messages
 */
export async function getThread(userId: string | undefined, threadId: string): Promise<EmailThread> {
  const client = new GmailClient(userId);

  try {
    await client.initialize();

    const gmailThread = await client.getThread(threadId, 'full');

    // Parse all messages in thread
    const messages: EmailMessage[] = [];
    const participants = new Set<string>();
    let unreadCount = 0;

    for (const gmailMessage of gmailThread.messages || []) {
      const parsed = parseGmailMessage(gmailMessage, userId);
      messages.push(parsed);

      // Track participants
      participants.add(parsed.from_email);
      parsed.to_emails.forEach((email) => participants.add(email));

      if (parsed.is_unread) {
        unreadCount++;
      }

      // Cache message
      await cacheEmail(parsed, userId);
    }

    // Sort messages chronologically
    messages.sort((a, b) => a.date.getTime() - b.date.getTime());

    const thread: EmailThread = {
      thread_id: gmailThread.id,
      subject: messages[0]?.subject || '(No Subject)',
      participants: Array.from(participants),
      message_count: messages.length,
      unread_count: unreadCount,
      labels: gmailThread.messages?.[0]?.labelIds || [],
      last_message_date: messages[messages.length - 1]?.date || new Date(),
      messages,
    };

    logger.info('Retrieved email thread', {
      userId,
      threadId,
      messageCount: messages.length,
    });

    return thread;
  } catch (error: any) {
    logger.error('Failed to get thread', { error: error.message, userId, threadId });
    throw new Error(`Get thread failed: ${error.message}`);
  }
}

/**
 * Cache email in database for faster access
 */
async function cacheEmail(email: EmailMessage, userId?: string): Promise<void> {
  try {
    await db.query(
      `INSERT INTO email_cache (
        user_id, message_id, thread_id, from_email, from_name,
        to_emails, cc_emails, subject, snippet, body_plain, body_html,
        date, is_unread, labels, has_attachments, provider, raw_data
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (message_id) DO UPDATE SET
        is_unread = EXCLUDED.is_unread,
        labels = EXCLUDED.labels,
        cached_at = NOW()`,
      [
        userId || null,
        email.message_id,
        email.thread_id,
        email.from_email,
        email.from_name || null,
        email.to_emails,
        email.cc_emails || null,
        email.subject,
        email.snippet,
        email.body_plain || null,
        email.body_html || null,
        email.date,
        email.is_unread,
        email.labels,
        email.has_attachments,
        email.provider,
        JSON.stringify({ attachments: email.attachments }),
      ]
    );

    logger.debug('Email cached', { messageId: email.message_id });
  } catch (error: any) {
    logger.error('Failed to cache email', { error: error.message, messageId: email.message_id });
    // Don't throw - caching is optional
  }
}
