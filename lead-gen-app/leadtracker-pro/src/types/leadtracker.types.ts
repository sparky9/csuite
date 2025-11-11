/**
 * TypeScript types for LeadTracker Pro MCP
 */

// ============================================================================
// ENUMS
// ============================================================================

export type ProspectStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'meeting_scheduled'
  | 'proposal_sent'
  | 'negotiating'
  | 'closed_won'
  | 'closed_lost'
  | 'on_hold';

export type ActivityType = 'call' | 'email' | 'meeting' | 'note';

export type CallOutcome = 'answered' | 'voicemail' | 'no_answer' | 'wrong_number';

export type ReminderType = 'call' | 'email' | 'meeting' | 'note';

export type RetentionPeriod = 3 | 6 | 12 | 24 | 60;

// ============================================================================
// DATABASE MODELS
// ============================================================================

export interface Prospect {
  id: string;
  user_id?: string | null;
  company_name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  status: ProspectStatus;
  source: string | null;
  tags: string[];
  health_score?: number | null;
  health_level?: HealthLevel | null;
  last_interaction_date?: Date | null;
  sentiment_trend?: string | null;
  deal_value: number | null;
  probability: number | null;
  prospect_finder_company_id: string | null;
  added_at: Date;
  last_contacted_at: Date | null;
  next_follow_up: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Contact {
  id: string;
  prospect_id: string;
  full_name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  linkedin_url: string | null;
  is_primary: boolean;
  prospect_finder_decision_maker_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Activity {
  id: string;
  prospect_id: string;
  contact_id: string | null;
  activity_type: ActivityType;
  activity_date: Date;
  call_outcome: CallOutcome | null;
  call_duration_seconds: number | null;
  subject: string | null;
  notes: string;
  requires_follow_up: boolean;
  follow_up_date: Date | null;
  retention_months: number;
  delete_after: Date | null;
  created_at: Date;
}

export interface FollowUp {
  id: string;
  prospect_id: string;
  contact_id: string | null;
  due_date: Date;
  reminder_type: ReminderType | null;
  reminder_note: string | null;
  completed: boolean;
  completed_at: Date | null;
  activity_id: string | null;
  created_at: Date;
}

export interface LeadTrackerConfig {
  key: string;
  value: string;
  description: string | null;
  updated_at: Date;
}

// ============================================================================
// TOOL INPUT SCHEMAS
// ============================================================================

export interface AddProspectInput {
  company_name: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  source?: string;
  tags?: string[];
  deal_value?: number;
  notes?: string;
  prospect_finder_company_id?: string;
}

export interface AddContactInput {
  prospect_id: string;
  full_name: string;
  title?: string;
  phone?: string;
  email?: string;
  linkedin_url?: string;
  is_primary?: boolean;
  prospect_finder_decision_maker_id?: string;
}

export interface UpdateProspectStatusInput {
  prospect_id: string;
  new_status: ProspectStatus;
  notes?: string;
}

export interface LogActivityInput {
  prospect_id: string;
  contact_id?: string;
  activity_type: ActivityType;
  call_outcome?: CallOutcome;
  call_duration_seconds?: number;
  subject?: string;
  notes: string;
  follow_up_date?: string; // ISO 8601
  retention_months?: RetentionPeriod;
}

export interface SearchProspectsInput {
  status?: ProspectStatus;
  city?: string;
  state?: string;
  tags?: string[];
  source?: string;
  has_follow_up?: boolean;
  search_query?: string;
  limit?: number;
  offset?: number;
}

export interface GetFollowUpsInput {
  time_range?: 'today' | 'this_week' | 'next_week' | 'overdue' | 'all';
  prospect_id?: string;
  completed?: boolean;
}

export interface GetPipelineStatsInput {
  time_range?: 'this_week' | 'this_month' | 'this_quarter' | 'all_time';
  include_revenue?: boolean;
  group_by?: 'status' | 'source' | 'city' | 'tags';
}

export interface ImportProspectsInput {
  json_file_path: string;
  default_status?: ProspectStatus;
  default_tags?: string[];
  source_label?: string;
}

// ============================================================================
// VIEW MODELS
// ============================================================================

export interface PipelineSummary {
  status: ProspectStatus;
  count: number;
  potential_revenue: number | null;
  avg_deal_value: number | null;
  contacted_last_week: number;
}

export interface OverdueFollowUp {
  id: string;
  due_date: Date;
  reminder_type: ReminderType | null;
  reminder_note: string | null;
  company_name: string;
  phone: string | null;
  prospect_status: ProspectStatus;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  days_overdue: number;
}

export interface ActivitySummary {
  date: Date;
  activity_type: ActivityType;
  count: number;
  unique_prospects: number;
  calls_answered: number;
  voicemails_left: number;
  avg_call_duration: number | null;
}

export interface TopProspect {
  id: string;
  company_name: string;
  status: ProspectStatus;
  deal_value: number | null;
  probability: number | null;
  last_contacted_at: Date | null;
  next_follow_up: Date | null;
  activity_count: number;
  contact_count: number;
  last_activity: Date | null;
}

// ============================================================================
// TOOL RESPONSE TYPES
// ============================================================================

export interface ProspectWithDetails extends Prospect {
  contacts?: Contact[];
  latest_activity?: Activity;
  pending_follow_ups?: FollowUp[];
}

export interface SearchProspectsResult {
  prospects: ProspectWithDetails[];
  total_count: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface PipelineStatsResult {
  summary_by_group: Array<{
    group_name: string;
    count: number;
    potential_revenue: number;
    avg_deal_value: number;
    conversion_rate?: number;
  }>;
  total_prospects: number;
  total_revenue: number;
  avg_deal_size: number;
  time_range: string;
}

export interface ImportResult {
  imported_count: number;
  skipped_count: number;
  errors: Array<{
    company_name: string;
    error: string;
  }>;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export interface DatabaseHealth {
  connected: boolean;
  latency_ms: number;
  pool_stats: {
    total: number;
    idle: number;
    waiting: number;
  };
}

export interface RetentionStats {
  total_activities: number;
  activities_to_delete: number;
  oldest_activity: Date | null;
  retention_config: {
    default_months: number;
  };
}

// ============================================================================
// ADVANCED ANALYTICS TYPES
// ============================================================================

export interface NextActionRecommendation {
  prospectId: string;
  companyName: string;
  status: ProspectStatus;
  score: number;
  priorityLabel: 'urgent' | 'high' | 'normal';
  reasons: string[];
  suggestedAction: string;
  dealValue?: number | null;
  source?: string | null;
  nextFollowUp?: string | null;
  reminderType?: ReminderType | null;
  daysOverdue?: number | null;
  daysUntilDue?: number | null;
  daysSinceContact?: number | null;
  lastActivityAt?: string | null;
}

export interface NextActionsResult {
  generatedAt: string;
  totalCandidates: number;
  recommendations: NextActionRecommendation[];
}

export interface SourceBreakdownEntry {
  source: string;
  count: number;
  totalValue: number;
  avgValue: number;
}

export interface WinLossStageEntry {
  status: ProspectStatus | 'unknown';
  count: number;
}

export interface DealSnapshot {
  prospectId: string;
  companyName: string;
  dealValue: number | null;
  source: string | null;
  stageBeforeClose: ProspectStatus | 'unknown';
  closedAt: string;
  timeToCloseDays: number | null;
}

export interface WinLossReport {
  timeframe: string;
  rangeStart: string | null;
  generatedAt: string;
  totals: {
    wins: number;
    losses: number;
    winRate: number;
    totalValueWon: number;
    totalValueLost: number;
    avgDealValueWon: number;
    avgDealValueLost: number;
    avgTimeToCloseWon: number | null;
    avgTimeToCloseLost: number | null;
  };
  winsBySource: SourceBreakdownEntry[];
  lossesBySource: SourceBreakdownEntry[];
  stagesBeforeClosing: {
    wins: WinLossStageEntry[];
    losses: WinLossStageEntry[];
  };
  topDealsWon: DealSnapshot[];
  topDealsLost: DealSnapshot[];
  insights: string[];
}

// ============================================================================
// CLIENT HEALTH & UPSELL TYPES
// ============================================================================

export type HealthLevel = 'excellent' | 'healthy' | 'warning' | 'at-risk' | 'critical';

export interface ClientHealthSignals {
  lastInteractionDays: number | null;
  paymentStatus: 'current' | 'late' | 'unknown';
  projectCount: number;
  avgResponseTimeHours: number | null;
  sentimentTrend: 'positive' | 'neutral' | 'negative' | 'unknown';
}

export interface ClientHealthResult {
  prospectId: string;
  prospectName: string;
  generatedAt: string;
  healthScore: number;
  healthLevel: HealthLevel;
  signals: ClientHealthSignals;
  riskFactors: string[];
  recommendations: string[];
}

export interface UpsellOpportunity {
  opportunityId: string;
  prospectId: string;
  clientName: string;
  currentServices: string[];
  suggestedUpsell: string;
  confidence: number;
  reasoning: string;
  estimatedValue: number | null;
  status: 'detected' | 'pitched' | 'accepted' | 'declined';
  lastActivityAt: string | null;
  detectedAt: string;
}

export interface UpsellDetectionResult {
  generatedAt: string;
  totalAnalyzed: number;
  opportunities: UpsellOpportunity[];
}

export type PitchTone = 'casual' | 'professional' | 'executive';

export interface UpsellPitchResult {
  pitchId: string;
  prospectId: string;
  clientName: string;
  tone: PitchTone;
  subject: string;
  emailBody: string;
  talkingPoints: string[];
  suggestedNextSteps: string[];
  generatedAt: string;
}
