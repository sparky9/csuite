/**
 * Tool registry for the calendar meeting MCP agent.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { proposeMeetingSlotsTool, handleProposeMeetingSlots } from './propose-meeting-slots.tool.js';
import { scheduleMeetingTool, handleScheduleMeeting } from './schedule-meeting.tool.js';
import { ingestAvailabilityTool, handleIngestAvailability } from './ingest-availability.tool.js';
import { generateAgendaTool, handleGenerateAgenda } from './generate-agenda.tool.js';
import { generateSummaryTool, handleGenerateSummary } from './generate-summary.tool.js';
import { generateInsightsTool, handleGenerateInsights } from './generate-insights.tool.js';

export const tools: Tool[] = [
  proposeMeetingSlotsTool,
  scheduleMeetingTool,
  ingestAvailabilityTool,
  generateAgendaTool,
  generateSummaryTool,
  generateInsightsTool,
];

export const toolHandlers: Record<string, (args: unknown) => Promise<any>> = {
  [proposeMeetingSlotsTool.name]: handleProposeMeetingSlots,
  [scheduleMeetingTool.name]: handleScheduleMeeting,
  [ingestAvailabilityTool.name]: handleIngestAvailability,
  [generateAgendaTool.name]: handleGenerateAgenda,
  [generateSummaryTool.name]: handleGenerateSummary,
  [generateInsightsTool.name]: handleGenerateInsights,
};
