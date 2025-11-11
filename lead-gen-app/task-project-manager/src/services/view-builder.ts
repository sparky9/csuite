import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import type { FocusSection, TaskListItem, TaskListResponse } from '../types/index.js';

interface Buckets {
  now: TaskListItem[];
  next: TaskListItem[];
  later: TaskListItem[];
  blocked: TaskListItem[];
}

function formatDueDate(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const date = parseISO(value);

  if (isToday(date)) {
    return 'Today';
  }

  if (isTomorrow(date)) {
    return 'Tomorrow';
  }

  return format(date, 'EEE, MMM d');
}

function buildSummaryStats(tasks: TaskListItem[]) {
  let overdue = 0;
  let dueToday = 0;
  let dueThisWeek = 0;
  let blocked = 0;
  let completedThisWeek = 0;

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  for (const task of tasks) {
    if (task.status === 'blocked' || task.blockedReason) {
      blocked += 1;
    }

    const due = task.dueDate ? parseISO(task.dueDate) : null;

    if (due) {
      if (due < now) {
        overdue += 1;
      } else if (isToday(due)) {
        dueToday += 1;
      } else if (due <= weekFromNow) {
        dueThisWeek += 1;
      }
    }
  }

  return {
    total: tasks.length,
    overdue,
    dueToday,
    dueThisWeek,
    blocked,
    completedThisWeek,
  };
}

function bucketize(tasks: TaskListItem[]): Buckets {
  const buckets: Buckets = {
    now: [],
    next: [],
    later: [],
    blocked: [],
  };

  for (const task of tasks) {
    if (task.status === 'blocked' || task.blockedReason) {
      buckets.blocked.push(task);
      continue;
    }

    switch (task.priorityLevel) {
      case 'urgent':
        buckets.now.push(task);
        break;
      case 'high':
        buckets.next.push(task);
        break;
      case 'medium':
        buckets.later.push(task);
        break;
      default:
        buckets.later.push(task);
        break;
    }
  }

  return buckets;
}

function buildSection(label: string, intent: FocusSection['intent'], tasks: TaskListItem[]): FocusSection {
  const items = tasks.slice(0, 15).map((task) => ({
    ...task,
    dueLabel: formatDueDate(task.dueDate),
  }));

  let summary: string;
  if (!items.length) {
    summary = 'No tasks here yet.';
  } else {
    summary = `${items.length} task${items.length === 1 ? '' : 's'} in this lane.`;
  }

  if (intent === 'blocked' && items.length) {
    summary = `${items.length} blocked task${items.length === 1 ? '' : 's'} need attention.`;
  }

  return {
    label,
    intent,
    items,
    summary,
  };
}

export function buildFocusView(tasks: TaskListItem[]): TaskListResponse {
  const buckets = bucketize(tasks);
  const summary = buildSummaryStats(tasks);

  const sections: FocusSection[] = [
    buildSection('Now focus', 'now', buckets.now),
    buildSection('Next up', 'next', buckets.next),
    buildSection('Later queue', 'later', buckets.later),
    buildSection('Unblock these', 'blocked', buckets.blocked),
  ];

  const stats = [
    { label: 'Tasks total', value: summary.total },
    { label: 'Overdue', value: summary.overdue },
    { label: 'Due today', value: summary.dueToday },
    { label: 'Due this week', value: summary.dueThisWeek },
    { label: 'Blocked', value: summary.blocked },
  ];

  return {
    status: 'success',
    summary,
    sections,
    stats,
  };
}
