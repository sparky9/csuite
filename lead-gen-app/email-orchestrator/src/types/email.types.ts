/**
 * TypeScript type definitions for EmailOrchestrator MCP
 */

// ============================================================================
// CAMPAIGN TYPES
// ============================================================================

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: CampaignStatus;

  // Target audience
  target_prospect_ids?: string[];
  target_tags?: string[];
  target_status?: string;
  target_search_query?: string;

  // Sending configuration
  from_email: string;
  from_name?: string;
  send_days_of_week: number[];
  send_hours_start: number;
  send_hours_end: number;
  send_timezone: string;

  // Tracking
  tracking_enabled: boolean;

  // Cached statistics
  total_prospects: number;
  emails_sent: number;
  emails_delivered: number;
  emails_bounced: number;
  emails_opened: number;
  emails_clicked: number;
  emails_replied: number;

  // Timestamps
  created_at: Date;
  updated_at: Date;
  started_at?: Date;
  completed_at?: Date;
}

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';

export interface CreateCampaignParams {
  name: string;
  description?: string;
  from_email: string;
  from_name?: string;
  target_prospect_ids?: string[];
  target_tags?: string[];
  target_status?: string;
  send_days_of_week?: number[];
  send_hours_start?: number;
  send_hours_end?: number;
  send_timezone?: string;
  tracking_enabled?: boolean;
}

// ============================================================================
// EMAIL TEMPLATE TYPES
// ============================================================================

export interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  description?: string;

  subject_line: string;
  body_template: string;

  personalization_instructions?: string;
  use_ai_enhancement: boolean;

  // Performance metrics
  times_used: number;
  avg_open_rate?: number;
  avg_reply_rate?: number;

  created_at: Date;
  updated_at: Date;
}

export interface CreateTemplateParams {
  name: string;
  category: string;
  description?: string;
  subject_line: string;
  body_template: string;
  personalization_instructions?: string;
  use_ai_enhancement?: boolean;
}

// ============================================================================
// EMAIL SEQUENCE TYPES
// ============================================================================

export interface EmailSequence {
  id: string;
  campaign_id: string;

  sequence_order: number;
  day_offset: number;

  template_id?: string;
  subject_line: string;
  subject_variants?: string[];
  body_template: string;

  personalization_instructions?: string;
  use_ai_enhancement: boolean;

  created_at: Date;
}

export interface CreateSequenceParams {
  campaign_id: string;
  sequence_order: number;
  day_offset: number;
  template_id?: string;
  subject_line: string;
  subject_variants?: string[];
  body_template: string;
  personalization_instructions?: string;
  use_ai_enhancement?: boolean;
}

// ============================================================================
// SENT EMAIL TYPES
// ============================================================================

export type EmailProvider = 'gmail' | 'smtp';

export interface SentEmail {
  id: string;

  campaign_id?: string;
  sequence_id?: string;
  prospect_id?: string;
  contact_id?: string;

  from_email: string;
  from_name?: string;
  to_email: string;
  to_name?: string;

  subject_line: string;
  body_html: string;
  body_plain?: string;

  status: EmailStatus;
  sent_at?: Date;
  delivered_at?: Date;

  provider: EmailProvider;
  provider_message_id?: string;

  error_message?: string;
  bounce_reason?: string;

  tracking_pixel_id?: string;
  tracking_enabled: boolean;

  created_at: Date;
}

export type EmailStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'failed'
  | 'spam';

export interface SendEmailParams {
  to_email: string;
  to_name?: string;
  from_email: string;
  from_name?: string;
  subject_line: string;
  body_html: string;
  body_plain?: string;
  campaign_id?: string;
  sequence_id?: string;
  prospect_id?: string;
  tracking_enabled?: boolean;
  provider?: EmailProvider;
}

// ============================================================================
// EMAIL TRACKING TYPES
// ============================================================================

export interface EmailTracking {
  id: string;
  sent_email_id: string;

  event_type: EmailTrackingEvent;
  event_data?: Record<string, any>;

  ip_address?: string;
  user_agent?: string;
  clicked_url?: string;

  occurred_at: Date;
}

