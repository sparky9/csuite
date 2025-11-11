/**
 * Batch Operations Service
 * High-performance bulk operations for prospects
 */

import { db } from '../db/client.js';
import { logger } from '../utils/logger.js';
import type { ProspectStatus } from '../types/leadtracker.types.js';

/**
 * Result from batch operations
 */
export interface BatchResult {
  success: boolean;
  updated: number;
  failed: number;
  errors?: string[];
}

/**
 * Batch update prospect statuses
 */
export async function batchUpdateStatus(
  prospectIds: string[],
  newStatus: ProspectStatus,
  userId?: string
): Promise<BatchResult> {
  const result: BatchResult = {
    success: false,
    updated: 0,
    failed: 0,
    errors: [],
  };

  if (!prospectIds || prospectIds.length === 0) {
    result.errors = ['No prospect IDs provided'];
    return result;
  }

  try {
    logger.info('Starting batch status update', {
      count: prospectIds.length,
      newStatus,
      userId,
    });

    await db.transaction(async (client) => {
      // Update prospects
      const updateQuery = userId
        ? `UPDATE prospects
           SET status = $1, updated_at = NOW()
           WHERE id = ANY($2::uuid[]) AND user_id = $3`
        : `UPDATE prospects
           SET status = $1, updated_at = NOW()
           WHERE id = ANY($2::uuid[])`;

      const updateParams = userId
        ? [newStatus, prospectIds, userId]
        : [newStatus, prospectIds];

      const updateResult = await client.query(updateQuery, updateParams);
      result.updated = updateResult.rowCount || 0;

      // Log activity for each updated prospect
      const activityQuery = userId
        ? `INSERT INTO activities (prospect_id, activity_type, activity_date, notes, user_id)
           SELECT id, 'note', NOW(), $1, $2
           FROM prospects
           WHERE id = ANY($3::uuid[]) AND user_id = $2`
        : `INSERT INTO activities (prospect_id, activity_type, activity_date, notes)
           SELECT id, 'note', NOW(), $1
           FROM prospects
           WHERE id = ANY($2::uuid[])`;

      const activityParams = userId
        ? [`Batch status change to ${newStatus}`, userId, prospectIds]
        : [`Batch status change to ${newStatus}`, prospectIds];

      await client.query(activityQuery, activityParams);
    });

    result.success = true;
    result.failed = prospectIds.length - result.updated;

    logger.info('Batch status update completed', result);
  } catch (error) {
    logger.error('Batch status update failed', { error });
    result.errors = [error instanceof Error ? error.message : String(error)];
    result.failed = prospectIds.length;
  }

  return result;
}

/**
 * Batch add tags to prospects
 */
export async function batchAddTags(
  prospectIds: string[],
  tags: string[],
  userId?: string
): Promise<BatchResult> {
  const result: BatchResult = {
    success: false,
    updated: 0,
    failed: 0,
    errors: [],
  };

  if (!prospectIds || prospectIds.length === 0) {
    result.errors = ['No prospect IDs provided'];
    return result;
  }

  if (!tags || tags.length === 0) {
    result.errors = ['No tags provided'];
    return result;
  }

  try {
    logger.info('Starting batch add tags', {
      count: prospectIds.length,
      tags,
      userId,
    });

    // Update prospects - add tags without duplicates
    const updateQuery = userId
      ? `UPDATE prospects
         SET tags = array(SELECT DISTINCT unnest(tags || $1::text[])),
             updated_at = NOW()
         WHERE id = ANY($2::uuid[]) AND user_id = $3`
      : `UPDATE prospects
         SET tags = array(SELECT DISTINCT unnest(tags || $1::text[])),
             updated_at = NOW()
         WHERE id = ANY($2::uuid[])`;

    const updateParams = userId ? [tags, prospectIds, userId] : [tags, prospectIds];

    const updateResult = await db.query(updateQuery, updateParams);
    result.updated = updateResult.rowCount || 0;
    result.success = true;
    result.failed = prospectIds.length - result.updated;

    logger.info('Batch add tags completed', result);
  } catch (error) {
    logger.error('Batch add tags failed', { error });
    result.errors = [error instanceof Error ? error.message : String(error)];
    result.failed = prospectIds.length;
  }

  return result;
}

/**
 * Batch remove tags from prospects
 */
