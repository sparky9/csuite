/**
 * ProspectFinder MCP Server
 *
 * MCP-native B2B prospect finder with web scraping and RAG intelligence.
 * This server exposes 5 tools to Claude for finding and enriching prospects.
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
import { searchCompaniesTool } from './tools/search-companies.tool.js';
import { findDecisionMakersTool } from './tools/find-decision-makers.tool.js';
import { enrichCompanyTool } from './tools/enrich-company.tool.js';
import { exportProspectsTool } from './tools/export-prospects.tool.js';
import { getScrapingStatsTool } from './tools/get-scraping-stats.tool.js';
import { supportRagQueryTool } from './tools/support-rag-query.tool.js';
import { supportAgentTool } from './tools/support-agent.tool.js';
import { findPartnershipOpportunitiesTool } from './tools/find-partnership-opportunities.tool.js';
import { generatePartnershipPitchTool } from './tools/generate-partnership-pitch.tool.js';

// Load environment variables
dotenv.config();

/**
 * Initialize database connection (optional - graceful degradation if not available)
 */
async function initializeDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    logger.warn('DATABASE_URL not set. Database features will be unavailable.');
    logger.warn('Set DATABASE_URL in .env file once you have Neon credentials.');
    return false;
  }

  try {
    await db.connect(databaseUrl);
    return true;
  } catch (error) {
    logger.error('Failed to connect to database. Tools will return mock data.', { error });
    return false;
  }
}

/**
 * Main MCP server setup
 */
