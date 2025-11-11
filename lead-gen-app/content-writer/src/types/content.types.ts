/**
 * TypeScript Types for Content Writer MCP
 */

// Content generation options
export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  stopSequences?: string[];
  systemPrompt?: string;
}

// Enums for content parameters
export type EmailPurpose = 'newsletter' | 'announcement' | 'promotion' | 'transactional' | 'cold_outreach' | 'follow_up';
export type ContentTone = 'professional' | 'friendly' | 'casual' | 'formal' | 'persuasive' | 'conversational' | 'technical' | 'storytelling' | 'inspirational' | 'humorous' | 'educational';
export type ContentLength = 'short' | 'medium' | 'long';
export type SocialPlatform = 'linkedin' | 'twitter' | 'facebook' | 'instagram';
export type RewriteGoal = 'improve_clarity' | 'shorten' | 'lengthen' | 'simplify' | 'professionalize' | 'casualize' | 'fix_grammar';
export type ContentType = 'blog' | 'email' | 'ad' | 'social' | 'landing_page';
export type HeadlineStyle = 'clickworthy' | 'professional' | 'seo_optimized' | 'curiosity_driven';
export type SummaryLength = 'one_sentence' | 'short' | 'medium' | 'long';
export type SummaryFormat = 'paragraph' | 'bullet_points' | 'key_takeaways';
export type ExpandFormat = 'paragraph' | 'article' | 'script' | 'outline';
export type KBArticleFormat = 'faq' | 'howto' | 'troubleshooting';
export type BrandTone = 'professional' | 'casual' | 'witty' | 'authoritative' | 'friendly';
export type TemplateType = 'email' | 'blog' | 'social' | 'newsletter';

// Email generation parameters
export interface GenerateEmailParams {
  purpose: EmailPurpose;
  audience: string;
  topic: string;
  key_points: string[];
  tone: ContentTone;
  length: ContentLength;
  call_to_action?: string;
  context?: string;
  user_id?: string;
}

export interface EmailResult {
  subject_line: string;
  body_html: string;
  body_plain: string;
  preview_text: string;
}

// Blog generation parameters
export interface GenerateBlogParams {
  topic: string;
  keywords: string[];
  audience: string;
  tone: ContentTone;
  length: ContentLength;
  outline?: string[];
  include_intro?: boolean;
  include_conclusion?: boolean;
  user_id?: string;
}

export interface BlogResult {
  title: string;
  meta_description: string;
  content_html: string;
  content_markdown: string;
  word_count: number;
  reading_time_minutes: number;
}

// Social post parameters
export interface GenerateSocialParams {
  platform: SocialPlatform;
  topic: string;
  message: string;
  tone: ContentTone;
  include_hashtags?: boolean;
  include_emojis?: boolean;
  call_to_action?: string;
  max_length?: number;
  user_id?: string;
}

export interface SocialResult {
  post_text: string;
  hashtags: string[];
  character_count: number;
  suggested_image_description?: string;
}

// Rewrite content parameters
export interface RewriteContentParams {
  content: string;
  goal: RewriteGoal;
  tone?: ContentTone;
  preserve_meaning?: boolean;
  target_length?: number;
  user_id?: string;
}

export interface RewriteResult {
  rewritten_content: string;
  original_word_count: number;
  new_word_count: number;
  changes_summary: string;
}

// Headline generation parameters
export interface GenerateHeadlinesParams {
  topic: string;
  content_type: ContentType;
  count?: number;
  max_length?: number;
  include_numbers?: boolean;
  style: HeadlineStyle;
  user_id?: string;
}

export interface Headline {
  text: string;
  character_count: number;
}

export interface HeadlinesResult {
  headlines: Headline[];
  best_pick: {
    headline: string;
    reasoning: string;
  };
}

// Summarize content parameters
export interface SummarizeContentParams {
  content: string;
  length: SummaryLength;
  format: SummaryFormat;
  focus?: string;
  user_id?: string;
}

export interface SummaryResult {
  summary: string;
  key_points: string[];
  original_word_count: number;
  summary_word_count: number;
}

// Expand content parameters
export interface ExpandContentParams {
  brief_content: string;
  target_format: ExpandFormat;
  target_length: ContentLength;
  tone: ContentTone;
  add_examples?: boolean;
  user_id?: string;
}

export interface ExpandResult {
  expanded_content: string;
  word_count: number;
  structure: string;
}

// KB Article generation parameters
export interface GenerateKBArticleParams {
  user_id: string;
  question: string;
  context?: string;
  format?: KBArticleFormat;
}

export interface KBArticleResult {
  articleId: string;
  title: string;
  content: string;
  format: KBArticleFormat;
  wordCount: number;
  readingTime: number;
}

// Brand Voice parameters
export interface SaveBrandVoiceParams {
  user_id: string;
  client_id: string;
  voice_name: string;
  tone: BrandTone;
  vocabulary_preferences?: string[];
  avoid_words?: string[];
  sample_text?: string;
}

export interface BrandVoiceResult {
  voiceProfileId: string;
  clientId: string;
  voiceName: string;
  tone: BrandTone;
  created: boolean;
}

export interface BrandVoiceProfile {
  voiceProfileId: string;
  userId: string;
  clientId: string;
  voiceName: string;
  tone: BrandTone;
  vocabularyPreferences?: string[];
  avoidWords?: string[];
  sampleText?: string;
  createdAt: string;
  updatedAt: string;
}

// Content Template parameters
export interface ListContentTemplatesParams {
  user_id: string;
  template_type?: TemplateType;
}

export interface ContentTemplate {
  id: string;
  name: string;
  type: TemplateType;
  variables: string[];
  usageCount: number;
}

export interface ListTemplatesResult {
  templates: ContentTemplate[];
}

// AI Response wrapper
export interface AIGenerationResult {
  content: string;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

// Platform-specific constraints
export const PLATFORM_CONSTRAINTS: Record<SocialPlatform, { maxLength: number; supportsHashtags: boolean; supportsEmojis: boolean }> = {
  twitter: { maxLength: 280, supportsHashtags: true, supportsEmojis: true },
  linkedin: { maxLength: 3000, supportsHashtags: true, supportsEmojis: false },
  facebook: { maxLength: 63206, supportsHashtags: true, supportsEmojis: true },
  instagram: { maxLength: 2200, supportsHashtags: true, supportsEmojis: true },
};

// Word count ranges for length parameters
export const LENGTH_WORD_COUNTS = {
  email: {
    short: { min: 100, max: 200 },
    medium: { min: 200, max: 400 },
    long: { min: 400, max: 600 },
  },
  blog: {
    short: { min: 500, max: 800 },
    medium: { min: 800, max: 1500 },
    long: { min: 1500, max: 2500 },
  },
  summary: {
    one_sentence: { min: 15, max: 30 },
    short: { min: 50, max: 100 },
    medium: { min: 100, max: 200 },
    long: { min: 200, max: 300 },
  },
  expand: {
    short: { min: 200, max: 400 },
    medium: { min: 400, max: 800 },
    long: { min: 800, max: 1500 },
  },
};
