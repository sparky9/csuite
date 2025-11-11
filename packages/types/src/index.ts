// Core Entity Types
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  clerkId: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantMember {
  id: string;
  tenantId: string;
  userId: string;
  role: TenantMemberRole;
  createdAt: Date;
  updatedAt: Date;
}

export type TenantMemberRole = 'owner' | 'admin' | 'member';

// Chat & Conversation Types
export interface Conversation {
  id: string;
  tenantId: string;
  userId: string;
  personaType: PersonaType;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  tenantId: string;
  role: MessageRole;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export type MessageRole = 'user' | 'assistant' | 'system';
export type PersonaType = 'ceo' | 'cfo' | 'cmo' | 'cto';

// Connector Types
export interface Connector {
  id: string;
  tenantId: string;
  provider: ConnectorProvider;
  status: ConnectorStatus;
  encryptedAccessToken: string;
  encryptedRefreshToken: string | null;
  encryptionKeyVersion: number;
  tokenExpiresAt: Date | null;
  scopes: string[];
  metadata: Record<string, unknown> | null;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ConnectorProvider = 'google' | 'gmail' | 'slack' | 'notion' | 'stripe';
export type ConnectorStatus = 'active' | 'error' | 'disconnected' | 'pending';

// Task & Execution Types
export interface Task {
  id: string;
  tenantId: string;
  userId: string;
  type: string;
  status: TaskStatus;
  priority: TaskPriority;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  jobId?: string | null;
  queueName?: string | null;
  boardActionItemId?: string | null;
  actionApprovalId?: string | null;
  executedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

// Usage & Metrics Types
export interface UsageSnapshot {
  id: string;
  tenantId: string;
  date: Date;
  apiCalls: number;
  tokensUsed: number;
  tasksExecuted: number;
  storageBytes: bigint;
  alertsTriggered?: number;
  activeWidgets?: number;
  summary?: Record<string, unknown> | null;
  createdAt: Date;
}

// Knowledge Base Types
export type KnowledgeSourceType = 'file_upload' | 'cloud_sync' | 'manual_note' | 'hq_share';
export type KnowledgeSourceProvider = 'upload' | 'google_drive' | 'notion' | 'manual' | 'hq' | 'other';
export type KnowledgeSourceStatus = 'pending' | 'syncing' | 'ready' | 'error' | 'disabled';
export type KnowledgeStorageStrategy = 'managed_postgres' | 'external_s3';
export type KnowledgeRetentionPolicy = 'retain_indefinitely' | 'rolling_90_days' | 'manual_purge';

export interface KnowledgeSource {
  id: string;
  tenantId: string | null; // null = company HQ scope
  name: string;
  type: KnowledgeSourceType;
  provider: KnowledgeSourceProvider;
  status: KnowledgeSourceStatus;
  storageStrategy: KnowledgeStorageStrategy;
  retentionPolicy: KnowledgeRetentionPolicy;
  configuration: Record<string, unknown> | null;
  lastSyncedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeEntry {
  id: string;
  tenantId: string | null; // null = company-wide knowledge
  source: string;
  sourceId: string | null;
  content: string;
  encryptionKeyVersion: number;
  embedding: number[];
  metadata: Record<string, unknown> | null;
  checksum: string | null;
  chunkSize: number | null;
  tokenCount: number | null;
  embeddingMetadata: Record<string, unknown> | null;
  storageKey: string | null;
  retentionExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type KnowledgeAuditEventType = 'upload' | 'delete' | 'export';

export interface KnowledgeAuditEvent {
  id: string;
  tenantId: string | null;
  sourceId: string | null;
  sourceName: string;
  event: KnowledgeAuditEventType;
  actorId: string | null;
  summary: string;
  entryCount: number;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// Action Approval Types
export type ActionApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'executed'
  | 'failed';

export interface ActionApprovalAuditEvent {
  event: 'submitted' | 'approved' | 'rejected' | 'enqueued' | 'executing' | 'completed' | 'failed';
  at: string;
  by: string;
  note?: string;
  metadata?: Record<string, unknown> | null;
}

export interface ActionApproval {
  id: string;
  tenantId: string;
  actionItemId?: string | null;
  source: string;
  payload: Record<string, unknown>;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  status: ActionApprovalStatus;
  createdBy: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  executedAt?: string | null;
  auditLog: ActionApprovalAuditEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface ActionApprovalRisk {
  score: number;
  level: 'low' | 'medium' | 'high';
  reasons: string[];
}

// Notification Types
export type NotificationChannel = 'in_app' | 'email' | 'slack_stub';

export interface Notification {
  id: string;
  tenantId: string;
  userId: string;
  type: string;
  payload: Record<string, unknown>;
  channel: NotificationChannel;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPreference {
  channel: NotificationChannel;
  enabled: boolean;
}

export interface NotificationStatsSummary {
  total: number;
  unread: number;
  latest: {
    id: string;
    createdAt: string;
    readAt: string | null;
  } | null;
}

// Security & Compliance
export interface AccessLog {
  id: string;
  tenantId: string | null;
  userId: string | null;
  method: string;
  route: string;
  statusCode: number;
  ip: string | null;
  userAgent: string | null;
  durationMs: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// Trigger & Alert Types
export type TriggerRuleType = 'schedule' | 'metric_threshold' | 'anomaly';
export type TriggerSeverity = 'info' | 'warning' | 'critical';
export type AlertStatus = 'pending' | 'acknowledged' | 'resolved' | 'snoozed';

export interface AlertRecordPayload {
  lastAlert?: {
    id: string;
    severity: TriggerSeverity;
    type: TriggerRuleType | null;
    title?: string | null;
    summary?: string | null;
    createdAt?: string | Date | null;
  };
  [key: string]: unknown;
}

export interface Alert {
  id: string;
  tenantId: string;
  ruleId?: string | null;
  type?: TriggerRuleType | null;
  severity: TriggerSeverity;
  title?: string | null;
  summary?: string | null;
  payload?: Record<string, unknown> | null;
  status: AlertStatus;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AlertListMeta {
  pending: number;
  criticalPending: number;
}

export interface AlertListResponse {
  alerts: Alert[];
  nextCursor?: string;
  stats: AlertListMeta;
}

// Marketplace Types
export interface WidgetDashboardTile {
  title: string;
  description?: string;
  href?: string;
  variant?: string;
  icon?: string;
}

export interface MarketplaceWidget {
  slug: string;
  name: string;
  description: string;
  category: string;
  requiredCapabilities: string[];
  dashboard?: {
    tile: WidgetDashboardTile;
    tags?: string[];
  };
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceWidgetWithInstall extends MarketplaceWidget {
  installed: boolean;
  enabledAt?: string;
  settings?: Record<string, unknown> | null;
}

// Billing Types
export interface BillingUsagePoint {
  date: string;
  tokensUsed: number;
  tasksExecuted: number;
  alertsTriggered: number;
  activeWidgets: number;
  metadata?: Record<string, unknown>;
}

export interface BillingUsageTotals {
  tokensUsed: number;
  tasksExecuted: number;
  alertsTriggered: number;
  activeWidgets: number;
}

export interface BillingUsageRange {
  start: string;
  end: string;
  days: number;
}

export interface BillingUsageSummary {
  usage: BillingUsagePoint[];
  totals: BillingUsageTotals;
  range: BillingUsageRange;
}

// Video Production Types
export interface VideoJob {
  id: string;
  type: string;
  status: string;
  progress: number;
  outputUrls?: string[];
  transcriptId?: string;
  error?: string;
}

export interface VideoJobListResponse {
  jobs: VideoJob[];
  total: number;
}

// API Request/Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  timestamp: string;
}

// Streaming Types
export interface StreamEvent<T = unknown> {
  type: StreamEventType;
  data: T;
  timestamp: string;
}

export type StreamEventType = 'start' | 'chunk' | 'end' | 'error';

export interface ChatStreamChunk {
  content: string;
  conversationId?: string;
  messageId?: string;
}

export interface TaskProgressEvent {
  taskId: string;
  status: TaskStatus;
  progress?: number;
  message?: string;
}

// Auth Context Types
export interface AuthContext {
  userId: string;
  clerkId: string;
  tenantId: string;
  role: TenantMemberRole;
}

// Business Profile Types
export interface BusinessProfile {
  id: string;
  tenantId: string;
  industry: string | null;
  size: BusinessSize | null;
  revenue: string | null;
  stage: BusinessStage | null;
  goals: string[] | null;
  createdAt: Date;
  updatedAt: Date;
}

export type BusinessSize = 'solo' | 'small' | 'medium' | 'large';
export type BusinessStage = 'idea' | 'startup' | 'growth' | 'mature';

// Onboarding Types
export interface OnboardingProgress {
  tenantId: string;
  step: OnboardingStep;
  completed: boolean;
  data: Record<string, unknown>;
}

export type OnboardingStep =
  | 'profile'
  | 'business_info'
  | 'connect_integrations'
  | 'first_chat';

// Module Insight Types
export interface ModuleInsight {
  id: string;
  tenantId: string;
  moduleSlug: string;
  severity: InsightSeverity;
  summary: string;
  highlights: string[];
  actionItems: ActionItem[];
  score: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export type InsightSeverity = 'info' | 'warning' | 'critical';

export interface ActionItem {
  title: string;
  priority: 'low' | 'medium' | 'high';
  description?: string;
}

// Analytics Types
export interface AnalyticsSnapshot {
  id: string;
  tenantId: string;
  date: Date;
  sessions: number;
  users: number;
  conversions: number;
  revenue: number;
  createdAt: Date;
}

// Board Meeting Types
export type BoardMeetingAgendaStatus = 'pending' | 'in_progress' | 'completed';

export interface BoardMeetingAgendaItem {
  id: string;
  title: string;
  personaId: string;
  dependsOn?: string | null;
  status?: BoardMeetingAgendaStatus;
}

export interface BoardPersonaRecommendation {
  title: string;
  ownerHint?: string | null;
  dueDateHint?: string | null;
  priority?: TaskPriority | string;
  rationale?: string | null;
}

export interface BoardPersonaAnalysis {
  personaId: string;
  personaName: string;
  summary: string;
  risks: string[];
  opportunities: string[];
  recommendations: BoardPersonaRecommendation[];
  metrics?: Record<string, unknown> | null;
  rawContent: string;
  sequence: number;
  createdAt: string;
}

export interface BoardMeetingSummary {
  narrative: string;
  highlights: string[];
  risks: string[];
  blockers: string[];
  nextSteps: string[];
}

export interface BoardMeetingMetrics {
  durationMs: number;
  personaTokens: Record<string, { input: number; output: number; total: number }>;
  actionItems: Record<BoardActionStatus, number>;
  personaLatencyMs?: Record<string, number>;
  tokenCostUsd?: number | null;
  userFeedback?: { rating: number | null; comment?: string | null } | null;
}

export interface BoardMeeting {
  id: string;
  tenantId: string;
  startedAt: string;
  endedAt: string | null;
  agendaVersion: number;
  agenda: BoardMeetingAgendaItem[];
  summary: BoardMeetingSummary | null;
  metrics: BoardMeetingMetrics | null;
  personaTurns: BoardPersonaAnalysis[];
  actionItems: BoardActionItemWithAssignee[];
  rating: number | null;
  createdAt: string;
  updatedAt: string;
}

// Board Meeting Records (Phase 3)
export interface BoardMeetingRecord {
  id: string;
  tenantId: string;
  startedAt: string;
  endedAt: string | null;
  agenda: Record<string, unknown>;
  agendaVersion: number;
  outcomeSummary: string | null;
  tokenUsage: Record<string, unknown> | null;
  rating: number | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface BoardPersonaTurnRecord {
  id: string;
  meetingId: string;
  tenantId: string;
  persona: string;
  role?: PersonaType;
  content: string;
  metrics?: Record<string, unknown> | null;
  sequence: number;
  streamedAt: string;
  createdAt: string;
}

export type BoardActionStatus = 'open' | 'in_progress' | 'completed';

export interface BoardActionItemRecord {
  id: string;
  meetingId: string;
  tenantId: string;
  title: string;
  description: string | null;
  status: BoardActionStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  dueDate: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  taskId?: string | null;
}

export interface BoardActionItemWithAssignee extends BoardActionItemRecord {
  assignee?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
}

export interface BoardMeetingWithDetails extends BoardMeetingRecord {
  personaTurns: BoardPersonaTurnRecord[];
  actionItems: BoardActionItemWithAssignee[];
}

interface BoardMeetingStreamEventBase<T, Type extends string> {
  type: Type;
  data: T;
  timestamp: string;
}

export type BoardMeetingAgendaStreamEvent = BoardMeetingStreamEventBase<
  BoardMeetingAgendaStreamData,
  'agenda'
>;

export type BoardMeetingPersonaStreamEvent = BoardMeetingStreamEventBase<
  BoardPersonaStreamData,
  'persona-response'
>;

export type BoardMeetingSummaryStreamEvent = BoardMeetingStreamEventBase<
  BoardMeetingSummaryStreamData,
  'summary'
>;

export type BoardMeetingActionItemStreamEvent = BoardMeetingStreamEventBase<
  BoardActionItemStreamData,
  'action-item'
>;

export type BoardMeetingMetricsStreamEvent = BoardMeetingStreamEventBase<
  BoardMeetingMetricsStreamData,
  'metrics'
>;

export type BoardMeetingErrorStreamEvent = BoardMeetingStreamEventBase<
  BoardMeetingErrorStreamData,
  'error'
>;

export type BoardMeetingCompletionStreamEvent = BoardMeetingStreamEventBase<
  BoardMeetingCompletionStreamData,
  'completed'
>;

export type BoardMeetingStreamEvent<T = unknown> = BoardMeetingStreamEventBase<
  T,
  'agenda' | 'persona-response' | 'summary' | 'action-item' | 'metrics' | 'error' | 'completed'
>;

export interface BoardMeetingAgendaStreamData {
  meetingId: string;
  sectionId: string;
  title: string;
  personaId: string;
  status: BoardMeetingAgendaStatus;
}

export interface BoardPersonaStreamData extends BoardPersonaAnalysis {}

export interface BoardActionItemStreamData {
  meetingId: string;
  item: BoardActionItemWithAssignee;
}

export interface BoardMeetingSummaryStreamData {
  meetingId: string;
  summary: BoardMeetingSummary;
}

export interface BoardMeetingMetricsStreamData {
  meetingId: string;
  metrics: BoardMeetingMetrics;
}

export interface BoardMeetingErrorStreamData {
  meetingId: string;
  message: string;
}

export interface BoardMeetingCompletionStreamData {
  meetingId: string;
  endedAt: string;
}

export type BoardMeetingStreamEnvelope =
  | BoardMeetingAgendaStreamEvent
  | BoardMeetingPersonaStreamEvent
  | BoardMeetingSummaryStreamEvent
  | BoardMeetingActionItemStreamEvent
  | BoardMeetingMetricsStreamEvent
  | BoardMeetingErrorStreamEvent
  | BoardMeetingCompletionStreamEvent;
