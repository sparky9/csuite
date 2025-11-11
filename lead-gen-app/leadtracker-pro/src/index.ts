/**
 * LeadTracker Pro MCP Server
 *
 * MCP-native CRM for B2B lead tracking and pipeline management.
 * This server exposes 10 tools to Claude for managing prospects through the sales pipeline.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { logger } from './utils/logger.js';
import { db } from './db/client.js';

// Import tool handlers
import { addProspectTool } from './tools/add-prospect.tool.js';
import { addContactTool } from './tools/add-contact.tool.js';
import { updateProspectStatusTool } from './tools/update-prospect-status.tool.js';
import { logActivityTool } from './tools/log-activity.tool.js';
import { searchProspectsTool } from './tools/search-prospects.tool.js';
import { getFollowUpsTool } from './tools/get-follow-ups.tool.js';
import { getPipelineStatsTool } from './tools/get-pipeline-stats.tool.js';
import { importProspectsTool } from './tools/import-prospects.tool.js';
import { getNextActionsTool } from './tools/get-next-actions.tool.js';
import { getWinLossReportTool } from './tools/get-win-loss-report.tool.js';
import { batchUpdateStatusTool } from './tools/batch-update-status.tool.js';
import { batchManageTagsTool } from './tools/batch-manage-tags.tool.js';
import { batchDeleteProspectsTool } from './tools/batch-delete-prospects.tool.js';
import { analyzeClientHealthTool } from './tools/analyze-client-health.tool.js';
import { detectUpsellOpportunitiesTool } from './tools/detect-upsell-opportunities.tool.js';
import { generateUpsellPitchTool } from './tools/generate-upsell-pitch.tool.js';

// Load environment variables
dotenv.config();

/**
 * Initialize database connection
 */
async function initializeDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    logger.error('DATABASE_URL not set. Please configure your .env file.');
    throw new Error('DATABASE_URL environment variable is required');
  }

  try {
    await db.connect(databaseUrl);
    return true;
  } catch (error) {
    logger.error('Failed to connect to database', { error });
    throw error;
  }
}

/**
 * Main MCP server setup
 */
