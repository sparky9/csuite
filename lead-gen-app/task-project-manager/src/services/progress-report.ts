import { format, parseISO, startOfDay, subDays } from 'date-fns';
import { query } from '../db/client.js';
import type {
  ProgressReport,
  ProgressReportInput,
  TaskListItem,
  ProgressMetric,
  ProgressReportSection,
} from '../types/index.js';

function formatPeriodLabel(timeframe: ProgressReportInput['timeframe'], reference: Date): string {
  switch (timeframe) {
    case 'day':
      return format(reference, 'EEEE, MMM d');
    case 'month':
      return format(reference, 'MMMM yyyy');
    default:
      return `Week of ${format(reference, 'MMM d')}`;
  }
}

async function fetchCompletedTasks(userId: string, since: Date): Promise<TaskListItem[]> {
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
      t.tags,
      t.estimated_minutes,
      t.completed_at
    FROM task_items t
    LEFT JOIN task_projects p ON p.id = t.project_id
    WHERE t.user_id = $1 AND t.completed_at IS NOT NULL AND t.completed_at >= $2
    ORDER BY t.completed_at DESC
    LIMIT 200`,
    [userId, since],
  );

  return result.rows.map((row: any) => ({
    taskId: row.id,
    title: row.title,
    priorityLevel: row.priority_level,
    priorityScore: Number(row.priority_score ?? 0),
    status: 'done',
    dueDate: row.due_date ? row.due_date.toISOString() : null,
    startDate: row.start_date ? row.start_date.toISOString() : null,
    projectId: row.project_id,
    projectName: row.project_name,
    tags: Array.isArray(row.tags) ? row.tags : [],
    insights: [],
    estimateMinutes: row.estimated_minutes,
    agingDays: 0,
    completedAt: row.completed_at?.toISOString?.() ?? null,
  }));
}

async function fetchUpcomingTasks(userId: string, until: Date): Promise<TaskListItem[]> {
  const result = await query(
    `SELECT
      t.id,
      t.title,
      t.priority_level,
      t.priority_score,
      t.status,
      t.due_date,
      t.project_id,
      p.name AS project_name,
      t.tags
    FROM task_items t
    LEFT JOIN task_projects p ON p.id = t.project_id
    WHERE t.user_id = $1 AND t.status <> 'done' AND t.due_date IS NOT NULL AND t.due_date <= $2
    ORDER BY t.due_date ASC
    LIMIT 100`,
    [userId, until],
  );

  return result.rows.map((row: any) => ({
    taskId: row.id,
    title: row.title,
    priorityLevel: row.priority_level,
    priorityScore: Number(row.priority_score ?? 0),
    status: row.status,
    dueDate: row.due_date ? row.due_date.toISOString() : null,
    startDate: null,
    projectId: row.project_id,
    projectName: row.project_name,
    tags: Array.isArray(row.tags) ? row.tags : [],
    insights: [],
    estimateMinutes: null,
    agingDays: 0,
  }));
}

function computeMetrics(completed: TaskListItem[], timeframe: ProgressReportInput['timeframe']): ProgressMetric[] {
  const velocity = completed.length;
  const urgentCompleted = completed.filter((task) => task.priorityLevel === 'urgent').length;
  const highCompleted = completed.filter((task) => task.priorityLevel === 'high').length;

  const estimatedMinutes = completed.reduce((total, task) => total + (task.estimateMinutes ?? 30), 0);

  return [
    { label: 'Tasks completed', value: velocity },
    { label: 'Urgent cleared', value: urgentCompleted },
    { label: 'High priority cleared', value: highCompleted },
    { label: 'Estimated minutes invested', value: estimatedMinutes },
  ];
}

function buildHighlights(completed: TaskListItem[]): ProgressReportSection[] {
  const topCompleted = completed.slice(0, 5);

  const completedSection: ProgressReportSection = {
    heading: 'Wins this period',
    highlight: topCompleted.length
      ? `${topCompleted.length} notable task${topCompleted.length === 1 ? '' : 's'} completed`
      : 'Steady progress maintained',
    bullets: topCompleted.map((task) => `• ${task.title}`),
  };

  const streakSection: ProgressReportSection = {
    heading: 'Streaks & momentum',
    highlight: `${completed.length} total tasks cleared`,
    bullets: [
      `${completed.filter((task) => task.priorityLevel === 'urgent').length} urgent handled`,
      `${completed.filter((task) => task.priorityLevel === 'high').length} high-priority closed`,
    ],
  };

  return [completedSection, streakSection];
}

export async function buildProgressReport(
  userId: string,
  input: ProgressReportInput,
): Promise<ProgressReport> {
  const timeframe = input.timeframe ?? 'week';
  const reference = input.referenceDate ? parseISO(input.referenceDate) : new Date();
  const periodStart = startOfDay(
    timeframe === 'day' ? reference : subDays(reference, timeframe === 'week' ? 7 : 30),
  );

  const completed = await fetchCompletedTasks(userId, periodStart);
  const upcoming = await fetchUpcomingTasks(userId, subDays(reference, -7));

  const metrics = computeMetrics(completed, timeframe);
  const sections = buildHighlights(completed);

  return {
    status: 'success',
    periodLabel: formatPeriodLabel(timeframe, reference),
    metrics,
    sections,
    completed,
    upcoming,
  };
}