export async function batchRemoveTags(
  prospectIds: string[],
  tags: string[],
  userId?: string
): Promise<BatchResult> {
  const result: BatchResult = {
    success: false,
    updated: 0,
    failed: 0,
    errors: [],
  };

  if (!prospectIds || prospectIds.length === 0) {
    result.errors = ['No prospect IDs provided'];
    return result;
  }

  if (!tags || tags.length === 0) {
    result.errors = ['No tags provided'];
    return result;
  }

  try {
    logger.info('Starting batch remove tags', {
      count: prospectIds.length,
      tags,
      userId,
    });

    // Update prospects - remove specified tags
    const updateQuery = userId
      ? `UPDATE prospects
         SET tags = array(SELECT unnest(tags) EXCEPT SELECT unnest($1::text[])),
             updated_at = NOW()
         WHERE id = ANY($2::uuid[]) AND user_id = $3`
      : `UPDATE prospects
         SET tags = array(SELECT unnest(tags) EXCEPT SELECT unnest($1::text[])),
             updated_at = NOW()
         WHERE id = ANY($2::uuid[])`;

    const updateParams = userId ? [tags, prospectIds, userId] : [tags, prospectIds];

    const updateResult = await db.query(updateQuery, updateParams);
    result.updated = updateResult.rowCount || 0;
    result.success = true;
    result.failed = prospectIds.length - result.updated;

    logger.info('Batch remove tags completed', result);
  } catch (error) {
    logger.error('Batch remove tags failed', { error });
    result.errors = [error instanceof Error ? error.message : String(error)];
    result.failed = prospectIds.length;
  }

  return result;
}

/**
 * Batch reschedule follow-ups (shift by days)
 */
export async function batchReschedule(
  prospectIds: string[],
  shiftDays: number,
  userId?: string
): Promise<BatchResult> {
  const result: BatchResult = {
    success: false,
    updated: 0,
    failed: 0,
    errors: [],
  };

  if (!prospectIds || prospectIds.length === 0) {
    result.errors = ['No prospect IDs provided'];
    return result;
  }

  try {
    logger.info('Starting batch reschedule', {
      count: prospectIds.length,
      shiftDays,
      userId,
    });

    // Update follow-ups
    const updateQuery = userId
      ? `UPDATE follow_ups
         SET due_date = due_date + ($1 || ' days')::interval
         WHERE prospect_id = ANY($2::uuid[])
           AND completed = FALSE
           AND user_id = $3`
      : `UPDATE follow_ups
         SET due_date = due_date + ($1 || ' days')::interval
         WHERE prospect_id = ANY($2::uuid[])
           AND completed = FALSE`;

    const updateParams = userId ? [shiftDays, prospectIds, userId] : [shiftDays, prospectIds];

    const updateResult = await db.query(updateQuery, updateParams);
    result.updated = updateResult.rowCount || 0;
    result.success = true;
    result.failed = prospectIds.length - result.updated;

    logger.info('Batch reschedule completed', result);
  } catch (error) {
    logger.error('Batch reschedule failed', { error });
    result.errors = [error instanceof Error ? error.message : String(error)];
    result.failed = prospectIds.length;
  }

  return result;
}

/**
 * Batch delete prospects
 */
export async function batchDelete(
  prospectIds: string[],
  userId?: string
): Promise<BatchResult> {
  const result: BatchResult = {
    success: false,
    updated: 0,
    failed: 0,
    errors: [],
  };

  if (!prospectIds || prospectIds.length === 0) {
    result.errors = ['No prospect IDs provided'];
    return result;
  }

  try {
    logger.info('Starting batch delete', {
      count: prospectIds.length,
      userId,
    });

    // Delete prospects (cascade will handle related records)
    const deleteQuery = userId
      ? `DELETE FROM prospects WHERE id = ANY($1::uuid[]) AND user_id = $2`
      : `DELETE FROM prospects WHERE id = ANY($1::uuid[])`;

    const deleteParams = userId ? [prospectIds, userId] : [prospectIds];

    const deleteResult = await db.query(deleteQuery, deleteParams);
    result.updated = deleteResult.rowCount || 0;
    result.success = true;
    result.failed = prospectIds.length - result.updated;

    logger.info('Batch delete completed', result);
  } catch (error) {
    logger.error('Batch delete failed', { error });
    result.errors = [error instanceof Error ? error.message : String(error)];
    result.failed = prospectIds.length;
  }

  return result;
}

/**
 * Batch assign source to prospects
 */
export async function batchAssignSource(
  prospectIds: string[],
  source: string,
  userId?: string
): Promise<BatchResult> {
  const result: BatchResult = {
    success: false,
    updated: 0,
    failed: 0,
    errors: [],
  };

  if (!prospectIds || prospectIds.length === 0) {
    result.errors = ['No prospect IDs provided'];
    return result;
  }

  if (!source || source.trim() === '') {
    result.errors = ['No source provided'];
    return result;
  }

  try {
    logger.info('Starting batch assign source', {
      count: prospectIds.length,
      source,
      userId,
    });

    // Update prospects
    const updateQuery = userId
      ? `UPDATE prospects
         SET source = $1, updated_at = NOW()
         WHERE id = ANY($2::uuid[]) AND user_id = $3`
      : `UPDATE prospects
         SET source = $1, updated_at = NOW()
         WHERE id = ANY($2::uuid[])`;

    const updateParams = userId ? [source, prospectIds, userId] : [source, prospectIds];

    const updateResult = await db.query(updateQuery, updateParams);
    result.updated = updateResult.rowCount || 0;
    result.success = true;
    result.failed = prospectIds.length - result.updated;

    logger.info('Batch assign source completed', result);
  } catch (error) {
    logger.error('Batch assign source failed', { error });
    result.errors = [error instanceof Error ? error.message : String(error)];
    result.failed = prospectIds.length;
  }

  return result;
}
