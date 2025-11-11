export type DeliveryMethod = 'email' | 'sms' | 'both';
export type RequestStatus = 'pending' | 'sent' | 'received' | 'declined';
export type ReviewPlatform = 'google' | 'yelp' | 'trustpilot' | 'facebook';
export type ReviewStatus = 'ready' | 'sent' | 'completed' | 'declined';
export type IssueCategory = 'quality' | 'communication' | 'timeline' | 'pricing' | 'other';
export type FeedbackSeverity = 'low' | 'medium' | 'high' | 'critical';
export type FeedbackStatus = 'open' | 'in_progress' | 'resolved' | 'escalated';
export type CaseStudyFormat = 'pdf' | 'html' | 'markdown';

export interface TestimonialRequest {
  id: string;
  userId: string;
  clientId: string;
  projectName: string;
  completionDate: Date | null;
  requestTemplate: string | null;
  deliveryMethod: DeliveryMethod;
  status: RequestStatus;
  followUpDays: number;
  followUpSentAt: Date | null;
  followUpScheduledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Testimonial {
  id: string;
  requestId: string | null;
  userId: string;
  clientId: string;
  clientName: string;
  clientTitle: string | null;
  clientCompany: string | null;
  testimonialText: string;
  rating: number;
  permissionGranted: boolean;
  receivedDate: Date;
  publicUseApproved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewFunnel {
  id: string;
  testimonialId: string;
  userId: string;
  platform: ReviewPlatform;
  businessProfileUrl: string;
  messageTemplate: string | null;
  status: ReviewStatus;
  reviewUrl: string | null;
  publicRating: number | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NegativeFeedback {
  id: string;
  userId: string;
  clientId: string;
  feedbackText: string;
  rating: number;
  issueCategory: IssueCategory;
  severity: FeedbackSeverity;
  status: FeedbackStatus;
  resolutionNotes: string | null;
  taskId: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CaseStudy {
  id: string;
  testimonialId: string;
  userId: string;
  format: CaseStudyFormat;
  content: string;
  metricsIncluded: boolean;
  downloadUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReputationEvent<T = Record<string, unknown>> {
  id: string;
  userId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  eventData: T | null;
  createdAt: Date;
}

export type ReputationTimeframe = '30d' | '90d' | '1y' | 'all';

export interface ReputationMetricsSummary {
  testimonials: {
    total: number;
    avgRating: number | null;
    publicUseApproved: number;
  };
  publicReviews: Record<ReviewPlatform, number>;
  negativeFeedback: {
    total: number;
    resolved: number;
    pending: number;
  };
  conversionRate: number;
}
