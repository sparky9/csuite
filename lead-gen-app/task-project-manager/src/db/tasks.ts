import type { PoolClient, QueryResult } from 'pg';
import type {
  TaskCreateInput,
  TaskUpdateInput,
  TaskRecord,
  PriorityRecommendation,
  TaskListItem,
  TaskStatus,
} from '../types/index.js';
import { query, withTransaction } from './client.js';
import { calculatePriority, derivePriorityFromCreate, mergePrioritySignals } from '../utils/priority.js';
import { Logger } from '../utils/logger.js';

function mapRow(row: any): TaskRecord {
  return {
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
  };
}

export async function createTask(userId: string, input: TaskCreateInput): Promise<TaskRecord> {
  const priority = derivePriorityFromCreate(input);

  const result = await query<TaskRecord>(
    `INSERT INTO task_items (
      user_id, project_id, title, description, status, priority_level, priority_score,
      impact, effort, confidence, due_date, start_date, estimated_minutes, tags, blocked_reason, auto_insights, recurrence_pattern
    ) VALUES (
      $1, $2, $3, $4, COALESCE($5, 'todo'), $6, $7,
      $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
    )
    RETURNING *`,
    [
      userId,
      input.projectId ?? null,
      input.title,
      input.description ?? null,
      input.status ?? 'todo',
      priority.level,
      priority.score,
      input.impact ?? input.impacts ?? null,
      input.effort ?? null,
      input.confidence ?? null,
      input.dueDate ? new Date(input.dueDate) : null,
      input.startDate ? new Date(input.startDate) : null,
      input.estimatedMinutes ?? null,
      input.tags ?? null,
      input.blockedReason ?? null,
      {
        priorityReasons: priority.reasons,
        priorityInsights: priority.insights,
      },
      input.recurrencePattern ?? null,
    ],
  );

  return mapRow(result.rows[0]);
}

