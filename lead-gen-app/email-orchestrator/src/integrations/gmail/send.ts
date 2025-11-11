/**
 * Gmail Send Module
 * Handles composing, replying, and forwarding emails
 */

import { GmailClient } from './client.js';
import { logger } from '../../utils/logger.js';
import { htmlToPlainText } from '../../utils/compliance.js';
import type {
  ComposeEmailParams,
  ReplyEmailParams,
  ForwardEmailParams,
  EmailAttachment,
} from '../../types/email.types.js';

/**
 * Build RFC 2822 compliant email message
 */
function buildRFC2822Message(params: {
  to: string | string[];
  from: string;
  subject: string;
  bodyHtml?: string;
  bodyPlain?: string;
  cc?: string | string[];
  bcc?: string | string[];
  headers?: Record<string, string>;
  inReplyTo?: string;
  references?: string;
  attachments?: EmailAttachment[];
}): string {
  const lines: string[] = [];

  // Required headers
  const toEmails = Array.isArray(params.to) ? params.to.join(', ') : params.to;
  lines.push(`To: ${toEmails}`);
  lines.push(`From: ${params.from}`);
  lines.push(`Subject: ${params.subject}`);

  // Optional headers
  if (params.cc) {
    const ccEmails = Array.isArray(params.cc) ? params.cc.join(', ') : params.cc;
    lines.push(`Cc: ${ccEmails}`);
  }

  if (params.bcc) {
    const bccEmails = Array.isArray(params.bcc) ? params.bcc.join(', ') : params.bcc;
    lines.push(`Bcc: ${bccEmails}`);
  }

  // Thread headers for replies
  if (params.inReplyTo) {
    lines.push(`In-Reply-To: ${params.inReplyTo}`);
  }

  if (params.references) {
    lines.push(`References: ${params.references}`);
  }

  // Additional custom headers
  if (params.headers) {
    Object.entries(params.headers).forEach(([key, value]) => {
      lines.push(`${key}: ${value}`);
    });
  }

  // MIME headers
  lines.push('MIME-Version: 1.0');

  const hasAttachments = params.attachments && params.attachments.length > 0;
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2)}`;

  if (hasAttachments) {
    // Multipart/mixed for attachments
    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    lines.push('');

    // Email body part (multipart/alternative)
    lines.push(`--${boundary}`);
    const bodyBoundary = `body_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    lines.push(`Content-Type: multipart/alternative; boundary="${bodyBoundary}"`);
    lines.push('');

    // Plain text version
    if (params.bodyPlain) {
      lines.push(`--${bodyBoundary}`);
      lines.push('Content-Type: text/plain; charset="UTF-8"');
      lines.push('Content-Transfer-Encoding: 7bit');
      lines.push('');
      lines.push(params.bodyPlain);
      lines.push('');
    }

    // HTML version
    if (params.bodyHtml) {
      lines.push(`--${bodyBoundary}`);
      lines.push('Content-Type: text/html; charset="UTF-8"');
      lines.push('Content-Transfer-Encoding: 7bit');
      lines.push('');
      lines.push(params.bodyHtml);
      lines.push('');
    }

    lines.push(`--${bodyBoundary}--`);
    lines.push('');

    // Attachments
    for (const attachment of params.attachments) {
      lines.push(`--${boundary}`);
      lines.push(`Content-Type: ${attachment.mime_type}; name="${attachment.filename}"`);
      lines.push('Content-Transfer-Encoding: base64');
      lines.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
      lines.push('');
      if (attachment.data) {
        // Split base64 data into 76-character lines
        const base64Data = attachment.data.match(/.{1,76}/g)?.join('\r\n') || attachment.data;
        lines.push(base64Data);
      }
      lines.push('');
    }

    lines.push(`--${boundary}--`);
  } else {
    // No attachments - multipart/alternative for HTML and plain text
    if (params.bodyPlain && params.bodyHtml) {
      lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
      lines.push('');

      // Plain text part
      lines.push(`--${boundary}`);
      lines.push('Content-Type: text/plain; charset="UTF-8"');
      lines.push('Content-Transfer-Encoding: 7bit');
      lines.push('');
      lines.push(params.bodyPlain);
      lines.push('');

      // HTML part
      lines.push(`--${boundary}`);
      lines.push('Content-Type: text/html; charset="UTF-8"');
      lines.push('Content-Transfer-Encoding: 7bit');
      lines.push('');
      lines.push(params.bodyHtml);
      lines.push('');

      lines.push(`--${boundary}--`);
    } else if (params.bodyHtml) {
      // HTML only
      lines.push('Content-Type: text/html; charset="UTF-8"');
      lines.push('Content-Transfer-Encoding: 7bit');
      lines.push('');
      lines.push(params.bodyHtml);
    } else {
      // Plain text only
      lines.push('Content-Type: text/plain; charset="UTF-8"');
      lines.push('Content-Transfer-Encoding: 7bit');
      lines.push('');
      lines.push(params.bodyPlain || '');
    }
  }

  return lines.join('\r\n');
}

/**
 * Compose and send a new email
 */
