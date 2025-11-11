import { query } from '../db/client.js';
import type {
  ReputationMetricsSummary,
  ReputationTimeframe,
  ReviewPlatform
} from '../types/reputation.js';

const REVIEW_PLATFORMS: ReviewPlatform[] = ['google', 'yelp', 'trustpilot', 'facebook'];

function getWindowStart(timeframe: ReputationTimeframe): Date | null {
  const now = new Date();

  switch (timeframe) {
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case '1y':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    case 'all':
    default:
      return null;
  }
}

interface MetricsParams {
  userId: string;
  timeframe: ReputationTimeframe;
}

export async function getReputationMetrics({
  userId,
  timeframe
}: MetricsParams): Promise<ReputationMetricsSummary> {
  const windowStart = getWindowStart(timeframe);
  const condition = windowStart ? 'AND created_at >= $2' : '';
  const params: Array<string | Date> = windowStart ? [userId, windowStart] : [userId];

  const [testimonialResult, reviewResult, feedbackResult] = await Promise.all([
    query<{
      total: string;
      avg_rating: string | null;
      public_use_approved: string;
    }>(
      `SELECT
         COUNT(*) AS total,
         AVG(rating) AS avg_rating,
         COUNT(*) FILTER (WHERE public_use_approved) AS public_use_approved
       FROM reputation_testimonials
       WHERE user_id = $1 ${condition}`,
      params
    ),
    query<{
      platform: string;
      completed: string;
    }>(
      `SELECT platform, COUNT(*) FILTER (WHERE status = 'completed') AS completed
       FROM reputation_review_funnels
       WHERE user_id = $1 ${condition}
       GROUP BY platform`,
      params
    ),
    query<{
      total: string;
      resolved: string;
      pending: string;
    }>(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE status = 'resolved') AS resolved,
         COUNT(*) FILTER (WHERE status IN ('open', 'in_progress')) AS pending
       FROM reputation_negative_feedback
       WHERE user_id = $1 ${condition}`,
      params
    )
  ]);

  const testimonialRow = testimonialResult.rows[0];
  const feedbackRow = feedbackResult.rows[0];

  const totalTestimonials = Number(testimonialRow?.total ?? 0);
  const completedReviews = reviewResult.rows.reduce<number>((sum, row) => {
    const count = Number(row.completed ?? 0);
    return Number.isNaN(count) ? sum : sum + count;
  }, 0);

  const publicReviews: Record<ReviewPlatform, number> = REVIEW_PLATFORMS.reduce(
    (acc, platform) => {
      acc[platform] = 0;
      return acc;
    },
    {} as Record<ReviewPlatform, number>
  );

  for (const row of reviewResult.rows) {
    const platform = row.platform as ReviewPlatform;
    if (REVIEW_PLATFORMS.includes(platform)) {
      publicReviews[platform] = Number(row.completed ?? 0) || 0;
    }
  }

  const conversionRate = totalTestimonials === 0 ? 0 : completedReviews / totalTestimonials;

  return {
    testimonials: {
      total: totalTestimonials,
      avgRating: testimonialRow?.avg_rating ? Number(testimonialRow.avg_rating) : null,
      publicUseApproved: Number(testimonialRow?.public_use_approved ?? 0)
    },
    publicReviews,
    negativeFeedback: {
      total: Number(feedbackRow?.total ?? 0),
      resolved: Number(feedbackRow?.resolved ?? 0),
      pending: Number(feedbackRow?.pending ?? 0)
    },
    conversionRate
  };
}
