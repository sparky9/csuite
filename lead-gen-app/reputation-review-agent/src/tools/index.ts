import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { requestTestimonialTool } from './request-testimonial.tool.js';
import { recordTestimonialTool } from './record-testimonial.tool.js';
import { funnelToReviewSiteTool } from './funnel-review.tool.js';
import { trackReviewStatusTool } from './track-review.tool.js';
import { triageNegativeFeedbackTool } from './triage-feedback.tool.js';
import { generateCaseStudyTool } from './generate-case-study.tool.js';
import { getStatsTool } from './get-stats.tool.js';
import { listTestimonialsTool } from './list-testimonials.tool.js';
import type { RegisteredTool, ToolResponse } from './tooling.js';

const REGISTERED: RegisteredTool[] = [
  requestTestimonialTool,
  recordTestimonialTool,
  funnelToReviewSiteTool,
  trackReviewStatusTool,
  triageNegativeFeedbackTool,
  generateCaseStudyTool,
  getStatsTool,
  listTestimonialsTool
];

export const REPUTATION_TOOLS: Tool[] = REGISTERED.map((entry) => entry.tool);

export const REPUTATION_HANDLERS: Record<string, (input: unknown) => Promise<ToolResponse>> = REGISTERED.reduce(
  (acc, entry) => {
    acc[entry.tool.name] = entry.handler;
    return acc;
  },
  {} as Record<string, (input: unknown) => Promise<ToolResponse>>
);
