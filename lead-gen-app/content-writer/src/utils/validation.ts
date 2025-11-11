/**
 * Input validation utilities
 * Zod schema validation and data sanitization
 */

import { z } from 'zod';

/**
 * Common validation schemas
 */

// Email purpose enum
export const emailPurposeSchema = z.enum([
  'newsletter',
  'announcement',
  'promotion',
  'transactional',
  'cold_outreach',
  'follow_up',
]);

// Content tone enum
export const contentToneSchema = z.enum([
  'professional',
  'friendly',
  'casual',
  'formal',
  'persuasive',
  'conversational',
  'technical',
  'storytelling',
  'inspirational',
  'humorous',
  'educational',
]);

// Content length enum
export const contentLengthSchema = z.enum(['short', 'medium', 'long']);

// Social platform enum
export const socialPlatformSchema = z.enum(['linkedin', 'twitter', 'facebook', 'instagram']);

// Rewrite goal enum
export const rewriteGoalSchema = z.enum([
  'improve_clarity',
  'shorten',
  'lengthen',
  'simplify',
  'professionalize',
  'casualize',
  'fix_grammar',
]);

// Content type enum
export const contentTypeSchema = z.enum(['blog', 'email', 'ad', 'social', 'landing_page']);

// Headline style enum
export const headlineStyleSchema = z.enum([
  'clickworthy',
  'professional',
  'seo_optimized',
  'curiosity_driven',
]);

// Summary length enum
export const summaryLengthSchema = z.enum(['one_sentence', 'short', 'medium', 'long']);

// Summary format enum
export const summaryFormatSchema = z.enum(['paragraph', 'bullet_points', 'key_takeaways']);

// Expand format enum
export const expandFormatSchema = z.enum(['paragraph', 'article', 'script', 'outline']);

// KB Article format enum
export const kbArticleFormatSchema = z.enum(['faq', 'howto', 'troubleshooting']);

// Brand tone enum
export const brandToneSchema = z.enum(['professional', 'casual', 'witty', 'authoritative', 'friendly']);

// Template type enum
export const templateTypeSchema = z.enum(['email', 'blog', 'social', 'newsletter']);

/**
 * Tool-specific validation schemas
 */

// Generate Email
export const generateEmailSchema = z.object({
  user_id: z.string().optional(),
  purpose: emailPurposeSchema,
  audience: z.string().min(1, 'Audience description is required'),
  topic: z.string().min(1, 'Topic is required'),
  key_points: z.array(z.string()).min(1, 'At least one key point is required'),
  tone: contentToneSchema,
  length: contentLengthSchema,
  call_to_action: z.string().optional(),
  context: z.string().optional(),
});

// Generate Blog Post
export const generateBlogSchema = z.object({
  user_id: z.string().optional(),
  topic: z.string().min(1, 'Topic is required'),
  keywords: z.array(z.string()).min(1, 'At least one keyword is required'),
  audience: z.string().min(1, 'Audience description is required'),
  tone: contentToneSchema,
  length: contentLengthSchema,
  outline: z.array(z.string()).optional(),
  include_intro: z.boolean().optional().default(true),
  include_conclusion: z.boolean().optional().default(true),
});

// Generate Social Post
export const generateSocialSchema = z.object({
  user_id: z.string().optional(),
  platform: socialPlatformSchema,
  topic: z.string().min(1, 'Topic is required'),
  message: z.string().min(1, 'Message is required'),
  tone: contentToneSchema,
  include_hashtags: z.boolean().optional().default(true),
  include_emojis: z.boolean().optional().default(false),
  call_to_action: z.string().optional(),
  max_length: z.number().positive().optional(),
});

// Rewrite Content
export const rewriteContentSchema = z.object({
  user_id: z.string().optional(),
  content: z.string().min(1, 'Content to rewrite is required'),
  goal: rewriteGoalSchema,
  tone: contentToneSchema.optional(),
  preserve_meaning: z.boolean().optional().default(true),
  target_length: z.number().positive().optional(),
});

// Generate Headlines
export const generateHeadlinesSchema = z.object({
  user_id: z.string().optional(),
  topic: z.string().min(1, 'Topic is required'),
  content_type: contentTypeSchema,
  count: z.number().int().min(1).max(20).optional().default(5),
  max_length: z.number().positive().optional(),
  include_numbers: z.boolean().optional().default(false),
  style: headlineStyleSchema,
});

// Summarize Content
export const summarizeContentSchema = z.object({
  user_id: z.string().optional(),
  content: z.string().min(1, 'Content to summarize is required'),
  length: summaryLengthSchema,
  format: summaryFormatSchema,
  focus: z.string().optional(),
});

// Expand Content
export const expandContentSchema = z.object({
  user_id: z.string().optional(),
  brief_content: z.string().min(1, 'Brief content is required'),
  target_format: expandFormatSchema,
  target_length: contentLengthSchema,
  tone: contentToneSchema,
  add_examples: z.boolean().optional().default(true),
});

// Generate KB Article
export const generateKBArticleSchema = z.object({
  user_id: z.string().min(1, 'User ID is required'),
  question: z.string().min(1, 'Question is required'),
  context: z.string().optional(),
  format: kbArticleFormatSchema.optional().default('faq'),
});

// Save Brand Voice
export const saveBrandVoiceSchema = z.object({
  user_id: z.string().min(1, 'User ID is required'),
  client_id: z.string().min(1, 'Client ID is required'),
  voice_name: z.string().min(1, 'Voice name is required'),
  tone: brandToneSchema,
  vocabulary_preferences: z.array(z.string()).optional(),
  avoid_words: z.array(z.string()).optional(),
  sample_text: z.string().optional(),
});

// List Content Templates
export const listContentTemplatesSchema = z.object({
  user_id: z.string().min(1, 'User ID is required'),
  template_type: templateTypeSchema.optional(),
});

/**
 * Sanitize string input
 * Removes potentially problematic characters
 */
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .substring(0, 10000); // Limit length
}

/**
 * Validate and sanitize array of strings
 */
export function sanitizeStringArray(input: string[]): string[] {
  return input.map(sanitizeString).filter(s => s.length > 0);
}

/**
 * Validate word count is within acceptable range
 */
export function validateWordCount(count: number, min: number = 1, max: number = 100000): boolean {
  return count >= min && count <= max;
}

/**
 * Validate character count is within acceptable range
 */
export function validateCharCount(count: number, max: number): boolean {
  return count > 0 && count <= max;
}