async function main() {
  logger.info('Starting ProspectFinder MCP Server...');

  // Try to connect to database (non-blocking)
  const dbConnected = await initializeDatabase();
  if (!dbConnected) {
    logger.warn('Running in MOCK MODE. Tools will return sample data.');
  }

  // Create MCP server instance
  const server = new Server(
    {
      name: 'prospect-finder-mcp',
      version: '0.1.0',
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
          name: 'search_companies',
          description:
            'Search for B2B companies matching criteria (industry, location, size). ' +
            'Ideal for finding blue-collar service businesses (HVAC, plumbing, electrical) ' +
            'in specific geographic areas. Returns company basics: name, phone, address, rating.',
          inputSchema: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'City, state, or "City, State" (e.g., "Dallas, TX" or "Dallas")',
              },
              industry: {
                type: 'string',
                description: 'Business type (e.g., "HVAC", "plumbing", "electrical", "roofing")',
              },
              radius_miles: {
                type: 'number',
                description: 'Search radius in miles (default: 25)',
              },
              min_rating: {
                type: 'number',
                description: 'Minimum Google rating (1.0-5.0, default: 3.5)',
              },
              max_results: {
                type: 'number',
                description: 'Maximum companies to return (default: 20, max: 100)',
              },
            },
            required: ['location'],
          },
        },
        {
          name: 'find_decision_makers',
          description:
            'Find decision makers (owners, managers, executives) at a specific company. ' +
            'Scrapes LinkedIn and company websites to identify key contacts with titles, ' +
            'emails, and phone numbers. Essential for B2B outreach.',
          inputSchema: {
            type: 'object',
            properties: {
              company_id: {
                type: 'string',
                description: 'Company ID from search_companies results',
              },
              job_titles: {
                type: 'array',
                items: { type: 'string' },
                description: 'Target job titles (e.g., ["Owner", "CEO", "Manager", "President"])',
              },
              max_results: {
                type: 'number',
                description: 'Maximum people to find (default: 5)',
              },
            },
            required: ['company_id'],
          },
        },
        {
          name: 'enrich_company',
          description:
            'Enrich a company record with additional data from LinkedIn and website. ' +
            'Adds employee count, revenue estimates, industry classification, and more. ' +
            'Improves data quality score for better prospect prioritization.',
          inputSchema: {
            type: 'object',
            properties: {
              company_id: {
                type: 'string',
                description: 'Company ID to enrich',
              },
              sources: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['linkedin', 'website'],
                },
                description: 'Data sources to use (default: both)',
              },
              fields: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['employee_count', 'revenue', 'industry'],
                },
                description: 'Specific fields to enrich (default: all)',
              },
            },
            required: ['company_id'],
          },
        },
        {
          name: 'export_prospects',
          description:
            'Export prospect data for outreach. Filter by quality score, industry, location. ' +
            'Include decision makers. Export to CSV, JSON, or Google Sheets. ' +
            'Perfect for loading into CRM or creating call lists.',
          inputSchema: {
            type: 'object',
            properties: {
              company_ids: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific company IDs to export (optional - exports filtered results if omitted)',
              },
              filters: {
                type: 'object',
                properties: {
                  min_quality_score: {
                    type: 'number',
                    description: 'Minimum data quality score (0.0-1.0)',
                  },
                  industries: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Filter by industries',
                  },
                  states: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Filter by US states (e.g., ["TX", "CA"])',
                  },
                  has_email: {
                    type: 'boolean',
                    description: 'Only include companies with email',
                  },
                  has_phone: {
                    type: 'boolean',
                    description: 'Only include companies with phone',
                  },
                  has_decision_makers: {
                    type: 'boolean',
                    description: 'Only include companies with decision makers found',
                  },
                },
              },
              format: {
                type: 'string',
                enum: ['csv', 'json', 'google_sheets'],
                description: 'Export format',
              },
              include_decision_makers: {
                type: 'boolean',
                description: 'Include decision maker details in export (default: true)',
              },
            },
            required: ['format'],
          },
        },
        {
          name: 'get_scraping_stats',
          description:
            'Get statistics about scraping jobs, data quality, and system performance. ' +
            'Shows job success rates, companies found, rate limiting status, and database health. ' +
            'Useful for monitoring and troubleshooting.',
          inputSchema: {
            type: 'object',
            properties: {
              time_range: {
                type: 'string',
                enum: ['today', 'week', 'month', 'all'],
                description: 'Time range for statistics (default: all)',
              },
            },
          },
        },
        {
          name: 'support_rag_query',
          description:
            'Search the local support knowledge base (RAG store) to retrieve relevant documentation snippets. ' +
            'Use this before drafting customer responses to ground answers in ingested SOPs, FAQs, and transcripts.',
          inputSchema: {
            type: 'object',
            properties: {
              question: {
                type: 'string',
                description: 'Ticket summary or question to search for in the knowledge base.',
              },
              top_k: {
                type: 'number',
                description: 'Maximum number of chunks to return (default based on server config).',
              },
              min_score: {
                type: 'number',
                description: 'Minimum cosine similarity score required for results (range -1 to 1).',
              },
              source_filter: {
                anyOf: [
                  {
                    type: 'string',
                    description: 'Restrict results to a single document source.',
                  },
                  {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Restrict results to multiple document sources.',
                  },
                ],
              },
            },
            required: ['question'],
          },
        },
        {
          name: 'support_agent',
          description:
            'Autonomous frontline support agent that drafts responses, asks for clarification, or escalates tickets using the local knowledge base.',
          inputSchema: {
            type: 'object',
            properties: {
              ticket_id: {
                type: 'string',
                description: 'Unique ticket identifier.',
              },
              subject: {
                type: 'string',
                description: 'Ticket subject or short summary.',
              },
              body: {
                type: 'string',
                description: 'Full customer message body.',
              },
              customer_name: {
                type: 'string',
                description: 'Customer name if available.',
              },
              channel: {
                type: 'string',
                enum: ['email', 'chat', 'phone', 'webform'],
                description: 'Channel the ticket originated from.',
              },
              priority: {
                type: 'string',
                enum: ['low', 'medium', 'high', 'urgent'],
                description: 'Ticket priority.',
              },
              metadata: {
                type: 'object',
                description: 'Additional structured metadata about the ticket.',
              },
              top_k: {
                type: 'number',
                description: 'Override the number of knowledge snippets to retrieve.',
              },
              min_score: {
                type: 'number',
                description: 'Minimum similarity score for knowledge matches (range -1 to 1).',
              },
              auto_escalate_score: {
                type: 'number',
                description: 'Score threshold below which the agent auto-escalates to a human.',
              },
            },
            required: ['ticket_id', 'subject', 'body'],
          },
        },
        {
          name: 'find_partnership_opportunities',
          description:
            'Search for complementary businesses that would make good partnership targets. ' +
            'Identifies non-competing businesses in complementary industries for co-marketing, ' +
            'referral partnerships, and strategic collaborations. Returns companies with synergy explanations.',
          inputSchema: {
            type: 'object',
            properties: {
              userId: {
                type: 'string',
                description: 'User ID for multi-tenant tracking',
              },
              yourIndustry: {
                type: 'string',
                description: 'Your own industry/business type (e.g., "web design", "hvac", "accounting")',
              },
              location: {
                type: 'string',
                description: 'Geographic location filter (e.g., "Dallas, TX", "California") - optional',
              },
              maxResults: {
                type: 'number',
                description: 'Maximum number of partnership opportunities to return (default: 20, max: 100)',
              },
            },
            required: ['userId', 'yourIndustry'],
          },
        },
        {
          name: 'generate_partnership_pitch',
          description:
            'Create a professional co-marketing outreach template for partnership proposals. ' +
            'Uses AI to generate personalized partnership pitch emails with subject lines, ' +
            'body content, and proposed collaboration terms. Focuses on mutual benefits.',
          inputSchema: {
            type: 'object',
            properties: {
              partnerCompany: {
                type: 'string',
                description: 'Name of the potential partner company',
              },
              partnerIndustry: {
                type: 'string',
                description: 'Industry the partner company operates in',
              },
              proposedCollaboration: {
                type: 'string',
                description: 'Type of collaboration (e.g., "referral program", "co-branded content", "joint webinar")',
              },
            },
            required: ['partnerCompany', 'partnerIndustry', 'proposedCollaboration'],
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
        case 'search_companies':
          return await searchCompaniesTool(args, dbConnected);

        case 'find_decision_makers':
          return await findDecisionMakersTool(args, dbConnected);

        case 'enrich_company':
          return await enrichCompanyTool(args, dbConnected);

        case 'export_prospects':
          return await exportProspectsTool(args, dbConnected);

        case 'get_scraping_stats':
          return await getScrapingStatsTool(args, dbConnected);

        case 'support_rag_query':
          return await supportRagQueryTool(args);

        case 'support_agent':
          return await supportAgentTool(args);

        case 'find_partnership_opportunities':
          return await findPartnershipOpportunitiesTool(args, dbConnected);

        case 'generate_partnership_pitch':
          return await generatePartnershipPitchTool(args);

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

  logger.info('ProspectFinder MCP Server running on stdio');
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
