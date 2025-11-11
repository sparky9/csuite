import { addDays, addWeeks, addMonths, addYears, parseISO, startOfDay } from 'date-fns';
import type { TaskRecord, TaskCreateInput } from '../types/index.js';
import { createTask } from '../db/tasks.js';
import { query } from '../db/client.js';
import { Logger } from '../utils/logger.js';

export type RecurrencePattern =
  | 'daily'
  | 'weekdays' // Mon-Fri
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly';

interface RecurrenceConfig {
  pattern: RecurrencePattern;
  interval: number; // For custom intervals (e.g., every 2 weeks)
}

/**
 * Parse recurrence pattern string into config
 * Examples: "daily", "weekly", "monthly", "every-2-weeks"
 */
export function parseRecurrencePattern(pattern: string): RecurrenceConfig | null {
  const normalized = pattern.toLowerCase().trim();

  // Handle standard patterns
  const standardPatterns: Record<string, RecurrencePattern> = {
    daily: 'daily',
    weekdays: 'weekdays',
    weekly: 'weekly',
    biweekly: 'biweekly',
    monthly: 'monthly',
    quarterly: 'quarterly',
    yearly: 'yearly',
  };

  if (standardPatterns[normalized]) {
    return {
      pattern: standardPatterns[normalized],
      interval: 1,
    };
  }

  // Handle "every-N-weeks/months/days" patterns
  const customMatch = normalized.match(/^every-(\d+)-(day|week|month)s?$/);
  if (customMatch) {
    const interval = parseInt(customMatch[1], 10);
    const unit = customMatch[2];

    if (unit === 'day') {
      return { pattern: 'daily', interval };
    } else if (unit === 'week') {
      return { pattern: 'weekly', interval };
    } else if (unit === 'month') {
      return { pattern: 'monthly', interval };
    }
  }

  return null;
}

/**
 * Calculate next occurrence date based on recurrence pattern
 */
export function calculateNextOccurrence(
  lastDueDate: Date | string,
  pattern: RecurrencePattern,
  interval: number = 1
): Date {
  const baseDate = typeof lastDueDate === 'string' ? parseISO(lastDueDate) : lastDueDate;
  const cleanDate = startOfDay(baseDate);

  switch (pattern) {
    case 'daily':
      return addDays(cleanDate, interval);

    case 'weekdays': {
      let next = addDays(cleanDate, 1);
      // Skip weekends
      while (next.getDay() === 0 || next.getDay() === 6) {
        next = addDays(next, 1);
      }
      return next;
    }

    case 'weekly':
      return addWeeks(cleanDate, interval);

    case 'biweekly':
      return addWeeks(cleanDate, 2);

    case 'monthly':
      return addMonths(cleanDate, interval);

    case 'quarterly':
      return addMonths(cleanDate, 3);

    case 'yearly':
      return addYears(cleanDate, interval);

    default:
      return addDays(cleanDate, interval);
  }
}

/**
 * Create next occurrence of a recurring task
 */
export async function createNextOccurrence(
  completedTask: TaskRecord,
  userId: string
): Promise<TaskRecord | null> {
  if (!completedTask.recurrence_pattern) {
    return null;
  }

  const config = parseRecurrencePattern(completedTask.recurrence_pattern);
  if (!config) {
    Logger.warn('Invalid recurrence pattern', {
      taskId: completedTask.id,
      pattern: completedTask.recurrence_pattern,
    });
    return null;
  }

  const currentDueDate = completedTask.dueDate ? parseISO(completedTask.dueDate) : new Date();
  const nextDueDate = calculateNextOccurrence(currentDueDate, config.pattern, config.interval);

  // Create new task with same properties but new due date
  const nextTaskInput: TaskCreateInput = {
    title: completedTask.title,
    description: completedTask.description ?? undefined,
    projectId: completedTask.projectId,
    dueDate: nextDueDate.toISOString(),
    status: 'todo',
    impact: completedTask.impact ?? undefined,
    effort: completedTask.effort ?? undefined,
    confidence: completedTask.confidence ?? undefined,
    estimatedMinutes: completedTask.estimatedMinutes ?? undefined,
    tags: completedTask.tags,
  };

  const nextTask = await createTask(userId, nextTaskInput);

  // Link to recurrence chain via parent ID
  const parentId = completedTask.recurrence_parent_id || completedTask.id;
  await query(
    `UPDATE task_items SET recurrence_pattern = $1, recurrence_parent_id = $2 WHERE id = $3`,
    [completedTask.recurrence_pattern, parentId, nextTask.id]
  );

  Logger.info('Created next recurrence', {
    userId,
    parentTaskId: parentId,
    completedTaskId: completedTask.id,
    nextTaskId: nextTask.id,
    nextDueDate: nextDueDate.toISOString(),
    pattern: config.pattern,
  });

  return nextTask;
}

/**
 * Get all instances in a recurrence chain
 */
export async function getRecurrenceChain(userId: string, taskId: string): Promise<TaskRecord[]> {
  // First find the parent (either this task or its parent)
  const parentQuery = await query<any>(
    `SELECT COALESCE(recurrence_parent_id, id) as parent_id FROM task_items WHERE id = $1 AND user_id = $2`,
    [taskId, userId]
  );

  if (parentQuery.rowCount === 0) {
    return [];
  }

  const parentId = parentQuery.rows[0].parent_id;

  // Get all tasks in this chain
  const chainQuery = await query<any>(
    `SELECT * FROM task_items
     WHERE user_id = $1
     AND (id = $2 OR recurrence_parent_id = $2)
     ORDER BY due_date ASC NULLS LAST`,
    [userId, parentId]
  );

  return chainQuery.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priorityLevel: row.priority_level,
    priorityScore: Number(row.priority_score ?? 0),
    impact: row.impact,
    effort: row.effort,
    confidence: row.confidence,
    dueDate: row.due_date ? row.due_date.toISOString() : null,
    startDate: row.start_date ? row.start_date.toISOString() : null,
    estimatedMinutes: row.estimated_minutes,
    actualMinutes: row.actual_minutes,
    tags: Array.isArray(row.tags) ? row.tags : [],
    blockedReason: row.blocked_reason,
    autoInsights: row.auto_insights,
    recurrence_pattern: row.recurrence_pattern,
    recurrence_parent_id: row.recurrence_parent_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    completedAt: row.completed_at ? row.completed_at.toISOString() : null,
  }));
}

/**
 * Update recurrence pattern for future occurrences
 */
export async function updateRecurrencePattern(
  userId: string,
  taskId: string,
  newPattern: string | null,
  applyToFutureOnly: boolean = true
): Promise<number> {
  if (applyToFutureOnly) {
    // Only update uncompleted tasks in the chain
    const result = await query(
      `UPDATE task_items
       SET recurrence_pattern = $1, updated_at = NOW()
       WHERE user_id = $2
       AND (id = $3 OR recurrence_parent_id = (
         SELECT COALESCE(recurrence_parent_id, id) FROM task_items WHERE id = $3
       ))
       AND status != 'done'`,
      [newPattern, userId, taskId]
    );
    return result.rowCount ?? 0;
  } else {
    // Update all tasks in the chain
    const result = await query(
      `UPDATE task_items
       SET recurrence_pattern = $1, updated_at = NOW()
       WHERE user_id = $2
       AND (id = $3 OR recurrence_parent_id = (
         SELECT COALESCE(recurrence_parent_id, id) FROM task_items WHERE id = $3
       ))`,
      [newPattern, userId, taskId]
    );
    return result.rowCount ?? 0;
  }
}
