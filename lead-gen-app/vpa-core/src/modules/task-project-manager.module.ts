import { requireModuleAccess } from '../auth/module-access.js';
import { createUsageRecord, trackUsage } from '../db/usage.js';
import { logger } from '../utils/logger.js';
import { TaskService } from '../../../task-project-manager/src/services/task-service.js';
import type {
  TaskCreateInput,
  TaskUpdateInput,
  TaskRecord,
  TaskListResponse,
  PriorityRecommendation,
  ProgressReport,
  ProgressReportInput,
  TaskStatus,
  PriorityLevel,
} from '../../../task-project-manager/src/types/index.js';

const MODULE_ID = 'task-project-manager';
const DAY_MS = 86_400_000;

const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  urgent: '🔥 Urgent',
  high: '⬆ High',
  medium: '➖ Medium',
  low: '⬇ Low',
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  blocked: 'Blocked',
  waiting: 'Waiting',
  done: 'Completed',
};

type ModuleResult<T> = {
  content: Array<{ type: 'text'; text: string }>;
  data?: T;
};

type AddResult = ModuleResult<{ task: TaskRecord }>;
type UpdateResult = ModuleResult<{ task: TaskRecord }>;
type FocusResult = ModuleResult<{ focus: TaskListResponse }>;
type CompleteResult = ModuleResult<{ task: TaskRecord }>;
type DeleteResult = ModuleResult<{ taskId: string }>; // We currently only return confirmation

type RecommendationsResult = ModuleResult<{ recommendations: PriorityRecommendation[] }>;
type ProgressReportResult = ModuleResult<{ report: ProgressReport }>;

type NumericLike = string | number | null | undefined;

type Nullable<T> = T | null | undefined;

export class TaskProjectManagerModule {
  async addTask(params: any, userId: string): Promise<AddResult> {
    const startedAt = Date.now();
    await requireModuleAccess(userId, MODULE_ID);

    try {
      const input = this.mapCreateInput(params);
      const service = this.createService(userId);
      const task = await service.addTask(input);

      const text = this.formatTaskResponse('✅ Task created', task);

      await trackUsage(
        createUsageRecord(userId, MODULE_ID, 'task_add', {
          executionTimeMs: Date.now() - startedAt,
          metadata: {
            taskId: task.id,
            priority: task.priorityLevel,
            status: task.status,
            dueDate: task.dueDate,
          },
        }),
      );

      return {
        content: [
          {
            type: 'text',
            text,
          },
        ],
        data: { task },
      };
    } catch (error) {
      await this.trackFailure('task_add', userId, startedAt, error);
      throw error;
    }
  }

  async updateTask(params: any, userId: string): Promise<UpdateResult> {
    const startedAt = Date.now();
    await requireModuleAccess(userId, MODULE_ID);

    try {
      const input = this.mapUpdateInput(params);
      const service = this.createService(userId);
      const task = await service.updateTask(input);

      const text = this.formatTaskResponse('✏️ Task updated', task);

      await trackUsage(
        createUsageRecord(userId, MODULE_ID, 'task_update', {
          executionTimeMs: Date.now() - startedAt,
          metadata: { taskId: task.id, status: task.status, priority: task.priorityLevel },
        }),
      );

      return {
        content: [{ type: 'text', text }],
        data: { task },
      };
    } catch (error) {
      await this.trackFailure('task_update', userId, startedAt, error, params);
      throw error;
    }
  }

  async getFocusList(params: any, userId: string): Promise<FocusResult> {
    const startedAt = Date.now();
    await requireModuleAccess(userId, MODULE_ID);

    try {
      const service = this.createService(userId);
      const focus = await service.getFocusList();
      const text = this.formatFocusList(focus);

      await trackUsage(
        createUsageRecord(userId, MODULE_ID, 'task_focus', {
          executionTimeMs: Date.now() - startedAt,
          metadata: {
            total: focus.summary.total,
            overdue: focus.summary.overdue,
            blocked: focus.summary.blocked,
          },
        }),
      );

      return {
        content: [{ type: 'text', text }],
        data: { focus },
      };
    } catch (error) {
      await this.trackFailure('task_focus', userId, startedAt, error, params);
      throw error;
    }
  }

