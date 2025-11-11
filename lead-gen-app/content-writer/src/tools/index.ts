/**
 * Content Writer MCP Tools Index
 * Exports all MCP tool definitions and handlers
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// Import all tools
import { generateEmailTool, handleGenerateEmail } from './generate-email.tool.js';
import { generateBlogTool, handleGenerateBlog } from './generate-blog.tool.js';
import { generateSocialTool, handleGenerateSocial } from './generate-social.tool.js';
import { rewriteContentTool, handleRewriteContent } from './rewrite-content.tool.js';
import { generateHeadlinesTool, handleGenerateHeadlines } from './generate-headlines.tool.js';
import { summarizeContentTool, handleSummarizeContent } from './summarize-content.tool.js';
import { expandContentTool, handleExpandContent } from './expand-content.tool.js';
import { generateKBArticleTool, handleGenerateKBArticle } from './generate-kb-article.tool.js';
import { saveBrandVoiceTool, handleSaveBrandVoice } from './save-brand-voice.tool.js';
import { listContentTemplatesTool, handleListContentTemplates } from './list-content-templates.tool.js';

// Export all tools
export {
  generateEmailTool,
  handleGenerateEmail,
  generateBlogTool,
  handleGenerateBlog,
  generateSocialTool,
  handleGenerateSocial,
  rewriteContentTool,
  handleRewriteContent,
  generateHeadlinesTool,
  handleGenerateHeadlines,
  summarizeContentTool,
  handleSummarizeContent,
  expandContentTool,
  handleExpandContent,
  generateKBArticleTool,
  handleGenerateKBArticle,
  saveBrandVoiceTool,
  handleSaveBrandVoice,
  listContentTemplatesTool,
  handleListContentTemplates,
};

// Array of all tools for MCP server registration

export const ALL_CONTENT_TOOLS: Tool[] = [
  generateEmailTool,
  generateBlogTool,
  generateSocialTool,
  rewriteContentTool,
  generateHeadlinesTool,
  summarizeContentTool,
  expandContentTool,
  generateKBArticleTool,
  saveBrandVoiceTool,
  listContentTemplatesTool,
];

// Map of tool names to handler functions
export const TOOL_HANDLERS: Record<string, (args: unknown, userId?: string) => Promise<any>> = {
  generate_email: handleGenerateEmail,
  generate_blog_post: handleGenerateBlog,
  generate_social_post: handleGenerateSocial,
  rewrite_content: handleRewriteContent,
  generate_headlines: handleGenerateHeadlines,
  summarize_content: handleSummarizeContent,
  expand_content: handleExpandContent,
  generate_kb_article: handleGenerateKBArticle,
  save_brand_voice: handleSaveBrandVoice,
  list_content_templates: handleListContentTemplates,
};

// Tool descriptions for documentation
export const TOOL_DESCRIPTIONS = {
  generate_email: 'Generate professional email copy for various purposes (newsletters, cold outreach, announcements)',
  generate_blog_post: 'Create comprehensive blog posts with SEO optimization and structured content',
  generate_social_post: 'Generate platform-optimized social media posts for LinkedIn, Twitter, Facebook, Instagram',
  rewrite_content: 'Rewrite existing content to improve clarity, adjust length, change tone, or fix grammar',
  generate_headlines: 'Generate multiple compelling headline variations for A/B testing and optimization',
  summarize_content: 'Create concise summaries of long content in various formats and lengths',
  expand_content: 'Transform brief notes into comprehensive, detailed content pieces',
  generate_kb_article: 'Generate FAQ, how-to, or troubleshooting articles for knowledge base',
  save_brand_voice: 'Store brand voice preferences and guidelines for consistent content generation',
  list_content_templates: 'List available reusable content templates with customizable variables',
};

// Categories for UI organization
export const TOOL_CATEGORIES = {
  content_generation: [
    'generate_email',
    'generate_blog_post',
    'generate_social_post',
    'generate_headlines',
    'generate_kb_article',
  ],
  content_optimization: [
    'rewrite_content',
    'summarize_content',
  ],
  content_expansion: [
    'expand_content',
  ],
  content_management: [
    'save_brand_voice',
    'list_content_templates',
  ],
};