export async function composeAndSend(
  userId: string | undefined,
  params: ComposeEmailParams
): Promise<{ message_id: string; thread_id: string }> {
  const client = new GmailClient(userId);

  try {
    await client.initialize();

    // Generate plain text if not provided
    const bodyPlain = params.body_plain || htmlToPlainText(params.body_html);

    // Build message
    const rawMessage = buildRFC2822Message({
      to: params.to,
      from: params.from || 'me',
      subject: params.subject,
      bodyHtml: params.body_html,
      bodyPlain,
      cc: params.cc,
      bcc: params.bcc,
      headers: params.headers,
      attachments: params.attachments,
    });

    // Send via Gmail API
    const result = await client.sendMessage(rawMessage);

    logger.info('Email composed and sent', {
      userId,
      messageId: result.id,
      to: params.to,
      subject: params.subject,
    });

    return {
      message_id: result.id,
      thread_id: result.threadId,
    };
  } catch (error: any) {
    logger.error('Failed to compose and send email', { error: error.message, userId });
    throw new Error(`Compose and send failed: ${error.message}`);
  }
}

/**
 * Reply to an email in a thread
 */
export async function replyToEmail(
  userId: string | undefined,
  params: ReplyEmailParams
): Promise<{ message_id: string; thread_id: string }> {
  const client = new GmailClient(userId);

  try {
    await client.initialize();

    // Get the original message to extract headers
    let originalMessage: any;
    if (params.message_id) {
      originalMessage = await client.getMessage(params.message_id, 'full');
    } else if (params.thread_id) {
      const thread = await client.getThread(params.thread_id, 'full');
      originalMessage = thread.messages[thread.messages.length - 1]; // Reply to last message
    } else {
      throw new Error('Either message_id or thread_id must be provided');
    }

    // Extract headers
    const headers = originalMessage.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const originalSubject = getHeader('Subject');
    const originalFrom = getHeader('From');
    const originalMessageId = getHeader('Message-ID');
    const originalReferences = getHeader('References');
    const originalTo = getHeader('To');

    // Build reply subject
    const replySubject = originalSubject.startsWith('Re:')
      ? originalSubject
      : `Re: ${originalSubject}`;

    // Extract email from "Name <email>" format
    const extractEmail = (header: string): string => {
      const match = header.match(/<([\w.-]+@[\w.-]+\.\w+)>/) || header.match(/([\w.-]+@[\w.-]+\.\w+)/);
      return match?.[1] || match?.[0] || '';
    };

    const replyTo = extractEmail(originalFrom);

    // Build References header
    const references = originalReferences
      ? `${originalReferences} ${originalMessageId}`
      : originalMessageId;

    // Generate plain text if not provided
    const bodyPlain = params.body_plain || htmlToPlainText(params.body_html);

    // Build message
    const rawMessage = buildRFC2822Message({
      to: replyTo,
      from: 'me',
      subject: replySubject,
      bodyHtml: params.body_html,
      bodyPlain,
      cc: params.cc,
      bcc: params.bcc,
      inReplyTo: originalMessageId,
      references,
      attachments: params.attachments,
    });

    // Send reply
    const result = await client.sendMessage(rawMessage);

    logger.info('Reply sent', {
      userId,
      messageId: result.id,
      threadId: result.threadId,
      originalMessageId: params.message_id,
    });

    return {
      message_id: result.id,
      thread_id: result.threadId,
    };
  } catch (error: any) {
    logger.error('Failed to reply to email', { error: error.message, userId });
    throw new Error(`Reply failed: ${error.message}`);
  }
}

/**
 * Forward an email
 */
export async function forwardEmail(
  userId: string | undefined,
  params: ForwardEmailParams
): Promise<{ message_id: string; thread_id: string }> {
  const client = new GmailClient(userId);

  try {
    await client.initialize();

    // Get original message
    const originalMessage = await client.getMessage(params.message_id, 'full');

    // Extract headers
    const headers = originalMessage.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const originalSubject = getHeader('Subject');
    const originalFrom = getHeader('From');
    const originalDate = getHeader('Date');

    // Build forward subject
    const forwardSubject = originalSubject.startsWith('Fwd:')
      ? originalSubject
      : `Fwd: ${originalSubject}`;

    // Get original body
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

    const originalBody = getBody(originalMessage.payload || {});

    // Build forwarded message with original content
    const forwardedHtml = `
${params.body_html || ''}

<br><br>
---------- Forwarded message ---------<br>
From: ${originalFrom}<br>
Date: ${originalDate}<br>
Subject: ${originalSubject}<br>
<br>
${originalBody.html || originalBody.plain || ''}
`;

    const forwardedPlain = `
${params.body_plain || htmlToPlainText(params.body_html || '')}

---------- Forwarded message ---------
From: ${originalFrom}
Date: ${originalDate}
Subject: ${originalSubject}

${originalBody.plain || ''}
`;

    // Build message
    const rawMessage = buildRFC2822Message({
      to: params.to,
      from: 'me',
      subject: forwardSubject,
      bodyHtml: forwardedHtml,
      bodyPlain: forwardedPlain,
      cc: params.cc,
      bcc: params.bcc,
    });

    // Send forwarded message
    const result = await client.sendMessage(rawMessage);

    logger.info('Email forwarded', {
      userId,
      messageId: result.id,
      originalMessageId: params.message_id,
      to: params.to,
    });

    return {
      message_id: result.id,
      thread_id: result.threadId,
    };
  } catch (error: any) {
    logger.error('Failed to forward email', { error: error.message, userId });
    throw new Error(`Forward failed: ${error.message}`);
  }
}