  async completeTask(params: any, userId: string): Promise<CompleteResult> {
    const startedAt = Date.now();
    await requireModuleAccess(userId, MODULE_ID);

    try {
      const taskId = this.extractTaskId(params);
      const service = this.createService(userId);
      const task = await service.completeTask(taskId);
      const text = this.formatTaskResponse('✅ Task completed', task);

      await trackUsage(
        createUsageRecord(userId, MODULE_ID, 'task_complete', {
          executionTimeMs: Date.now() - startedAt,
          metadata: {
            taskId,
            status: task.status,
            completedAt: task.completedAt,
          },
        }),
      );

      return {
        content: [{ type: 'text', text }],
        data: { task },
      };
    } catch (error) {
      await this.trackFailure('task_complete', userId, startedAt, error, params);
      throw error;
    }
  }

  async removeTask(params: any, userId: string): Promise<DeleteResult> {
    const startedAt = Date.now();
    await requireModuleAccess(userId, MODULE_ID);

    try {
      const taskId = this.extractTaskId(params);
      const service = this.createService(userId);
      await service.removeTask(taskId);

      await trackUsage(
        createUsageRecord(userId, MODULE_ID, 'task_delete', {
          executionTimeMs: Date.now() - startedAt,
          metadata: { taskId },
        }),
      );

      return {
        content: [
          {
            type: 'text',
            text: `🗑️ Task ${taskId} removed from the list.`,
          },
        ],
        data: { taskId },
      };
    } catch (error) {
      await this.trackFailure('task_delete', userId, startedAt, error, params);
      throw error;
    }
  }

  async getPriorityRecommendations(params: any, userId: string): Promise<RecommendationsResult> {
    const startedAt = Date.now();
    await requireModuleAccess(userId, MODULE_ID);

    try {
      const limit = this.parseLimit(params?.limit);
      const service = this.createService(userId);
      const recommendations = await service.getPriorityRecommendations(limit);
      const text = this.formatRecommendations(recommendations);

      await trackUsage(
        createUsageRecord(userId, MODULE_ID, 'task_recommendations', {
          executionTimeMs: Date.now() - startedAt,
          metadata: { limit: limit ?? undefined, count: recommendations.length },
        }),
      );

      return {
        content: [{ type: 'text', text }],
        data: { recommendations },
      };
    } catch (error) {
      await this.trackFailure('task_recommendations', userId, startedAt, error, params);
      throw error;
    }
  }

  async getProgressReport(params: any, userId: string): Promise<ProgressReportResult> {
    const startedAt = Date.now();
    await requireModuleAccess(userId, MODULE_ID);

    try {
      const input = this.mapProgressInput(params);
      const service = this.createService(userId);
      const report = await service.getProgressReport(input);
      const text = this.formatProgressReport(report);

      await trackUsage(
        createUsageRecord(userId, MODULE_ID, 'task_progress_report', {
          executionTimeMs: Date.now() - startedAt,
          metadata: {
            timeframe: input.timeframe ?? 'week',
            completed: report.completed.length,
            upcoming: report.upcoming.length,
          },
        }),
      );

      return {
        content: [{ type: 'text', text }],
        data: { report },
      };
    } catch (error) {
      await this.trackFailure('task_progress_report', userId, startedAt, error, params);
      throw error;
    }
  }

  private createService(userId: string): TaskService {
    return new TaskService(userId);
  }

  private mapCreateInput(params: any): TaskCreateInput {
    if (!params || typeof params !== 'object') {
      throw new Error('Task details are required to create a task');
    }

    const title = ensureString(params.title ?? params.name, 'title');

    const input: TaskCreateInput = {
      title,
    };

    const description = optionalString(params.description ?? params.details);
    if (description !== undefined) {
      input.description = description;
    }

    const projectId = optionalString(params.projectId ?? params.project_id ?? params.project);
    if (projectId !== undefined) {
      input.projectId = projectId;
    }

    const dueDate = coerceDateString(params.dueDate ?? params.due_date);
    if (dueDate !== undefined) {
      input.dueDate = dueDate;
    }

    const startDate = coerceDateString(params.startDate ?? params.start_date ?? params.begin_at);
    if (startDate !== undefined) {
      input.startDate = startDate;
    }

    const status = coerceStatus(params.status);
    if (status) {
      input.status = status;
    }

    const impact = coerceRating(params.impact ?? params.impacts ?? params.impact_score);
    if (impact !== undefined) {
      input.impact = impact;
    }

    const effort = coerceRating(params.effort ?? params.effort_score);
    if (effort !== undefined) {
      input.effort = effort;
    }

    const confidence = coerceRating(params.confidence ?? params.confidence_score);
    if (confidence !== undefined) {
      input.confidence = confidence;
    }

    const estimate = coercePositiveMinutes(params.estimatedMinutes ?? params.estimate ?? params.estimated_minutes);
    if (estimate !== undefined) {
      input.estimatedMinutes = estimate;
    }

    const tags = parseTagsValue(params.tags ?? params.labels);
    if (tags !== undefined) {
      input.tags = tags;
    }

    const blocked = optionalString(params.blockedReason ?? params.blocked_reason ?? params.blocker);
    if (blocked !== undefined) {
      input.blockedReason = blocked;
    }

    return input;
  }

