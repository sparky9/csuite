import { query } from '../db/client.js';
import type { TaskStatus } from '../types/index.js';
import { Logger } from '../utils/logger.js';

export interface BatchUpdateResult {
  success: boolean;
  updated: number;
  failed: number;
  errors?: string[];
}

/**
 * Batch update status for multiple tasks
 */
export async function batchUpdateStatus(
  userId: string,
  taskIds: string[],
  newStatus: TaskStatus
): Promise<BatchUpdateResult> {
  if (!taskIds.length) {
    return { success: true, updated: 0, failed: 0 };
  }

  try {
    const result = await query(
      `UPDATE task_items
       SET status = $1, updated_at = NOW(),
           completed_at = CASE
             WHEN $1 = 'done' AND completed_at IS NULL THEN NOW()
             WHEN $1 <> 'done' THEN NULL
             ELSE completed_at
           END
       WHERE user_id = $2 AND id = ANY($3::uuid[])
       RETURNING id`,
      [newStatus, userId, taskIds]
    );

    Logger.info('Batch status update completed', {
      userId,
      taskCount: taskIds.length,
      updated: result.rowCount,
      newStatus,
    });

    return {
      success: true,
      updated: result.rowCount ?? 0,
      failed: taskIds.length - (result.rowCount ?? 0),
    };
  } catch (error) {
    Logger.error('Batch status update failed', { userId, error });
    return {
      success: false,
      updated: 0,
      failed: taskIds.length,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

/**
 * Batch add tags to multiple tasks
 */
export async function batchAddTags(
  userId: string,
  taskIds: string[],
  tagsToAdd: string[]
): Promise<BatchUpdateResult> {
  if (!taskIds.length || !tagsToAdd.length) {
    return { success: true, updated: 0, failed: 0 };
  }

  try {
    const result = await query(
      `UPDATE task_items
       SET tags = array(SELECT DISTINCT unnest(COALESCE(tags, ARRAY[]::text[]) || $1::text[])),
           updated_at = NOW()
       WHERE user_id = $2 AND id = ANY($3::uuid[])
       RETURNING id`,
      [tagsToAdd, userId, taskIds]
    );

    Logger.info('Batch tag addition completed', {
      userId,
      taskCount: taskIds.length,
      updated: result.rowCount,
      tagsAdded: tagsToAdd,
    });

    return {
      success: true,
      updated: result.rowCount ?? 0,
      failed: taskIds.length - (result.rowCount ?? 0),
    };
  } catch (error) {
    Logger.error('Batch tag addition failed', { userId, error });
    return {
      success: false,
      updated: 0,
      failed: taskIds.length,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

/**
 * Batch remove tags from multiple tasks
 */
export async function batchRemoveTags(
  userId: string,
  taskIds: string[],
  tagsToRemove: string[]
): Promise<BatchUpdateResult> {
  if (!taskIds.length || !tagsToRemove.length) {
    return { success: true, updated: 0, failed: 0 };
  }

  try {
    const result = await query(
      `UPDATE task_items
       SET tags = array(SELECT unnest(tags) EXCEPT SELECT unnest($1::text[])),
           updated_at = NOW()
       WHERE user_id = $2 AND id = ANY($3::uuid[])
       RETURNING id`,
      [tagsToRemove, userId, taskIds]
    );

    Logger.info('Batch tag removal completed', {
      userId,
      taskCount: taskIds.length,
      updated: result.rowCount,
      tagsRemoved: tagsToRemove,
    });

    return {
      success: true,
      updated: result.rowCount ?? 0,
      failed: taskIds.length - (result.rowCount ?? 0),
    };
  } catch (error) {
    Logger.error('Batch tag removal failed', { userId, error });
    return {
      success: false,
      updated: 0,
      failed: taskIds.length,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

/**
 * Batch reschedule tasks (shift due dates by N days)
 */
export async function batchReschedule(
  userId: string,
  taskIds: string[],
  shiftDays: number
): Promise<BatchUpdateResult> {
  if (!taskIds.length) {
    return { success: true, updated: 0, failed: 0 };
  }

  try {
    const result = await query(
      `UPDATE task_items
       SET due_date = due_date + ($1 || ' days')::interval,
           updated_at = NOW()
       WHERE user_id = $2 AND id = ANY($3::uuid[]) AND due_date IS NOT NULL
       RETURNING id`,
      [shiftDays, userId, taskIds]
    );

    Logger.info('Batch reschedule completed', {
      userId,
      taskCount: taskIds.length,
      updated: result.rowCount,
      shiftDays,
    });

    return {
      success: true,
      updated: result.rowCount ?? 0,
      failed: taskIds.length - (result.rowCount ?? 0),
    };
  } catch (error) {
    Logger.error('Batch reschedule failed', { userId, error });
    return {
      success: false,
      updated: 0,
      failed: taskIds.length,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

/**
 * Batch assign tasks to a project
 */
export async function batchAssignToProject(
  userId: string,
  taskIds: string[],
  projectId: string | null
): Promise<BatchUpdateResult> {
  if (!taskIds.length) {
    return { success: true, updated: 0, failed: 0 };
  }

  try {
    const result = await query(
      `UPDATE task_items
       SET project_id = $1, updated_at = NOW()
       WHERE user_id = $2 AND id = ANY($3::uuid[])
       RETURNING id`,
      [projectId, userId, taskIds]
    );

    Logger.info('Batch project assignment completed', {
      userId,
      taskCount: taskIds.length,
      updated: result.rowCount,
      projectId,
    });

    return {
      success: true,
      updated: result.rowCount ?? 0,
      failed: taskIds.length - (result.rowCount ?? 0),
    };
  } catch (error) {
    Logger.error('Batch project assignment failed', { userId, error });
    return {
      success: false,
      updated: 0,
      failed: taskIds.length,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

/**
 * Batch delete tasks
 */
export async function batchDeleteTasks(
  userId: string,
  taskIds: string[]
): Promise<BatchUpdateResult> {
  if (!taskIds.length) {
    return { success: true, updated: 0, failed: 0 };
  }

  try {
    const result = await query(
      `DELETE FROM task_items
       WHERE user_id = $1 AND id = ANY($2::uuid[])
       RETURNING id`,
      [userId, taskIds]
    );

    Logger.info('Batch delete completed', {
      userId,
      taskCount: taskIds.length,
      deleted: result.rowCount,
    });

    return {
      success: true,
      updated: result.rowCount ?? 0,
      failed: taskIds.length - (result.rowCount ?? 0),
    };
  } catch (error) {
    Logger.error('Batch delete failed', { userId, error });
    return {
      success: false,
      updated: 0,
      failed: taskIds.length,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}
