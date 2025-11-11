/**
 * Social Media Manager MCP Tools Index
 * Exports all MCP tool definitions and handlers
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { generatePostTool, handleGeneratePost } from './generate-post.tool.js';
import { schedulePostTool, handleSchedulePost } from './schedule-post.tool.js';
import { getAnalyticsTool, handleGetAnalytics } from './get-analytics.tool.js';
import { researchHashtagsTool, handleResearchHashtags } from './research-hashtags.tool.js';
import { analyzeCompetitorsTool, handleAnalyzeCompetitors } from './analyze-competitors.tool.js';
import { generateContentCalendarTool, handleGenerateContentCalendar } from './generate-content-calendar.tool.js';
import { optimizePostTimingTool, handleOptimizePostTiming } from './optimize-post-timing.tool.js';
import { monitorTrendsTool, handleMonitorTrends } from './monitor-trends.tool.js';
import { generateThreadTool, handleGenerateThread } from './generate-thread.tool.js';
import { monitorCompetitorPricingTool, handleMonitorCompetitorPricing } from './monitor-competitor-pricing.tool.js';
import { analyzeMarketPositionTool, handleAnalyzeMarketPosition } from './analyze-market-position.tool.js';

export {
  generatePostTool,
  handleGeneratePost,
  schedulePostTool,
  handleSchedulePost,
  getAnalyticsTool,
  handleGetAnalytics,
  researchHashtagsTool,
  handleResearchHashtags,
  analyzeCompetitorsTool,
  handleAnalyzeCompetitors,
  generateContentCalendarTool,
  handleGenerateContentCalendar,
  optimizePostTimingTool,
  handleOptimizePostTiming,
  monitorTrendsTool,
  handleMonitorTrends,
  generateThreadTool,
  handleGenerateThread,
  monitorCompetitorPricingTool,
  handleMonitorCompetitorPricing,
  analyzeMarketPositionTool,
  handleAnalyzeMarketPosition,
};

export const ALL_SOCIAL_TOOLS: Tool[] = [
  generatePostTool,
  schedulePostTool,
  getAnalyticsTool,
  researchHashtagsTool,
  analyzeCompetitorsTool,
  generateContentCalendarTool,
  optimizePostTimingTool,
  monitorTrendsTool,
  generateThreadTool,
  monitorCompetitorPricingTool,
  analyzeMarketPositionTool,
];

// Map of tool names to handler functions
export const TOOL_HANDLERS: Record<string, (args: unknown, userId?: string) => Promise<any>> = {
  generate_post: handleGeneratePost,
  schedule_post: handleSchedulePost,
  get_analytics: handleGetAnalytics,
  research_hashtags: handleResearchHashtags,
  analyze_competitors: handleAnalyzeCompetitors,
  generate_content_calendar: handleGenerateContentCalendar,
  optimize_post_timing: handleOptimizePostTiming,
  monitor_trends: handleMonitorTrends,
  generate_thread: handleGenerateThread,
  monitor_competitor_pricing: handleMonitorCompetitorPricing,
  analyze_market_position: handleAnalyzeMarketPosition,
};

// Tool descriptions for documentation
export const TOOL_DESCRIPTIONS = {
  generate_post: 'Generate engaging social media posts optimized for specific platforms',
  schedule_post: 'Schedule posts for optimal engagement times across multiple platforms',
  get_analytics: 'Retrieve performance analytics and insights for social media posts',
  research_hashtags: 'Research and suggest effective hashtags for increased reach',
  analyze_competitors: 'Analyze competitor social media strategies and performance',
  generate_content_calendar: 'Create a strategic content calendar for consistent posting',
  optimize_post_timing: 'Find the best times to post based on audience engagement data',
  monitor_trends: 'Monitor trending topics and conversations relevant to your brand',
  generate_thread: 'Generate multi-post threads for platforms like Twitter and LinkedIn',
  monitor_competitor_pricing: 'Track competitor pricing for key service offerings',
  analyze_market_position: 'Compare your rates against competitor market averages',
};

// Categories for UI organization
export const TOOL_CATEGORIES = {
  content_creation: [
    'generate_post',
    'generate_thread',
    'research_hashtags',
  ],
  scheduling: [
    'schedule_post',
    'generate_content_calendar',
    'optimize_post_timing',
  ],
  analytics: [
    'get_analytics',
    'analyze_competitors',
    'monitor_trends',
    'monitor_competitor_pricing',
    'analyze_market_position',
  ],
};
