/**
 * MCP Tool: Create Campaign
 * Creates a new multi-touch email campaign
 */

import { z } from 'zod';
import { campaignManager } from '../campaigns/campaign-manager.js';
import { logger } from '../utils/logger.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export const createCampaignSchema = z.object({
  name: z.string().describe('Campaign name'),
  description: z.string().optional().describe('Campaign description'),
  from_email: z.string().email().describe('Sender email address'),
  from_name: z.string().optional().describe('Sender name'),
  target_prospect_ids: z.array(z.string()).optional().describe('Specific prospect IDs to target'),
  target_tags: z.array(z.string()).optional().describe('Target prospects with these tags'),
  target_status: z.string().optional().describe('Target prospects with this status'),
  send_days_of_week: z
    .array(z.number().min(1).max(7))
    .optional()
    .describe('Days to send emails (1=Mon, 7=Sun)'),
  send_hours_start: z.number().min(0).max(23).optional().describe('Start hour for sending'),
  send_hours_end: z.number().min(0).max(23).optional().describe('End hour for sending'),
  send_timezone: z.string().optional().describe('Timezone for scheduling'),
  tracking_enabled: z.boolean().optional().describe('Enable email tracking'),
});

export const createCampaignTool: Tool = {
  name: 'create_campaign',
  description: `Create a new multi-touch email campaign.

This tool creates a campaign in DRAFT status. You'll need to:
1. Add email sequences with add_sequence tool
2. Start the campaign with start_campaign tool

Targeting options (use ONE of these):
- target_prospect_ids: Specific prospect IDs
- target_tags: Prospects with specific tags
- target_status: Prospects with specific status (e.g., "qualified")

Scheduling:
- send_days_of_week: [1,2,3,4,5] for weekdays only
- send_hours_start/end: Business hours (e.g., 9-17)
- send_timezone: e.g., "America/Chicago", "America/New_York"`,
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Campaign name' },
      description: { type: 'string', description: 'Campaign description' },
      from_email: { type: 'string', description: 'Sender email address' },
      from_name: { type: 'string', description: 'Sender name' },
      target_prospect_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific prospect IDs',
      },
      target_tags: { type: 'array', items: { type: 'string' }, description: 'Target tags' },
      target_status: { type: 'string', description: 'Target status' },
      send_days_of_week: {
        type: 'array',
        items: { type: 'number' },
        description: 'Days to send (1=Mon)',
      },
      send_hours_start: { type: 'number', description: 'Start hour' },
      send_hours_end: { type: 'number', description: 'End hour' },
      send_timezone: { type: 'string', description: 'Timezone' },
      tracking_enabled: { type: 'boolean', description: 'Enable tracking' },
    },
    required: ['name', 'from_email'],
  },
};

export async function handleCreateCampaign(args: unknown) {
  try {
    const params = createCampaignSchema.parse(args);
    const campaign = await campaignManager.createCampaign(params);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              campaign: {
                id: campaign.id,
                name: campaign.name,
                status: campaign.status,
                from_email: campaign.from_email,
                from_name: campaign.from_name,
                targeting: {
                  prospect_ids: campaign.target_prospect_ids?.length || 0,
                  tags: campaign.target_tags,
                  status: campaign.target_status,
                },
                schedule: {
                  days: campaign.send_days_of_week,
                  hours: `${campaign.send_hours_start}-${campaign.send_hours_end}`,
                  timezone: campaign.send_timezone,
                },
                tracking_enabled: campaign.tracking_enabled,
                created_at: campaign.created_at,
              },
              next_steps: [
                'Add email sequences using add_email_sequence tool',
                'Start campaign using start_campaign tool',
              ],
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    logger.error('create_campaign tool failed', { error: error.message });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: false, error: error.message }),
        },
      ],
      isError: true,
    };
  }
}