export type EmailTrackingEvent = 'open' | 'click' | 'bounce' | 'spam' | 'unsubscribe';

// ============================================================================
// CAMPAIGN PROSPECT TYPES
// ============================================================================

export interface CampaignProspect {
  id: string;
  campaign_id: string;
  prospect_id: string;

  current_sequence_order: number;
  next_send_at?: Date;

  status: CampaignProspectStatus;
  paused_reason?: string;

  emails_sent: number;
  emails_opened: number;
  emails_clicked: number;
  replied: boolean;
  replied_at?: Date;

  enrolled_at: Date;
  completed_at?: Date;
}

export type CampaignProspectStatus =
  | 'active'
  | 'paused'
  | 'completed'
  | 'unsubscribed'
  | 'bounced';

// ============================================================================
// UNSUBSCRIBE TYPES
// ============================================================================

export interface Unsubscribe {
  id: string;
  email: string;

  unsubscribed_at: Date;
  unsubscribe_reason?: string;

  campaign_id?: string;
  sent_email_id?: string;
}

// ============================================================================
// PERSONALIZATION TYPES
// ============================================================================

export interface PersonalizationContext {
  prospect?: ProspectData;
  company?: CompanyData;
  template: string;
  instructions?: string;
  subject_line: string;
}

export interface ProspectData {
  id: string;
  name?: string;
  email: string;
  job_title?: string;
  company_name?: string;
  phone?: string;
  linkedin_url?: string;
  industry?: string;
  company_size?: string;
  location?: string;
  tags?: string[];
  notes?: string;
  metadata?: Record<string, any>;
}

export interface CompanyData {
  name: string;
  website?: string;
  industry?: string;
  size?: string;
  location?: string;
  description?: string;
}

export interface PersonalizedEmail {
  subject: string;
  body_html: string;
  body_plain: string;
}

// ============================================================================
// GMAIL TYPES
// ============================================================================

