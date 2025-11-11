/**
 * MCP Tool: Analyze Competitors
 * Analyze competitor social media strategies and performance
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { analyzeCompetitors } from '../ai/generator.js';
import { logger, logToolExecution } from '../utils/logger.js';
import { socialDb } from '../db/client.js';

export const analyzeCompetitorsTool: Tool = {
  name: 'analyze_competitors',
  description: `Analyze competitor social media strategies and performance.

Provides comprehensive competitor analysis with actionable insights for improving your own strategy.

Required parameters:
- competitors: Array of competitor handles/names
- platform: Target platform to analyze

Optional parameters:
- analysis_depth: Analysis depth (basic, detailed, comprehensive)
- user_id: User ID for multi-tenant support

Returns:
- competitor_profiles: Detailed analysis of each competitor
- comparative_metrics: How you compare to competitors
- content_insights: What content works for them
- recommendations: Strategic recommendations based on analysis

Example:
{
  "competitors": ["competitor1", "competitor2"],
  "platform": "linkedin",
  "analysis_depth": "detailed"
}`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (optional)' },
      competitors: {
        type: 'array',
        items: { type: 'string' },
        description: 'Competitor handles/names',
      },
      platform: {
        type: 'string',
        enum: ['linkedin', 'twitter', 'facebook'],
        description: 'Target platform',
      },
      analysis_depth: {
        type: 'string',
        enum: ['basic', 'detailed', 'comprehensive'],
        description: 'Analysis depth (optional)',
      },
    },
    required: ['competitors', 'platform'],
  },
};

const AnalyzeCompetitorsSchema = z.object({
  user_id: z.string().optional(),
  competitors: z.array(z.string().min(2)).min(1, 'At least one competitor is required').max(10, 'Limit analysis to 10 competitors'),
  platform: z.enum(['linkedin', 'twitter', 'facebook']),
  analysis_depth: z.enum(['basic', 'detailed', 'comprehensive']).default('detailed'),
});

export async function handleAnalyzeCompetitors(args: unknown, userId?: string) {
  const startTime = Date.now();

  try {
    const input = AnalyzeCompetitorsSchema.parse(args);
    const effectiveUserId = input.user_id || userId;

    logger.info('Analyzing competitors with deterministic engine', {
      userId: effectiveUserId,
      competitors: input.competitors,
      platform: input.platform,
      depth: input.analysis_depth,
    });

    const analysis = analyzeCompetitors({
      competitors: input.competitors,
      platform: input.platform,
      depth: input.analysis_depth,
    });

    if (socialDb.connected) {
      for (const profile of analysis.competitorProfiles) {
        await socialDb.query(
          `INSERT INTO social_competitor_profiles (
            user_id, platform, competitor_name, followers, engagement_rate,
            post_frequency, content_themes, top_hashtags, strengths, weaknesses, recorded_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
          ON CONFLICT (user_id, platform, competitor_name)
          DO UPDATE SET followers = EXCLUDED.followers, engagement_rate = EXCLUDED.engagement_rate,
            post_frequency = EXCLUDED.post_frequency, content_themes = EXCLUDED.content_themes,
            top_hashtags = EXCLUDED.top_hashtags, strengths = EXCLUDED.strengths,
            weaknesses = EXCLUDED.weaknesses, recorded_at = NOW()`,
          [
            effectiveUserId ?? null,
            input.platform,
            profile.name,
            profile.followers,
            profile.engagementRate,
            profile.postFrequency,
            profile.contentThemes,
            profile.topHashtags,
            profile.strengths,
            profile.weaknesses,
          ],
        );
      }

      await socialDb.query(
        `INSERT INTO social_competitor_summaries (
          user_id, platform, depth, your_position, opportunities, threats, focus_areas, recommendations, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          effectiveUserId ?? null,
          input.platform,
          input.analysis_depth,
          analysis.comparativeAnalysis.yourPosition,
          analysis.comparativeAnalysis.opportunities,
          analysis.comparativeAnalysis.threats,
          analysis.focusAreas,
          analysis.recommendations,
        ],
      );
    }

    const duration = Date.now() - startTime;
    logToolExecution('analyze_competitors', effectiveUserId, input, true, duration);

    const payload = {
      competitor_profiles: analysis.competitorProfiles.map((profile) => ({
        name: profile.name,
        followers: profile.followers,
        engagement_rate: profile.engagementRate,
        post_frequency: profile.postFrequency,
        content_themes: profile.contentThemes,
        top_hashtags: profile.topHashtags,
        strengths: profile.strengths,
        weaknesses: profile.weaknesses,
      })),
      comparative_analysis: {
        your_position: analysis.comparativeAnalysis.yourPosition,
        opportunities: analysis.comparativeAnalysis.opportunities,
        threats: analysis.comparativeAnalysis.threats,
      },
      recommendations: analysis.recommendations,
      focus_areas: analysis.focusAreas,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              analysis: payload,
              metadata: {
                competitors: input.competitors,
                platform: input.platform,
                analysis_depth: input.analysis_depth,
                generation_time_ms: duration,
              },
            },
            null,
            2,
          ),
        },
      ],
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logToolExecution('analyze_competitors', userId, {}, false, duration);

    const message = error instanceof z.ZodError
      ? `Validation error: ${error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ')}`
      : error instanceof Error
        ? error.message
        : String(error);

    logger.error('analyze_competitors tool failed', { error: message, durationMs: duration });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: message,
              tool: 'analyze_competitors',
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }
}
