/**
 * TypeScript Types for Social Media Manager MCP
 */

// Platform enums and types
export type SocialPlatform = 'linkedin' | 'twitter' | 'facebook';
export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';
export type EngagementType = 'like' | 'comment' | 'share' | 'retweet' | 'reply' | 'follow';
export type HashtagStrategy = 'trending' | 'niche' | 'brand' | 'competitive';
export type PostingFrequency = 'daily' | '3x_week' | '5x_week' | 'weekly' | 'custom';
export type Sentiment = 'positive' | 'negative' | 'neutral' | 'mixed';

// Platform-specific constraints
export const PLATFORM_CONSTRAINTS: Record<SocialPlatform, {
  maxTextLength: number;
  supportsImages: boolean;
  supportsVideos: boolean;
  supportsLinks: boolean;
  hasThreads: boolean;
  optimalPostingTimes: number[]; // Hour of day (0-23)
}> = {
  linkedin: {
    maxTextLength: 3000,
    supportsImages: true,
    supportsVideos: true,
    supportsLinks: true,
    hasThreads: true,
    optimalPostingTimes: [7, 8, 12, 15, 17] // Morning, lunch, afternoon
  },
  twitter: {
    maxTextLength: 280,
    supportsImages: true,
    supportsVideos: true,
    supportsLinks: true,
    hasThreads: true,
    optimalPostingTimes: [8, 12, 18, 21] // Breakfast, lunch, dinner
  },
  facebook: {
    maxTextLength: 63206,
    supportsImages: true,
    supportsVideos: true,
    supportsLinks: true,
    hasThreads: false,
    optimalPostingTimes: [13, 15, 19, 20] // Midday, evening
  }
};

// Analytics interfaces
export interface PostAnalytics {
  postId: string;
  platform: SocialPlatform;
  impressions: number;
  reach: number;
  engagement: number; // likes + comments + shares
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  clicks: number;
  engagementRate: number; // (engagement / impressions) * 100
  sentiment: Sentiment;
  bestPerformingTime: number; // Hour when most engagement occurred
  updateTimestamp: Date;
}

export interface PlatformAnalytics {
  platform: SocialPlatform;
  totalPosts: number;
  totalImpressions: number;
  totalEngagement: number;
  averageEngagementRate: number;
  followers: number;
  followerGrowth: number; // Last 30 days
  topPerformingContent: string[];
  bestPostingTimes: number[];
  audienceDemographics: {
    ageRanges: Record<string, number>;
    locations: Record<string, number>;
    interests: string[];
  };
}

export interface ContentPerformance {
  content_id: string;
  content_type: string;
  platforms: SocialPlatform[];
  overall_score: number; // 0-100 performance score
  best_platform: SocialPlatform;
  average_impressions: number;
  average_engagement: number;
  reach_score: number;
  sentiment_score: number;
  recommendations: string[]; // AI-generated optimization suggestions
}

// Posting and content interfaces
export interface SocialPost {
  id: string;
  user_id: string;
  platforms: SocialPlatform[];
  content: string;
  media_urls?: string[]; // Images/videos
  scheduled_time: Date;
  status: PostStatus;
  hashtags: string[];
  categories: string[];
  priority: 'high' | 'medium' | 'low';
  cta_type?: 'link' | 'dm' | 'follow' | 'signup';
  cta_url?: string;
  generated_by_ai: boolean;
  ai_confidence?: number; // 0-1 confidence in AI-generated content
  thread_parent_id?: string; // For threaded posts
  thread_position?: number; // Position in thread (0, 1, 2...)
  created_at: Date;
  published_at?: Date;
  analytics?: PostAnalytics[];
}

export interface PostTemplate {
  id: string;
  name: string;
  description: string;
  platforms: SocialPlatform[];
  category: string;
  content_template: string;
  hashtag_templates: string[];
  include_media: boolean;
  cta_options: string[];
  usage_count: number;
  success_rate: number; // Based on historical performance
}