export interface GmailTokens {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

export interface GmailSendParams {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
}

export interface EmailQuotaStatus {
  daily_sent: number;
  daily_limit: number;
  hourly_sent: number;
  hourly_limit: number;
  can_send: boolean;
  wait_until?: Date;
}

export interface GmailQuotaStatus extends EmailQuotaStatus {}

// ============================================================================
// SCHEDULING TYPES
// ============================================================================

export interface ScheduleParams {
  campaign_id: string;
  prospect_id: string;
  sequence_order: number;
  day_offset: number;
  timezone: string;
  send_days: number[];
  send_hours_start: number;
  send_hours_end: number;
  enrolled_at: Date;
}

export interface SendWindow {
  is_within_window: boolean;
  next_available?: Date;
  reason?: string;
}

// ============================================================================
// VIEW TYPES
// ============================================================================

export interface CampaignPerformance {
  id: string;
  name: string;
  status: CampaignStatus;
  total_prospects: number;
  emails_sent: number;
  emails_delivered: number;
  emails_bounced: number;
  emails_opened: number;
  emails_clicked: number;
  emails_replied: number;
  open_rate: number;
  click_rate: number;
  reply_rate: number;
  bounce_rate: number;
  created_at: Date;
  started_at?: Date;
  completed_at?: Date;
}

export interface PendingSend {
  campaign_prospect_id: string;
  campaign_id: string;
  prospect_id: string;
  current_sequence_order: number;
  next_send_at: Date;
  campaign_name: string;
  from_email: string;
  from_name?: string;
  tracking_enabled: boolean;
  sequence_id: string;
  subject_line: string;
  subject_variants?: string[];
  body_template: string;
  personalization_instructions?: string;
  use_ai_enhancement: boolean;
}

export interface EmailActivityTimeline {
  sent_email_id: string;
  campaign_id?: string;
  prospect_id?: string;
  to_email: string;
  subject_line: string;
  sent_at?: Date;
  status: EmailStatus;
  event_type?: EmailTrackingEvent;
  event_occurred_at?: Date;
  clicked_url?: string;
  current_sequence_order?: number;
}

export interface TemplatePerformance {
  id: string;
  name: string;
  category: string;
  times_used: number;
  actual_sends: number;
  opens: number;
  clicks: number;
  replies: number;
  calculated_open_rate: number;
  calculated_reply_rate: number;
}

// ============================================================================
// COMPLIANCE TYPES
// ============================================================================

export interface CompanyInfo {
  name: string;
  address: string;
  phone?: string;
}

export interface UnsubscribeLink {
  url: string;
  text: string;
}

// ============================================================================
// INBOX MANAGEMENT TYPES
// ============================================================================

export interface EmailMessage {
  id: string;
  message_id: string;
  thread_id: string;
  from_email: string;
  from_name?: string;
  to_emails: string[];
  cc_emails?: string[];
  bcc_emails?: string[];
  subject: string;
  snippet: string;
  body_plain?: string;
  body_html?: string;
  date: Date;
  is_unread: boolean;
  labels: string[];
  has_attachments: boolean;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  provider: 'gmail' | 'outlook';
}

export interface EmailAttachment {
  filename: string;
  mime_type: string;
  size: number;
  attachment_id: string;
  data?: string; // Base64 encoded data
}

export interface EmailThread {
  thread_id: string;
  subject: string;
  participants: string[];
  message_count: number;
  unread_count: number;
  labels: string[];
  last_message_date: Date;
  messages: EmailMessage[];
}

export interface InboxFetchOptions {
  max_results?: number;
  query?: string;
  unread_only?: boolean;
  label_ids?: string[];
  after?: Date;
  before?: Date;
}

export interface ComposeEmailParams {
  to: string | string[];
  subject: string;
  body_html: string;
  body_plain?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: EmailAttachment[];
  from?: string;
  headers?: Record<string, string>;
}

export interface ReplyEmailParams {
  thread_id?: string;
  message_id?: string;
  body_html: string;
  body_plain?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: EmailAttachment[];
}

export interface ForwardEmailParams {
  message_id: string;
  to: string | string[];
  body_html?: string; // Optional prepended message
  body_plain?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

export interface EmailSearchParams {
  query: string;
  max_results?: number;
  from?: string;
  to?: string;
  subject?: string;
  has_attachment?: boolean;
  after?: Date;
  before?: Date;
  label_ids?: string[];
}

export interface OrganizeEmailParams {
  message_ids: string[];
  action: 'label' | 'archive' | 'mark_read' | 'mark_unread' | 'delete' | 'trash' | 'star' | 'unstar';
  labels?: string[];
}

export interface EmailSummary {
  thread_id: string;
  summary: string;
  key_points: string[];
  action_items: string[];
  sentiment?: 'positive' | 'neutral' | 'negative';
  participants: string[];
  message_count: number;
}

export interface SuggestedReply {
  text: string;
  tone: 'professional' | 'friendly' | 'brief';
  length: 'short' | 'medium' | 'detailed';
}

// ============================================================================
// OAUTH TOKEN TYPES
// ============================================================================

export interface OAuthTokens {
  id: string;
  user_id?: string;
  provider: 'gmail' | 'outlook';
  access_token: string;
  refresh_token?: string;
  token_expiry?: Date;
  scope: string;
  email_address?: string;
  created_at: Date;
  updated_at: Date;
}

export interface GmailAuthParams {
  user_id?: string;
  email_address?: string;
}

// ============================================================================
// EMAIL CACHE TYPES
// ============================================================================

export interface EmailCache {
  id: string;
  user_id?: string;
  message_id: string;
  thread_id: string;
  from_email: string;
  from_name?: string;
  to_emails: string[];
  cc_emails?: string[];
  subject: string;
  snippet: string;
  body_plain?: string;
  body_html?: string;
  date: Date;
  is_unread: boolean;
  labels: string[];
  has_attachments: boolean;
  provider: 'gmail' | 'outlook';
  raw_data?: Record<string, any>;
  cached_at: Date;
}

// ============================================================================
// MCP TOOL RESPONSE TYPES
// ============================================================================

export interface ToolResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface CampaignStatsResponse {
  campaign: Campaign;
  performance: CampaignPerformance;
  recent_activity: EmailActivityTimeline[];
  top_prospects: Array<{
    prospect_id: string;
    emails_sent: number;
    emails_opened: number;
    replied: boolean;
  }>;
}
