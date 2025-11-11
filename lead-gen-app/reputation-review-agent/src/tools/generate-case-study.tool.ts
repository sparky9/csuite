import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getTestimonialRequestById } from '../services/testimonial-requests.js';
import { generateCaseStudy } from '../services/case-studies.js';
import { getTestimonialById } from '../services/testimonials.js';
import { ensureUserId } from './helpers.js';
import { registerTool } from './tooling.js';

const caseStudySchema = z.object({
  userId: z.string().trim().optional(),
  testimonialId: z.string().uuid('testimonialId must be a valid UUID'),
  format: z.enum(['pdf', 'html', 'markdown']).optional(),
  includeMetrics: z.boolean().optional()
});

function buildCaseStudyContent(options: {
  clientName: string;
  testimonialText: string;
  rating: number;
  projectName?: string | null;
  includeMetrics?: boolean;
}): string {
  const headline = options.projectName
    ? `# Case Study: ${options.projectName}`
    : `# Case Study: ${options.clientName}`;

  const intro = `## Client Spotlight\n${options.clientName} shared the following feedback:`;
  const quote = `> ${options.testimonialText}`;
  const ratingLine = `- Satisfaction rating: ${options.rating}/5`;

  const metricsSection = options.includeMetrics
    ? `\n## Impact Metrics\n- Project satisfaction: ${options.rating}/5\n- Referral readiness: ${options.rating >= 4 ? 'Likely' : 'Needs nurture'}\n- Follow-up scheduled: ${options.includeMetrics ? 'Yes' : 'No'}`
    : '';

  return [headline, intro, quote, '## Key Outcomes', ratingLine, metricsSection].join('\n\n');
}

export const generateCaseStudyTool = registerTool({
  name: 'reputation_generate_case_study',
  description: 'Transform a testimonial into a formatted case study artifact.',
  schema: caseStudySchema,
  execute: async (input) => {
    const testimonial = await getTestimonialById(input.testimonialId);
    if (!testimonial) {
      throw new McpError(ErrorCode.InvalidParams, 'Testimonial not found');
    }

  const userId = ensureUserId(input.userId ?? testimonial.userId);
    const request = testimonial.requestId
      ? await getTestimonialRequestById(testimonial.requestId)
      : null;

    const content = buildCaseStudyContent({
      clientName: testimonial.clientName,
      testimonialText: testimonial.testimonialText,
      rating: testimonial.rating,
      projectName: request?.projectName,
      includeMetrics: input.includeMetrics
    });

    const caseStudy = await generateCaseStudy({
      testimonialId: testimonial.id,
      userId,
      format: input.format ?? 'markdown',
      content,
      metricsIncluded: input.includeMetrics ?? false,
      downloadUrl: null
    });

    return {
      caseStudyId: caseStudy.id,
      format: caseStudy.format,
      content: caseStudy.content,
      downloadUrl: caseStudy.downloadUrl
    };
  }
});
