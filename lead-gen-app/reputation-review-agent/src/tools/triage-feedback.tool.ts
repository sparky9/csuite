import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { recordNegativeFeedback } from '../services/feedback.js';
import { ensureUserId } from './helpers.js';
import type { FeedbackSeverity, IssueCategory } from '../types/reputation.js';
import { registerTool } from './tooling.js';

const triageSchema = z.object({
  userId: z.string().trim().optional(),
  clientId: z.string().min(1, 'clientId is required'),
  feedbackText: z.string().min(5, 'feedbackText should capture the issue'),
  rating: z.number().int().min(1).max(5),
  issueCategory: z.enum(['quality', 'communication', 'timeline', 'pricing', 'other'])
});

function determineSeverity(rating: number): FeedbackSeverity {
  if (rating <= 1) {
    return 'critical';
  }
  if (rating === 2) {
    return 'high';
  }
  if (rating === 3) {
    return 'medium';
  }
  return 'low';
}

function suggestedActionForSeverity(severity: FeedbackSeverity): string {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'immediate_outreach';
    case 'medium':
      return 'schedule_follow_up';
    default:
      return 'monitor_for_response';
  }
}

export const triageNegativeFeedbackTool = registerTool({
  name: 'reputation_triage_negative_feedback',
  description: 'Capture negative feedback privately and score its severity before escalation.',
  schema: triageSchema,
  execute: async (input) => {
  const userId = ensureUserId(input.userId);
    const severity = determineSeverity(input.rating);
    const taskRequired = severity === 'critical' || severity === 'high';
    const taskId = taskRequired ? uuidv4() : null;

    const feedback = await recordNegativeFeedback({
      userId,
      clientId: input.clientId,
      feedbackText: input.feedbackText,
      rating: input.rating,
      issueCategory: input.issueCategory as IssueCategory,
      severity,
      status: 'open',
      taskId
    });

    return {
      feedbackId: feedback.id,
      severity,
      suggestedAction: suggestedActionForSeverity(severity),
      taskCreated: taskRequired,
      taskId
    };
  }
});
