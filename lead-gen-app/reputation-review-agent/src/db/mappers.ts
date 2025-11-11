import type {
  CaseStudy,
  DeliveryMethod,
  NegativeFeedback,
  ReviewFunnel,
  Testimonial,
  TestimonialRequest
} from '../types/reputation.js';

export interface TestimonialRequestRow {
  id: string;
  user_id: string;
  client_id: string;
  project_name: string;
  completion_date: Date | null;
  request_template: string | null;
  delivery_method: DeliveryMethod;
  status: string;
  follow_up_days: number;
  follow_up_sent_at: Date | null;
  follow_up_scheduled_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface TestimonialRow {
  id: string;
  request_id: string | null;
  user_id: string;
  client_id: string;
  client_name: string;
  client_title: string | null;
  client_company: string | null;
  testimonial_text: string;
  rating: number;
  permission_granted: boolean;
  received_date: Date;
  public_use_approved: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ReviewFunnelRow {
  id: string;
  testimonial_id: string;
  user_id: string;
  platform: string;
  business_profile_url: string;
  message_template: string | null;
  status: string;
  review_url: string | null;
  public_rating: number | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface NegativeFeedbackRow {
  id: string;
  user_id: string;
  client_id: string;
  feedback_text: string;
  rating: number;
  issue_category: string;
  severity: string;
  status: string;
  resolution_notes: string | null;
  task_id: string | null;
  resolved_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CaseStudyRow {
  id: string;
  testimonial_id: string;
  user_id: string;
  format: string;
  content: string;
  metrics_included: boolean;
  download_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export function mapTestimonialRequest(row: TestimonialRequestRow): TestimonialRequest {
  return {
    id: row.id,
    userId: row.user_id,
    clientId: row.client_id,
    projectName: row.project_name,
    completionDate: row.completion_date,
    requestTemplate: row.request_template,
    deliveryMethod: row.delivery_method,
    status: row.status as TestimonialRequest['status'],
    followUpDays: row.follow_up_days,
    followUpSentAt: row.follow_up_sent_at,
    followUpScheduledAt: row.follow_up_scheduled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapTestimonial(row: TestimonialRow): Testimonial {
  return {
    id: row.id,
    requestId: row.request_id,
    userId: row.user_id,
    clientId: row.client_id,
    clientName: row.client_name,
    clientTitle: row.client_title,
    clientCompany: row.client_company,
    testimonialText: row.testimonial_text,
    rating: row.rating,
    permissionGranted: row.permission_granted,
    receivedDate: row.received_date,
    publicUseApproved: row.public_use_approved,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapReviewFunnel(row: ReviewFunnelRow): ReviewFunnel {
  return {
    id: row.id,
    testimonialId: row.testimonial_id,
    userId: row.user_id,
    platform: row.platform as ReviewFunnel['platform'],
    businessProfileUrl: row.business_profile_url,
    messageTemplate: row.message_template,
    status: row.status as ReviewFunnel['status'],
    reviewUrl: row.review_url,
    publicRating: row.public_rating,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapNegativeFeedback(row: NegativeFeedbackRow): NegativeFeedback {
  return {
    id: row.id,
    userId: row.user_id,
    clientId: row.client_id,
    feedbackText: row.feedback_text,
    rating: row.rating,
    issueCategory: row.issue_category as NegativeFeedback['issueCategory'],
    severity: row.severity as NegativeFeedback['severity'],
    status: row.status as NegativeFeedback['status'],
    resolutionNotes: row.resolution_notes,
    taskId: row.task_id,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapCaseStudy(row: CaseStudyRow): CaseStudy {
  return {
    id: row.id,
    testimonialId: row.testimonial_id,
    userId: row.user_id,
    format: row.format as CaseStudy['format'],
    content: row.content,
    metricsIncluded: row.metrics_included,
    downloadUrl: row.download_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