  private mapUpdateInput(params: any): TaskUpdateInput {
    if (!params || typeof params !== 'object') {
      throw new Error('Task update payload must include the taskId');
    }

    const taskId = ensureString(params.taskId ?? params.task_id ?? params.id, 'taskId');
    const update: TaskUpdateInput = { taskId };

    if ('title' in params || 'name' in params) {
      const value = params.title ?? params.name;
      update.title = optionalString(value);
    }

    if ('description' in params || 'details' in params) {
      update.description = optionalNullableString(params.description ?? params.details);
    }

    if ('projectId' in params || 'project_id' in params || 'project' in params) {
      update.projectId = optionalNullableString(params.projectId ?? params.project_id ?? params.project);
    }

    if ('dueDate' in params || 'due_date' in params) {
      update.dueDate = coerceDateNullable(params.dueDate ?? params.due_date);
    }

    if ('startDate' in params || 'start_date' in params || 'begin_at' in params) {
      update.startDate = coerceDateNullable(params.startDate ?? params.start_date ?? params.begin_at);
    }

    if ('status' in params) {
      const status = coerceStatus(params.status);
      if (status) {
        update.status = status;
      }
    }

    if ('impact' in params || 'impacts' in params || 'impact_score' in params) {
      update.impact = coerceRatingNullable(params.impact ?? params.impacts ?? params.impact_score);
    }

    if ('effort' in params || 'effort_score' in params) {
      update.effort = coerceRatingNullable(params.effort ?? params.effort_score);
    }

    if ('confidence' in params || 'confidence_score' in params) {
      update.confidence = coerceRatingNullable(params.confidence ?? params.confidence_score);
    }

    if ('estimatedMinutes' in params || 'estimate' in params || 'estimated_minutes' in params) {
      update.estimatedMinutes = coerceMinutesNullable(params.estimatedMinutes ?? params.estimate ?? params.estimated_minutes);
    }

    if ('actualMinutes' in params || 'actual_minutes' in params || 'duration' in params) {
      update.actualMinutes = coerceMinutesNullable(params.actualMinutes ?? params.actual_minutes ?? params.duration, true);
    }

    if ('blockedReason' in params || 'blocked_reason' in params || 'blocker' in params) {
      update.blockedReason = optionalNullableString(params.blockedReason ?? params.blocked_reason ?? params.blocker);
    }

    if ('tags' in params || 'labels' in params) {
      update.tags = parseTagsNullable(params.tags ?? params.labels);
    }

    return update;
  }

  private mapProgressInput(params: any): ProgressReportInput {
    if (!params || typeof params !== 'object') {
      return {};
    }

    const input: ProgressReportInput = {};

    if ('timeframe' in params) {
      const timeframe = normalizeTimeframe(params.timeframe);
      if (timeframe) {
        input.timeframe = timeframe;
      }
    }

    if ('referenceDate' in params || 'reference_date' in params || 'as_of' in params) {
      const ref = coerceDateString(params.referenceDate ?? params.reference_date ?? params.as_of);
      if (ref !== undefined) {
        input.referenceDate = ref;
      }
    }

    return input;
  }

  private extractTaskId(params: any): string {
    if (typeof params === 'string') {
      return ensureString(params, 'taskId');
    }

    if (params && typeof params === 'object') {
      return ensureString(params.taskId ?? params.task_id ?? params.id, 'taskId');
    }

    throw new Error('taskId is required');
  }

  private parseLimit(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const limit = Number(value);
    if (!Number.isFinite(limit)) {
      return undefined;
    }

    const clamped = Math.min(50, Math.max(1, Math.round(limit)));
    return clamped;
  }