export async function updateTask(
  userId: string,
  input: TaskUpdateInput,
): Promise<TaskRecord | null> {
  return withTransaction(async (client: PoolClient) => {
    const existing = await client.query(`SELECT * FROM task_items WHERE id = $1 AND user_id = $2 FOR UPDATE`, [
      input.taskId,
      userId,
    ]);

    if (existing.rowCount === 0) {
      return null;
    }

    const current = mapRow(existing.rows[0]);
    const priority = mergePrioritySignals(current, input);

    const updated = await client.query(`
      UPDATE task_items
      SET
        title = COALESCE($3, title),
        description = $4,
        project_id = $5,
        status = COALESCE($6, status),
        priority_level = $7,
        priority_score = $8,
        impact = $9,
        effort = $10,
        confidence = $11,
        due_date = $12,
        start_date = $13,
        estimated_minutes = $14,
        actual_minutes = $15,
        blocked_reason = $16,
        tags = $17,
        auto_insights = COALESCE(auto_insights, '{}'::jsonb) || $18::jsonb,
        updated_at = NOW(),
        completed_at = CASE
          WHEN COALESCE($6, status) = 'done' AND completed_at IS NULL THEN NOW()
          WHEN COALESCE($6, status) <> 'done' THEN NULL
          ELSE completed_at
        END
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [
      input.taskId,
      userId,
      input.title ?? null,
      input.description ?? null,
      input.projectId ?? null,
      input.status ?? null,
      priority.level,
      priority.score,
      input.impact ?? null,
      input.effort ?? null,
      input.confidence ?? null,
      input.dueDate ? new Date(input.dueDate) : null,
      input.startDate ? new Date(input.startDate) : null,
      input.estimatedMinutes ?? null,
      input.actualMinutes ?? null,
      input.blockedReason ?? null,
      input.tags ?? null,
      {
        priorityReasons: priority.reasons,
        priorityInsights: priority.insights,
      },
    ]);

    return mapRow(updated.rows[0]);
  });
}

export async function listTasksForFocus(userId: string): Promise<TaskListItem[]> {
  const result = await query(
    `SELECT
      t.id,
      t.title,
      t.priority_level,
      t.priority_score,
      t.status,
      t.due_date,
      t.start_date,
      t.project_id,
      p.name AS project_name,
      t.blocked_reason,
      t.tags,
      t.estimated_minutes,
      t.auto_insights,
      COALESCE(t.updated_at, t.created_at) AS ref_date
    FROM task_items t
    LEFT JOIN task_projects p ON p.id = t.project_id
    WHERE t.user_id = $1 AND t.status != 'done'
    ORDER BY t.priority_score DESC NULLS LAST, t.due_date NULLS LAST
    LIMIT 250`,
    [userId],
  );

  return result.rows.map((row: any) => {
    const updated = row.ref_date instanceof Date ? row.ref_date : new Date(row.ref_date);
    const agingMs = Date.now() - updated.getTime();

    return {
      taskId: row.id,
      title: row.title,
      priorityLevel: row.priority_level,
      priorityScore: Number(row.priority_score ?? 0),
      status: row.status as TaskStatus,
      dueDate: row.due_date ? row.due_date.toISOString() : null,
      startDate: row.start_date ? row.start_date.toISOString() : null,
      projectId: row.project_id,
      projectName: row.project_name,
      blockedReason: row.blocked_reason,
      tags: Array.isArray(row.tags) ? row.tags : [],
      insights: row.auto_insights?.priorityInsights ?? [],
      estimateMinutes: row.estimated_minutes,
      agingDays: Math.max(0, Number((agingMs / (1000 * 60 * 60 * 24)).toFixed(1))),
    } satisfies TaskListItem;
  });
}

export async function getPriorityRecommendations(
  userId: string,
  limit = 10,
): Promise<PriorityRecommendation[]> {
  const result = await query(
    `SELECT
      t.id,
      t.title,
      t.priority_level,
      t.priority_score,
      t.due_date,
      p.name AS project_name,
      t.auto_insights
    FROM task_items t
    LEFT JOIN task_projects p ON p.id = t.project_id
    WHERE t.user_id = $1 AND t.status NOT IN ('done')
    ORDER BY t.priority_score DESC NULLS LAST
    LIMIT $2`,
    [userId, limit],
  );

  return result.rows.map((row: any) => ({
    taskId: row.id,
    title: row.title,
    priorityLevel: row.priority_level,
    score: Number(row.priority_score ?? 0),
    reasons: row.auto_insights?.priorityReasons ?? [],
    suggestedAction: deriveSuggestedAction(row.priority_level),
    dueDate: row.due_date ? row.due_date.toISOString() : null,
    projectName: row.project_name,
  }));
}

function deriveSuggestedAction(priorityLevel: string): string {
  switch (priorityLevel) {
    case 'urgent':
      return 'Work on this first or delegate immediately.';
    case 'high':
      return 'Schedule focused time today or tomorrow.';
    case 'medium':
      return 'Plan when to tackle it this week.';
    case 'low':
      return 'Keep parked until other priorities shift.';
    default:
      return 'Review and assign priority.';
  }
}

export async function markTaskCompleted(
  userId: string,
  taskId: string,
): Promise<TaskRecord | null> {
  const result = await query(
    `UPDATE task_items
     SET status = 'done', completed_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [taskId, userId],
  );

  if (result.rowCount === 0) {
    return null;
  }

  const completedTask = mapRow(result.rows[0]);

  // If task has recurrence pattern, create next occurrence
  if (completedTask.recurrence_pattern) {
    try {
      const { createNextOccurrence } = await import('../services/recurrence.js');
      await createNextOccurrence(completedTask, userId);
      Logger.info('Created next recurrence after completion', { userId, taskId, pattern: completedTask.recurrence_pattern });
    } catch (error) {
      Logger.error('Failed to create next recurrence', { userId, taskId, error });
      // Don't fail the completion if recurrence creation fails
    }
  }

  Logger.info('Task marked complete', { userId, taskId });
  return completedTask;
}

export async function deleteTask(userId: string, taskId: string): Promise<boolean> {
  const result = await query(`DELETE FROM task_items WHERE id = $1 AND user_id = $2`, [
    taskId,
    userId,
  ]);

  return (result.rowCount ?? 0) > 0;
}