// Engagement and monitoring interfaces
export interface EngagementAction {
  id: string;
  platform: SocialPlatform;
  post_id: string;
  action_type: EngagementType;
  content: string; // The comment/reply text
  author_handle: string;
  author_id: string;
  timestamp: Date;
  sentiment: Sentiment;
  priority: 'high' | 'medium' | 'low'; // Based on content analysis
  needs_response: boolean;
  ai_response_suggestion?: string;
  responded: boolean;
  response_id?: string;
  user_initiated: boolean; // True if user told AI to respond
}

export interface EngagementRule {
  id: string;
  name: string;
  platform: SocialPlatform;
  conditions: {
    keywords?: string[];
    hashtags?: string[];
    mentions?: string[];
    sentiment?: Sentiment[];
    engagement_types?: EngagementType[];
  };
  actions: {
    auto_respond: boolean;
    response_template?: string;
    notify_user: boolean;
    priority_boost: boolean;
  };
  active: boolean;
  success_rate: number;
}

// Monitoring and listening interfaces
export interface SocialListeningConfig {
  keywords: string[];
  competitors: string[];
  brands: string[];
  industries: string[];
  platforms: SocialPlatform[];
  alert_thresholds: {
    mentions_per_hour: number;
    negative_sentiment_percentage: number;
  };
}

export interface TrendAlert {
  id: string;
  platform: SocialPlatform;
  trend: string;
  volume: number;
  growth_rate: number;
  sentiment: Sentiment;
  related_hashtags: string[];
  related_topics: string[];
  relevance_score: number; // 0-1 how relevant to brand
  detected_at: Date;
  is_active: boolean;
}

export interface CompetitorAnalysis {
  competitor_handle: string;
  platform: SocialPlatform;
  follower_count: number;
  engagement_rate: number;
  post_frequency: number;
  top_content_types: string[];
  hashed_tags: string[];
  writing_style: string;
  audience_insights: {
    demographics: Record<string, number>;
    interests: string[];
    sentiment_toward_brand: Sentiment;
  };
  recommendations: string[]; // Content strategy suggestions
}

export type PricingModel = 'fixed' | 'hourly' | 'subscription' | 'retainer';