async function main() {
  logger.info('Starting LeadTracker Pro MCP Server...');

  // Connect to database (required for this system)
  const dbConnected = await initializeDatabase();
  if (!dbConnected) {
    logger.error('Database connection required. Exiting.');
    process.exit(1);
  }

  // Create MCP server instance
  const server = new Server(
    {
      name: 'leadtracker-pro-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  /**
   * List available tools
   */
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
      {
          name: 'add_prospect',
          description:
            'Create a new prospect in the CRM. Add company information, contact details, ' +
            'tags, deal value, and initial notes. Automatically creates activity log if notes provided.',
          inputSchema: {
            type: 'object',
            properties: {
              company_name: {
                type: 'string',
                description: 'Company name (required)',
              },
              phone: {
                type: 'string',
                description: 'Company phone number',
              },
              email: {
                type: 'string',
                description: 'Company email address',
              },
              website: {
                type: 'string',
                description: 'Company website URL',
              },
              address: {
                type: 'string',
                description: 'Street address',
              },
              city: {
                type: 'string',
                description: 'City',
              },
              state: {
                type: 'string',
                description: 'State (2-letter code)',
              },
              zip_code: {
                type: 'string',
                description: 'ZIP/postal code',
              },
              source: {
                type: 'string',
                description: 'Lead source (e.g., "Yellow Pages", "Referral", "Website")',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Tags for categorization (e.g., ["HVAC", "High Priority"])',
              },
              deal_value: {
                type: 'number',
                description: 'Estimated deal value in dollars',
              },
              notes: {
                type: 'string',
                description: 'Initial notes (creates activity log automatically)',
              },
              prospect_finder_company_id: {
                type: 'string',
                description: 'Link to ProspectFinder company ID if imported',
              },
            },
            required: ['company_name'],
          },
        },
        {
          name: 'add_contact',
          description:
            'Add a contact person to a prospect. Track decision makers, their titles, ' +
            'and contact information. Mark primary contact for the company.',
          inputSchema: {
            type: 'object',
            properties: {
              prospect_id: {
                type: 'string',
                description: 'Prospect ID (UUID)',
              },
              full_name: {
                type: 'string',
                description: 'Contact full name (required)',
              },
              title: {
                type: 'string',
                description: 'Job title (e.g., "Owner", "CEO", "Manager")',
              },
              phone: {
                type: 'string',
                description: 'Direct phone number',
              },
              email: {
                type: 'string',
                description: 'Email address',
              },
              linkedin_url: {
                type: 'string',
                description: 'LinkedIn profile URL',
              },
              is_primary: {
                type: 'boolean',
                description: 'Mark as primary contact (default: false)',
              },
              prospect_finder_decision_maker_id: {
                type: 'string',
                description: 'Link to ProspectFinder decision maker ID if imported',
              },
            },
            required: ['prospect_id', 'full_name'],
          },
        },
        {
          name: 'update_prospect_status',
          description:
            'Update the pipeline status of a prospect. Automatically logs activity when status changes. ' +
            'Valid statuses: new, contacted, qualified, meeting_scheduled, proposal_sent, ' +
            'negotiating, closed_won, closed_lost, on_hold.',
          inputSchema: {
            type: 'object',
            properties: {
              prospect_id: {
                type: 'string',
                description: 'Prospect ID (UUID)',
              },
              new_status: {
                type: 'string',
                enum: [
                  'new',
                  'contacted',
                  'qualified',
                  'meeting_scheduled',
                  'proposal_sent',
                  'negotiating',
                  'closed_won',
                  'closed_lost',
                  'on_hold',
                ],
                description: 'New pipeline status',
              },
              notes: {
                type: 'string',
                description: 'Notes about the status change',
              },
            },
            required: ['prospect_id', 'new_status'],
          },
        },
        {
          name: 'log_activity',
          description:
            'Log an activity (call, email, meeting, or note) for a prospect. ' +
            'Track call outcomes, duration, and schedule follow-ups. ' +
            'Configurable data retention (3, 6, 12, 24, or 60 months).',
          inputSchema: {
            type: 'object',
            properties: {
              prospect_id: {
                type: 'string',
                description: 'Prospect ID (UUID)',
              },
              contact_id: {
                type: 'string',
                description: 'Contact ID if interacting with specific person (UUID)',
              },
              activity_type: {
                type: 'string',
                enum: ['call', 'email', 'meeting', 'note'],
                description: 'Type of activity',
              },
              call_outcome: {
                type: 'string',
                enum: ['answered', 'voicemail', 'no_answer', 'wrong_number'],
                description: 'Call outcome (for call activities only)',
              },
              call_duration_seconds: {
                type: 'number',
                description: 'Call duration in seconds (for call activities)',
              },
              subject: {
                type: 'string',
                description: 'Activity subject/title',
              },
              notes: {
                type: 'string',
                description: 'Activity notes (required)',
              },
              follow_up_date: {
                type: 'string',
                description: 'ISO 8601 date for follow-up reminder (e.g., "2024-10-20T10:00:00Z")',
              },
              retention_months: {
                type: 'number',
                enum: [3, 6, 12, 24, 60],
                description: 'Data retention period in months (default: 12)',
              },
            },
            required: ['prospect_id', 'activity_type', 'notes'],
          },
        },
        {
          name: 'search_prospects',
          description:
            'Search and filter prospects by status, location, tags, source, or keywords. ' +
            'Supports pagination. Returns prospect details with contact and activity counts.',
          inputSchema: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: [
                  'new',
                  'contacted',
                  'qualified',
                  'meeting_scheduled',
                  'proposal_sent',
                  'negotiating',
                  'closed_won',
                  'closed_lost',
                  'on_hold',
                ],
                description: 'Filter by pipeline status',
              },
              city: {
                type: 'string',
                description: 'Filter by city',
              },
              state: {
                type: 'string',
                description: 'Filter by state (2-letter code)',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Filter by tags (matches ANY tag)',
              },
              source: {
                type: 'string',
                description: 'Filter by source',
              },
              has_follow_up: {
                type: 'boolean',
                description: 'Filter prospects with pending follow-ups',
              },
              search_query: {
                type: 'string',
                description: 'Search company name, phone, or email',
              },
              limit: {
                type: 'number',
                description: 'Results per page (default: 50, max: 500)',
              },
              offset: {
                type: 'number',
                description: 'Pagination offset',
              },
            },
          },
        },
        {
          name: 'get_follow_ups',
          description:
            'Get follow-up reminders. Filter by time range (today, this_week, next_week, overdue, all). ' +
            'Shows prospect and contact details for each follow-up.',
          inputSchema: {
            type: 'object',
            properties: {
              time_range: {
                type: 'string',
                enum: ['today', 'this_week', 'next_week', 'overdue', 'all'],
                description: 'Time range for follow-ups (default: today)',
              },
              prospect_id: {
                type: 'string',
                description: 'Filter to specific prospect (UUID)',
              },
              completed: {
                type: 'boolean',
                description: 'Show completed follow-ups (default: false)',
              },
            },
          },
        },
        {
          name: 'get_pipeline_stats',
          description:
            'Get pipeline statistics and metrics. View conversion rates, revenue totals, ' +
            'and breakdown by status, source, city, or tags. Filter by time range.',
          inputSchema: {
            type: 'object',
            properties: {
              time_range: {
                type: 'string',
                enum: ['this_week', 'this_month', 'this_quarter', 'all_time'],
                description: 'Time range for statistics (default: all_time)',
              },
              include_revenue: {
                type: 'boolean',
                description: 'Include revenue metrics (default: true)',
              },
              group_by: {
                type: 'string',
                enum: ['status', 'source', 'city', 'tags'],
                description: 'Group statistics by field (default: status)',
              },
            },
          },
        },
        {
          name: 'import_prospects',
          description:
            'Import prospects from ProspectFinder JSON export. Automatically creates prospects ' +
            'and contacts. Skips duplicates. Apply default status and tags to all imports.',
          inputSchema: {
            type: 'object',
            properties: {
              json_file_path: {
                type: 'string',
                description: 'Path to ProspectFinder JSON export file',
              },
              default_status: {
                type: 'string',
                enum: [
                  'new',
                  'contacted',
                  'qualified',
                  'meeting_scheduled',
                  'proposal_sent',
                  'negotiating',
                  'closed_won',
                  'closed_lost',
                  'on_hold',
                ],
                description: 'Default status for imported prospects (default: new)',
              },
              default_tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Tags to apply to all imported prospects',
              },
              source_label: {
                type: 'string',
                description: 'Source label for tracking import batch (e.g., "Yellow Pages - Dallas HVAC - Oct 2024")',
              },
            },
            required: ['json_file_path'],
          },
        },
        {
          name: 'get_next_actions',
          description:
            'Surface the highest-impact follow-ups across the active pipeline. Scores overdue work, ' +
            'upcoming reminders, deal value, and recent activity to recommend what to do next.',
          inputSchema: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                description: 'How many recommendations to return (default 5, max 20)',
                minimum: 1,
                maximum: 20,
              },
            },
          },
        },
        {
          name: 'get_win_loss_report',
          description:
            'Summarize closed-won and closed-lost deals by timeframe. Highlights revenue, win-rate, ' +
            'top sources, and where deals are stalling.',
          inputSchema: {
            type: 'object',
            properties: {
              timeframe: {
                type: 'string',
                enum: ['30d', '60d', '90d', 'quarter', 'year', 'all'],
                description: 'Timeframe to analyze (default 90d)',
              },
            },
          },
        },
        {
          name: 'analyze_client_health',
          description: 'Compute client health score, risks, and recommendations for a specific prospect.',
          inputSchema: {
            type: 'object',
            properties: {
              userId: {
                type: 'string',
                description: 'LeadTracker user identifier (matches prospect.user_id)',
              },
              prospectId: {
                type: 'string',
                description: 'Prospect ID (UUID)',
              },
            },
            required: ['userId', 'prospectId'],
          },
        },
        {
          name: 'detect_upsell_opportunities',
          description:
            'Scan recent activities to surface upsell or cross-sell opportunities with confidence scoring.',
          inputSchema: {
            type: 'object',
            properties: {
              userId: {
                type: 'string',
                description: 'LeadTracker user identifier (scopes the analysis)',
              },
              prospectId: {
                type: 'string',
                description: 'Optional prospect ID (UUID) to analyze a single company',
              },
              minConfidence: {
                type: 'number',
                description: 'Minimum confidence threshold (0-1, default 0.7)',
              },
            },
            required: ['userId'],
          },
        },
        {
          name: 'generate_upsell_pitch',
          description: 'Create a personalized upsell email pitch using recent context and tone guidance.',
          inputSchema: {
            type: 'object',
            properties: {
              prospectId: {
                type: 'string',
                description: 'Prospect ID (UUID)',
              },
              upsellService: {
                type: 'string',
                description: 'Service offering to propose (e.g., "Content Writing Package")',
              },
              tone: {
                type: 'string',
                enum: ['casual', 'professional', 'executive'],
                description: 'Tone to use for the pitch (default: professional)',
              },
            },
            required: ['prospectId', 'upsellService'],
          },
        },
        {
          name: 'batch_update_status',
          description:
            'Bulk update the status of multiple prospects at once. Automatically logs activity for each update.',
          inputSchema: {
            type: 'object',
            properties: {
              prospect_ids: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of prospect IDs (UUIDs) to update',
              },
              new_status: {
                type: 'string',
                enum: [
                  'new',
                  'contacted',
                  'qualified',
                  'meeting_scheduled',
                  'proposal_sent',
                  'negotiating',
                  'closed_won',
                  'closed_lost',
                  'on_hold',
                ],
                description: 'New status to apply to all prospects',
              },
            },
            required: ['prospect_ids', 'new_status'],
          },
        },
        {
          name: 'batch_manage_tags',
          description:
            'Bulk add or remove tags from multiple prospects. Useful for categorizing groups of prospects.',
          inputSchema: {
            type: 'object',
            properties: {
              prospect_ids: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of prospect IDs (UUIDs) to update',
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Tags to add or remove',
              },
              operation: {
                type: 'string',
                enum: ['add', 'remove'],
                description: 'Whether to add or remove the tags',
              },
            },
            required: ['prospect_ids', 'tags', 'operation'],
          },
        },
        {
          name: 'batch_delete_prospects',
          description:
            'Bulk delete multiple prospects and all their associated data (contacts, activities, follow-ups). ' +
            'This operation is permanent and cannot be undone. Requires confirmation.',
          inputSchema: {
            type: 'object',
            properties: {
              prospect_ids: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of prospect IDs (UUIDs) to delete',
              },
              confirm: {
                type: 'boolean',
                description: 'Must be set to true to confirm deletion',
              },
            },
            required: ['prospect_ids', 'confirm'],
          },
        },
      ],
    };
  });

  /**
   * Handle tool execution
   */
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      logger.info('Tool called', { tool: name, args });

      switch (name) {
        case 'add_prospect':
          return await addProspectTool(args);

        case 'add_contact':
          return await addContactTool(args);

        case 'update_prospect_status':
          return await updateProspectStatusTool(args);

        case 'log_activity':
          return await logActivityTool(args);

        case 'search_prospects':
          return await searchProspectsTool(args);

        case 'get_follow_ups':
          return await getFollowUpsTool(args);

        case 'get_pipeline_stats':
          return await getPipelineStatsTool(args);

        case 'import_prospects':
          return await importProspectsTool(args);

        case 'get_next_actions':
          return await getNextActionsTool(args);

        case 'get_win_loss_report':
          return await getWinLossReportTool(args);

        case 'analyze_client_health':
          return await analyzeClientHealthTool(args);

        case 'detect_upsell_opportunities':
          return await detectUpsellOpportunitiesTool(args);

        case 'generate_upsell_pitch':
          return await generateUpsellPitchTool(args);

        case 'batch_update_status':
          return await batchUpdateStatusTool(args);

        case 'batch_manage_tags':
          return await batchManageTagsTool(args);

        case 'batch_delete_prospects':
          return await batchDeleteProspectsTool(args);

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      logger.error('Tool execution failed', { tool: name, error });
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Start server with stdio transport (required for Claude Desktop)
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('LeadTracker Pro MCP Server running on stdio');
  logger.info('Waiting for requests from Claude Desktop...');
}

// Error handling for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
});

process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await db.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down gracefully...');
  await db.disconnect();
  process.exit(0);
});

// Start the server
main().catch((error) => {
  logger.error('Fatal error starting server', { error });
  process.exit(1);
});
