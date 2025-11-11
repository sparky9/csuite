import { z } from 'zod';
import { ModuleCapability } from '../index';

export const GrowthPulseInputSchema = z.object({
  tenantId: z.string(),
  dateRange: z.object({
    start: z.string(),
    end: z.string(),
  }).optional(),
  includeForecasts: z.boolean().default(false),
});

export const GrowthPulseOutputSchema = z.object({
  severity: z.enum(['info', 'warning', 'critical']),
  score: z.number().min(0).max(100),
  summary: z.string(),
  highlights: z.array(z.string()),
  actionItems: z.array(z.object({
    title: z.string(),
    description: z.string(),
    priority: z.enum(['low', 'medium', 'high']),
    estimatedImpact: z.string(),
  })),
  metrics: z.object({
    totalRevenue: z.number(),
    growthRate: z.number(),
    conversionRate: z.number(),
    avgRevenuePerUser: z.number(),
  }),
});

export const GrowthPulseCapability: ModuleCapability = {
  name: 'growth-pulse',
  version: '1.0.0',
  description: 'Analyzes revenue trends and provides growth insights',
  inputsSchema: {
    type: 'object',
    properties: {
      tenantId: {
        type: 'string',
        description: 'Tenant identifier',
      },
      dateRange: {
        type: 'object',
        properties: {
          start: { type: 'string' },
          end: { type: 'string' },
        },
        description: 'Optional date range for analysis',
      },
      includeForecasts: {
        type: 'boolean',
        description: 'Whether to include revenue forecasts',
      },
    },
    required: ['tenantId'],
  },
  outputsSchema: {
    type: 'object',
    properties: {
      severity: {
        type: 'string',
        enum: ['info', 'warning', 'critical'],
      },
      score: {
        type: 'number',
        description: 'Health score from 0-100',
      },
      summary: {
        type: 'string',
        description: 'Brief summary of growth insights',
      },
      highlights: {
        type: 'array',
        items: { type: 'string' },
      },
      actionItems: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high'],
            },
            estimatedImpact: { type: 'string' },
          },
          required: ['title', 'description', 'priority', 'estimatedImpact'],
        },
      },
      metrics: {
        type: 'object',
        properties: {
          totalRevenue: { type: 'number' },
          growthRate: { type: 'number' },
          conversionRate: { type: 'number' },
          avgRevenuePerUser: { type: 'number' },
        },
        required: ['totalRevenue', 'growthRate', 'conversionRate', 'avgRevenuePerUser'],
      },
    },
    required: ['severity', 'score', 'summary', 'highlights', 'actionItems', 'metrics'],
  },
  metadata: {
    category: 'analytics',
    tags: ['revenue', 'growth', 'conversion'],
    author: 'Online C-Suite',
    changeLog: [
      {
        version: '1.0.0',
        date: '2024-10-31',
        changes: ['Initial release with revenue analysis and growth insights'],
      },
    ],
  },
};

export type GrowthPulseInput = z.infer<typeof GrowthPulseInputSchema>;
export type GrowthPulseOutput = z.infer<typeof GrowthPulseOutputSchema>;
