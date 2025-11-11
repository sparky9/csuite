/**
 * MCP Tool: Budget Planning
 * Create and manage budgets with AI recommendations
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { planBudget } from '../ai/generator.js';
import { logger } from '../utils/logger.js';
import { bookkeepingDb } from '../db/client.js';

export const budgetPlanningTool: Tool = {
  name: 'budget_planning',
  description: `Create and manage budgets with AI recommendations.

Helps create realistic budgets based on historical data and provides AI-powered recommendations for financial planning.

Required parameters:
- budget_period: Budget period (monthly, quarterly, yearly)
- total_budget: Total budget amount available

Optional parameters:
- categories: Specific categories to budget for (if not provided, AI will suggest)
- historical_data: Historical spending data for reference
- goals: Financial goals to consider
- user_id: User ID for multi-tenant support

Returns:
- budget_breakdown: Recommended budget allocation by category
- recommendations: AI suggestions for budget optimization
- projected_savings: Potential savings opportunities
- warnings: Areas where budget might be exceeded

Example:
{
  "budget_period": "monthly",
  "total_budget": 5000,
  "categories": ["office_supplies", "software", "marketing"],
  "goals": ["Save 20% of income", "Reduce software costs"]
}`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (optional)' },
      budget_period: {
        type: 'string',
        enum: ['monthly', 'quarterly', 'yearly'],
        description: 'Budget period',
      },
      total_budget: { type: 'number', description: 'Total budget amount' },
      categories: {
        type: 'array',
        items: { type: 'string' },
        description: 'Budget categories (optional)',
      },
      historical_data: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            category: { type: 'string' },
            amount: { type: 'number' },
            period: { type: 'string' },
          },
        },
        description: 'Historical spending data (optional)',
      },
      goals: {
        type: 'array',
        items: { type: 'string' },
        description: 'Financial goals (optional)',
      },
    },
    required: ['budget_period', 'total_budget'],
  },
};

export async function handleBudgetPlanning(args: unknown, userId?: string) {
  const startTime = Date.now();

  try {
    // Validate parameters
    const params = args as {
      budget_period: string;
      total_budget: number;
      categories?: string[];
      historical_data?: Array<{ category: string; amount: number; period: string }>;
      goals?: string[];
      user_id?: string;
    };

    logger.info('Planning budget', {
      userId: params.user_id || userId,
      period: params.budget_period,
      totalBudget: params.total_budget,
    });

    const historical = params.historical_data?.map(item => ({
      category: item.category,
      amount: item.amount,
    }));

    const result = planBudget(
      params.budget_period,
      params.total_budget,
      params.categories,
      historical,
      params.goals,
    );

    if (bookkeepingDb.connected) {
      const inserted = await bookkeepingDb.query<{ id: string }>(
        `INSERT INTO bk_budgets (user_id, period, total_budget, budget_breakdown, recommendations, projected_savings, warnings)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
         RETURNING id`,
        [
          params.user_id || userId || null,
          params.budget_period,
          params.total_budget,
          JSON.stringify(result.budget_breakdown),
          result.recommendations,
          result.projected_savings,
          result.warnings,
        ],
      );

      if (inserted.rows[0]?.id) {
        result.metadata = {
          database_id: inserted.rows[0].id,
        };
      }
    }

    const duration = Date.now() - startTime;

    logger.info('Budget planned successfully', {
      userId: params.user_id || userId,
      categories: Object.keys(result.budget_breakdown).length,
      durationMs: duration,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              budget_plan: result,
              metadata: {
                period: params.budget_period,
                total_budget: params.total_budget,
                generation_time_ms: duration,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error('budget_planning tool failed', {
      error: error.message,
      durationMs: duration,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: error.message,
              tool: 'budget_planning',
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}