export interface CompetitorPricingRecord {
  id: string;
  user_id: string;
  competitor_name: string;
  competitor_website?: string;
  service_name: string;
  price_low: number;
  price_high: number;
  pricing_model: PricingModel;
  currency: string;
  last_checked: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CompetitorPriceChangeRecord {
  id: string;
  pricing_id: string;
  user_id: string;
  service_name: string;
  old_price_low: number;
  old_price_high: number;
  new_price_low: number;
  new_price_high: number;
  change_percent: number;
  change_date: Date;
  created_at: Date;
}

export interface MarketPositionSummary {
  service: string;
  yourPrice: number;
  marketAverage: number;
  marketRange: {
    low: number;
    high: number;
  };
  yourPosition: 'below_average' | 'competitive' | 'above_average';
  recommendation: string;
  competitorCount: number;
}

// Scheduling and automation interfaces
export interface PostingSchedule {
  id: string;
  user_id: string;
  name: string;
  platforms: SocialPlatform[];
  frequency: PostingFrequency;
  custom_schedule?: {
    days: number[]; // 0-6, 0=Sunday
    times: number[]; // Hours 0-23
  };
  content_categories: string[];
  paused: boolean;
  last_post_at?: Date;
  next_post_at: Date;
  posts_remaining?: number; // For finite schedules
}

export interface ContentQueue {
  id: string;
  name: string;
  platform: SocialPlatform;
  posts: SocialPost[];
  auto_publish: boolean;
  publish_interval_hours: number;
  last_published_at?: Date;
  created_at: Date;
}

// Hashtag optimization interfaces
export interface HashtagSet {
  id: string;
  name: string;
  hashtags: string[];
  strategy: HashtagStrategy;
  platform: SocialPlatform;
  performance_score: number; // 0-100 based on historical usage
  categories: string[];
  created_at: Date;
  last_used: Date;
  usage_count: number;
}

export interface HashtagResearch {
  keyword: string;
  platform: SocialPlatform;
  volume: number; // Daily/weekly search volume
  difficulty: number; // 0-1 ease of ranking
  competition: number;
  related_hashtags: string[];
  trending_score: number; // 0-1 current hotness
  relevance_score: number; // 0-1 relevance to brand
  recommended_for_use: boolean;
}

// API and integration interfaces
export interface PlatformCredentials {
  platform: SocialPlatform;
  client_id?: string;
  client_secret?: string;
  access_token: string;
  refresh_token?: string;
  token_expires_at?: Date;
  scopes: string[];
  rate_limits: {
    requests_per_second: number;
    daily_limit: number;
  };
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  rate_limited: boolean;
  retry_after?: number; // seconds
  request_id: string;
}

// AI content generation interfaces
export interface ContentGenerationRequest {
  platform: SocialPlatform;
  topic: string;
  tone: 'professional' | 'casual' | 'inspirational' | 'educational' | 'humorous';
  goal: 'engagement' | 'awareness' | 'traffic' | 'conversion';
  audience: string;
  include_hashtags: boolean;
  include_cta: boolean;
  character_limit?: number;
  context?: string; // Previous posts, brand guidelines, etc.
}

export interface GeneratedContentBatch {
  posts: Array<{
    platform: SocialPlatform;
    content: string;
    hashtags: string[];
    confidence_score: number;
    reasoning: string;
  }>;
  theme: string;
  target_audience: string;
  estimated_performance: 'high' | 'medium' | 'low';
}

// Reporting and dashboard interfaces
export interface SocialReport {
  id: string;
  user_id: string;
  period_start: Date;
  period_end: Date;
  platforms: SocialPlatform[];
  metrics: {
    total_impressions: number;
    total_engagement: number;
    average_engagement_rate: number;
    follower_growth: number;
    top_performing_posts: Array<{
      post_id: string;
      impressions: number;
      engagement_rate: number;
      platform: SocialPlatform;
    }>;
    content_performance_by_category: Record<string, {
      posts_count: number;
      avg_engagement: number;
      top_hashtags: string[];
    }>;
  };
  insights: string[]; // AI-generated insights and recommendations
  generated_at: Date;
}

export interface DashboardData {
  summary: {
    total_followers: number;
    total_impressions_last_30d: number;
    avg_engagement_rate: number;
    posts_this_month: number;
  };
  platform_breakdown: PlatformAnalytics[];
  recent_posts: Array<SocialPost & { analytics: PostAnalytics }>;
  upcoming_schedule: PostingSchedule[];
  engagement_backlog: number;
  trend_alerts: TrendAlert[];
}

// Tool-specific interfaces for MCP
export interface GeneratePostParams {
  user_id?: string;
  topic: string;
  platforms: SocialPlatform[];
  tone: 'professional' | 'casual' | 'inspirational' | 'educational' | 'humorous';
  content_type: 'thread' | 'single' | 'carousel';
  include_media: boolean;
  auto_schedule: boolean;
  schedule_date?: string; // ISO date string
}

export interface SchedulePostParams {
  user_id?: string;
  content: string;
  platforms: SocialPlatform[];
  schedule_time: string; // ISO date string
  hashtags?: string[];
  media_urls?: string[];
  thread_posts?: string[]; // Additional posts for threads
}

export interface GetAnalyticsParams {
  user_id?: string;
  platform?: SocialPlatform;
  date_range: '7d' | '30d' | '90d' | 'custom';
  start_date?: string; // ISO date for custom range
  end_date?: string;   // ISO date for custom range
  metrics: ('impressions' | 'engagement' | 'followers' | 'growth' | 'reach')[];
}

export interface ManageEngagementParams {
  user_id?: string;
  action: 'respond' | 'ignore' | 'flag' | 'auto_respond';
  engagement_ids: string[];
  response_template?: string;
  custom_response?: string;
}

export interface MonitorCompetitorPricingParams {
  user_id: string;
  competitor_name: string;
  competitor_website: string;
  services_to_track?: string[];
}

export interface AnalyzeMarketPositionParams {
  user_id: string;
  service: string;
  your_price: number;
}

// Utility types
export type DateRange = {
  start: Date;
  end: Date;
};

export type PlatformStats = {
  [K in SocialPlatform]: {
    followers: number;
    engagement_rate: number;
    posts_count: number;
    growth_rate: number;
  };
};
