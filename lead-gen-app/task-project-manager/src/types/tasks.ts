export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'waiting' | 'done';

export type PriorityLevel = 'urgent' | 'high' | 'medium' | 'low';

export interface TaskCreateInput {
  title: string;
  description?: string;
  projectId?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  status?: TaskStatus;
  impacts?: number;
  impact?: number; // alias support
  effort?: number;
  confidence?: number;
  estimatedMinutes?: number;
  tags?: string[];
  blockedReason?: string | null;
  recurrencePattern?: string | null; // NEW: e.g., "daily", "weekly", "monthly"
}

export interface TaskUpdateInput {
  taskId: string;
  title?: string;
  description?: string | null;
  projectId?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  status?: TaskStatus;
  impact?: number | null;
  effort?: number | null;
  confidence?: number | null;
  estimatedMinutes?: number | null;
  actualMinutes?: number | null;
  blockedReason?: string | null;
  tags?: string[] | null;
}

export interface TaskRecord {
  id: string;
  userId: string;
  projectId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priorityLevel: PriorityLevel;
  priorityScore: number;
  impact: number | null;
  effort: number | null;
  confidence: number | null;
  dueDate: string | null;
  startDate: string | null;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  tags: string[];
  blockedReason: string | null;
  autoInsights: Record<string, unknown> | null;
  recurrence_pattern?: string | null; // NEW
  recurrence_parent_id?: string | null; // NEW
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface TaskListItem {
  taskId: string;
  title: string;
  priorityLevel: PriorityLevel;
  priorityScore: number;
  status: TaskStatus;
  dueDate?: string | null;
  startDate?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  blockedReason?: string | null;
  tags?: string[];
  insights?: string[];
  estimateMinutes?: number | null;
  agingDays: number;
  completedAt?: string | null;
}

export interface FocusSection {
  label: string;
  intent: 'now' | 'next' | 'later' | 'blocked';
  items: TaskListItem[];
  summary: string;
}

export interface TaskListSummary {
  total: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  blocked: number;
  completedThisWeek: number;
}

export interface TaskListResponse {
  status: 'success';
  summary: TaskListSummary;
  sections: FocusSection[];
  stats: Array<{ label: string; value: string | number }>;
}

export interface PriorityRecommendation {
  taskId: string;
  title: string;
  priorityLevel: PriorityLevel;
  score: number;
  reasons: string[];
  suggestedAction: string;
  dueDate?: string | null;
  projectName?: string | null;
}

export interface ProgressReportInput {
  timeframe?: 'day' | 'week' | 'month';
  referenceDate?: string;
}

export interface ProgressMetric {
  label: string;
  value: number;
  delta?: number;
}

export interface ProgressReportSection {
  heading: string;
  highlight: string;
  bullets: string[];
}

export interface ProgressReport {
  status: 'success';
  periodLabel: string;
  metrics: ProgressMetric[];
  sections: ProgressReportSection[];
  completed: TaskListItem[];
  upcoming: TaskListItem[];
}

export interface ProjectRecord {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  status: string;
  focusArea: string | null;
  cadence: string | null;
  healthScore: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectCreateInput {
  name: string;
  description?: string;
  focusArea?: string;
  cadence?: string;
}

export interface ProjectUpdateInput {
  projectId: string;
  name?: string;
  description?: string | null;
  status?: string;
  focusArea?: string | null;
  cadence?: string | null;
  healthScore?: number | null;
}
``