  private async trackFailure(
    toolName: string,
    userId: string,
    startedAt: number,
    error: unknown,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Task module ${toolName} failed`, { userId, message, metadata });

    await trackUsage(
      createUsageRecord(userId, MODULE_ID, toolName, {
        success: false,
        executionTimeMs: Date.now() - startedAt,
        errorMessage: message,
        metadata,
      }),
    );
  }

  private formatTaskResponse(prefix: string, task: TaskRecord): string {
    const details = this.describeTask(task);
    return `${prefix}\n\n${details}`.trim();
  }

  private describeTask(task: TaskRecord): string {
    const lines: string[] = [];
    lines.push(`Title: ${task.title}`);
    lines.push(`Status: ${formatStatus(task.status)}`);
    lines.push(`Priority: ${formatPriority(task.priorityLevel)} (score ${task.priorityScore.toFixed(1)})`);

    const due = formatDue(task.dueDate);
    if (due) {
      lines.push(`Due: ${due}`);
    }

    if (task.estimatedMinutes) {
      lines.push(`Estimate: ${task.estimatedMinutes} minutes`);
    }

    if (task.tags?.length) {
      lines.push(`Tags: ${task.tags.join(', ')}`);
    }

    if (task.blockedReason) {
      lines.push(`Blocked: ${task.blockedReason}`);
    }

    lines.push(`Created: ${formatDateTime(task.createdAt)}`);

    if (task.updatedAt !== task.createdAt) {
      lines.push(`Updated: ${formatDateTime(task.updatedAt)}`);
    }

    if (task.completedAt) {
      lines.push(`Completed: ${formatDateTime(task.completedAt)}`);
    }

    return lines.join('\n');
  }

  private formatFocusList(focus: TaskListResponse): string {
    const lines: string[] = [];

    lines.push('Focus overview');
    lines.push(
      `Total: ${focus.summary.total} • Overdue: ${focus.summary.overdue} • Due today: ${focus.summary.dueToday} • Blocked: ${focus.summary.blocked}`,
    );
    lines.push('');

    for (const section of focus.sections) {
      lines.push(`${section.label} (${section.items.length})`);

      if (!section.items.length) {
        lines.push('  • No tasks queued here.');
        lines.push('');
        continue;
      }

      section.items.forEach((task, index) => {
        const extras: string[] = [];
        const due = formatDue(task.dueDate);
        if (due) {
          extras.push(due);
        }
        if (task.projectName) {
          extras.push(task.projectName);
        }
        if (task.blockedReason) {
          extras.push(`Blocked: ${task.blockedReason}`);
        }

        const extraText = extras.length ? ` (${extras.join(' • ')})` : '';
        lines.push(`  ${index + 1}. ${task.title} — ${formatPriority(task.priorityLevel)}${extraText}`);
      });

      lines.push('');
    }

    lines.push('Quick stats');
    focus.stats.forEach((stat) => {
      lines.push(`- ${stat.label}: ${stat.value}`);
    });

    return lines.join('\n');
  }

  private formatRecommendations(recommendations: PriorityRecommendation[]): string {
    if (!recommendations.length) {
      return 'No priority recommendations available. Everything looks under control.';
    }

    const lines: string[] = [];
    lines.push('Priority recommendations');

    recommendations.forEach((rec, index) => {
      const extras: string[] = [];
      const due = formatDue(rec.dueDate);
      if (due) {
        extras.push(due);
      }
      if (rec.projectName) {
        extras.push(rec.projectName);
      }

      const reasons = Array.isArray(rec.reasons) && rec.reasons.length
        ? `Reasons: ${rec.reasons.slice(0, 3).join('; ')}`
        : undefined;

      const suggested = rec.suggestedAction ? `Next: ${rec.suggestedAction}` : undefined;

      const extraText = extras.length ? ` [${extras.join(' • ')}]` : '';

      lines.push(
        `${index + 1}. ${rec.title} — ${formatPriority(rec.priorityLevel)} (score ${rec.score.toFixed(1)})${extraText}`,
      );

      if (reasons) {
        lines.push(`   ${reasons}`);
      }

      if (suggested) {
        lines.push(`   ${suggested}`);
      }
    });

    return lines.join('\n');
  }

  private formatProgressReport(report: ProgressReport): string {
    const lines: string[] = [];
    lines.push(`Progress report — ${report.periodLabel}`);
    lines.push('');
    lines.push('Metrics');

    report.metrics.forEach((metric) => {
      const delta = metric.delta !== undefined && metric.delta !== null
        ? ` (${metric.delta >= 0 ? '+' : ''}${metric.delta})`
        : '';
      lines.push(`- ${metric.label}: ${metric.value}${delta}`);
    });

    lines.push('');

    report.sections.forEach((section) => {
      lines.push(`${section.heading}: ${section.highlight}`);
      section.bullets.forEach((bullet) => {
        const cleaned = bullet.replace(/^•\s*/, '').trim();
        lines.push(`  • ${cleaned}`);
      });
      lines.push('');
    });

    if (report.completed.length) {
      lines.push('Completed highlights');
      report.completed.slice(0, 5).forEach((task) => {
        const due = formatDue(task.dueDate);
        const suffix = due ? ` (${due})` : '';
        lines.push(`- ${task.title}${suffix}`);
      });
      lines.push('');
    }

    if (report.upcoming.length) {
      lines.push('Upcoming tasks');
      report.upcoming.slice(0, 5).forEach((task) => {
        const due = formatDue(task.dueDate);
        const suffix = due ? ` (${due})` : '';
        lines.push(`- ${task.title}${suffix}`);
      });
      lines.push('');
    }

    return lines.join('\n').trim();
  }
}

function ensureString(value: unknown, field: string): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length) {
      return trimmed;
    }
  }

  throw new Error(`${field} is required`);
}

function optionalString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }

  return undefined;
}

function optionalNullableString(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  return undefined;
}

function coerceDateString(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed.length) {
      return undefined;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }

    return trimmed;
  }

  return undefined;
}

function coerceDateNullable(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  return coerceDateString(value) ?? null;
}

function coerceStatus(value: unknown): TaskStatus | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');

  const map: Record<string, TaskStatus> = {
    todo: 'todo',
    'to_do': 'todo',
    'to-do': 'todo',
    in_progress: 'in_progress',
    'in-progress': 'in_progress',
    inprogress: 'in_progress',
    progress: 'in_progress',
    blocked: 'blocked',
    waiting: 'waiting',
    pending: 'waiting',
    done: 'done',
    complete: 'done',
    completed: 'done',
  };

  return map[normalized];
}

function coerceRating(value: NumericLike): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const num = Number(value);
  if (!Number.isFinite(num)) {
    return undefined;
  }

  return clamp(num, 1, 5);
}

function coerceRatingNullable(value: NumericLike): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  const num = Number(value);
  if (!Number.isFinite(num)) {
    return undefined;
  }

  return clamp(num, 1, 5);
}

function coercePositiveMinutes(value: NumericLike): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return undefined;
  }

  return Math.round(num);
}

function coerceMinutesNullable(value: NumericLike, allowZero = false): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  const num = Number(value);
  if (!Number.isFinite(num)) {
    return undefined;
  }

  if (!allowZero && num <= 0) {
    return undefined;
  }

  if (allowZero && num < 0) {
    return undefined;
  }

  return Math.round(num);
}

function parseTagsValue(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value
      .map((tag) => String(tag).trim())
      .filter((tag) => tag.length > 0);
  }

  if (typeof value === 'string') {
    return value
      .split(/[;,]/)
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }

  return undefined;
}

function parseTagsNullable(value: unknown): string[] | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  return parseTagsValue(value) ?? [];
}

function normalizeTimeframe(value: unknown): ProgressReportInput['timeframe'] | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (['day', 'daily'].includes(normalized)) {
    return 'day';
  }
  if (['week', 'weekly'].includes(normalized)) {
    return 'week';
  }
  if (['month', 'monthly'].includes(normalized)) {
    return 'month';
  }

  return undefined;
}

function formatPriority(level: PriorityLevel): string {
  return PRIORITY_LABELS[level] ?? level;
}

function formatStatus(status: TaskStatus): string {
  return STATUS_LABELS[status] ?? status;
}

function formatDue(value: Nullable<string>): string | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const diffDays = Math.round((target - today) / DAY_MS);

  if (diffDays === 0) {
    return 'due Today';
  }
  if (diffDays === 1) {
    return 'due Tomorrow';
  }
  if (diffDays === -1) {
    return 'overdue by 1 day';
  }
  if (diffDays < -1) {
    return `overdue by ${Math.abs(diffDays)} days`;
  }
  if (diffDays > 1 && diffDays <= 7) {
    return `due in ${diffDays} days`;
  }

  return `due ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return Math.round(value * 100) / 100;
}
