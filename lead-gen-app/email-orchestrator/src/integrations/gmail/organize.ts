/**
 * Gmail Organize Module
 * Handles labeling, archiving, and organizing emails
 */

import { GmailClient } from './client.js';
import { logger } from '../../utils/logger.js';
import type { OrganizeEmailParams } from '../../types/email.types.js';

// Gmail system label IDs
const GMAIL_LABELS = {
  INBOX: 'INBOX',
  STARRED: 'STARRED',
  IMPORTANT: 'IMPORTANT',
  SENT: 'SENT',
  DRAFT: 'DRAFT',
  TRASH: 'TRASH',
  SPAM: 'SPAM',
  UNREAD: 'UNREAD',
};

/**
 * Add labels to emails
 */
export async function addLabels(
  userId: string | undefined,
  messageIds: string[],
  labels: string[]
): Promise<{ success: boolean; modified_count: number }> {
  const client = new GmailClient(userId);

  try {
    await client.initialize();

    // Batch modify to add labels
    await client.batchModifyMessages(messageIds, labels, undefined);

    logger.info('Labels added to emails', {
      userId,
      count: messageIds.length,
      labels,
    });

    return {
      success: true,
      modified_count: messageIds.length,
    };
  } catch (error: any) {
    logger.error('Failed to add labels', { error: error.message, userId });
    throw new Error(`Add labels failed: ${error.message}`);
  }
}

/**
 * Remove labels from emails
 */
export async function removeLabels(
  userId: string | undefined,
  messageIds: string[],
  labels: string[]
): Promise<{ success: boolean; modified_count: number }> {
  const client = new GmailClient(userId);

  try {
    await client.initialize();

    // Batch modify to remove labels
    await client.batchModifyMessages(messageIds, undefined, labels);

    logger.info('Labels removed from emails', {
      userId,
      count: messageIds.length,
      labels,
    });

    return {
      success: true,
      modified_count: messageIds.length,
    };
  } catch (error: any) {
    logger.error('Failed to remove labels', { error: error.message, userId });
    throw new Error(`Remove labels failed: ${error.message}`);
  }
}

/**
 * Archive emails (remove from INBOX)
 */
export async function archiveEmails(
  userId: string | undefined,
  messageIds: string[]
): Promise<{ success: boolean; archived_count: number }> {
  const client = new GmailClient(userId);

  try {
    await client.initialize();

    // Archive = remove INBOX label
    await client.batchModifyMessages(messageIds, undefined, [GMAIL_LABELS.INBOX]);

    logger.info('Emails archived', {
      userId,
      count: messageIds.length,
    });

    return {
      success: true,
      archived_count: messageIds.length,
    };
  } catch (error: any) {
    logger.error('Failed to archive emails', { error: error.message, userId });
    throw new Error(`Archive failed: ${error.message}`);
  }
}

/**
 * Mark emails as read
 */
export async function markRead(
  userId: string | undefined,
  messageIds: string[],
  read: boolean = true
): Promise<{ success: boolean; modified_count: number }> {
  const client = new GmailClient(userId);

  try {
    await client.initialize();

    if (read) {
      // Mark as read = remove UNREAD label
      await client.batchModifyMessages(messageIds, undefined, [GMAIL_LABELS.UNREAD]);
    } else {
      // Mark as unread = add UNREAD label
      await client.batchModifyMessages(messageIds, [GMAIL_LABELS.UNREAD], undefined);
    }

    logger.info(`Emails marked as ${read ? 'read' : 'unread'}`, {
      userId,
      count: messageIds.length,
    });

    return {
      success: true,
      modified_count: messageIds.length,
    };
  } catch (error: any) {
    logger.error('Failed to mark read/unread', { error: error.message, userId });
    throw new Error(`Mark read/unread failed: ${error.message}`);
  }
}

/**
 * Star emails
 */
export async function starEmails(
  userId: string | undefined,
  messageIds: string[],
  starred: boolean = true
): Promise<{ success: boolean; modified_count: number }> {
  const client = new GmailClient(userId);

  try {
    await client.initialize();

    if (starred) {
      // Star = add STARRED label
      await client.batchModifyMessages(messageIds, [GMAIL_LABELS.STARRED], undefined);
    } else {
      // Unstar = remove STARRED label
      await client.batchModifyMessages(messageIds, undefined, [GMAIL_LABELS.STARRED]);
    }

    logger.info(`Emails ${starred ? 'starred' : 'unstarred'}`, {
      userId,
      count: messageIds.length,
    });

    return {
      success: true,
      modified_count: messageIds.length,
    };
  } catch (error: any) {
    logger.error('Failed to star/unstar', { error: error.message, userId });
    throw new Error(`Star/unstar failed: ${error.message}`);
  }
}

/**
 * Move emails to trash
 */
export async function deleteEmails(
  userId: string | undefined,
  messageIds: string[]
): Promise<{ success: boolean; deleted_count: number }> {
  const client = new GmailClient(userId);

  try {
    await client.initialize();

    // Trash each message
    for (const messageId of messageIds) {
      await client.trashMessage(messageId);
    }

    logger.info('Emails moved to trash', {
      userId,
      count: messageIds.length,
    });

    return {
      success: true,
      deleted_count: messageIds.length,
    };
  } catch (error: any) {
    logger.error('Failed to delete emails', { error: error.message, userId });
    throw new Error(`Delete failed: ${error.message}`);
  }
}

/**
 * Organize emails based on action
 */
export async function organizeEmails(
  userId: string | undefined,
  params: OrganizeEmailParams
): Promise<{ success: boolean; modified_count: number; action: string }> {
  try {
    let result: { success: boolean; modified_count?: number; archived_count?: number; deleted_count?: number };

    switch (params.action) {
      case 'label':
        if (!params.labels || params.labels.length === 0) {
          throw new Error('Labels required for label action');
        }
        result = await addLabels(userId, params.message_ids, params.labels);
        break;

      case 'archive':
        result = await archiveEmails(userId, params.message_ids);
        break;

      case 'mark_read':
        result = await markRead(userId, params.message_ids, true);
        break;

      case 'mark_unread':
        result = await markRead(userId, params.message_ids, false);
        break;

      case 'star':
        result = await starEmails(userId, params.message_ids, true);
        break;

      case 'unstar':
        result = await starEmails(userId, params.message_ids, false);
        break;

      case 'delete':
      case 'trash':
        result = await deleteEmails(userId, params.message_ids);
        break;

      default:
        throw new Error(`Unknown action: ${params.action}`);
    }

    logger.info('Organize emails completed', {
      userId,
      action: params.action,
      count: params.message_ids.length,
    });

    return {
      success: true,
      modified_count: result.modified_count || result.archived_count || result.deleted_count || 0,
      action: params.action,
    };
  } catch (error: any) {
    logger.error('Failed to organize emails', { error: error.message, userId, action: params.action });
    throw new Error(`Organize emails failed: ${error.message}`);
  }
}

/**
 * Get available labels for user
 */
export async function listLabels(
  userId: string | undefined
): Promise<Array<{ id: string; name: string; type: string }>> {
  const client = new GmailClient(userId);

  try {
    await client.initialize();

    const labels = await client.listLabels();

    logger.debug('Retrieved Gmail labels', {
      userId,
      count: labels.length,
    });

    return labels;
  } catch (error: any) {
    logger.error('Failed to list labels', { error: error.message, userId });
    throw new Error(`List labels failed: ${error.message}`);
  }
}
