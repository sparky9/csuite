import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { db } from './db/client.js';
import {
  addSourceTool,
  getDigestTool,
  listSourcesTool,
  removeSourceTool,
  researchOnDemandTool,
  runMonitorTool,
  updateSourceTool,
} from './tools/research-insights.tools.js';
import { logger } from './utils/logger.js';

dotenv.config();

const DEFAULT_USER_ID =
  process.env.RESEARCH_USER_ID || process.env.DEFAULT_USER_ID || '00000000-0000-0000-0000-000000000000';

async function initializeDatabase(): Promise<void> {
  await db.connect();
}

async function main(): Promise<void> {
  logger.info('Starting Research Insights MCP server...');
  await initializeDatabase();

  const server = new Server(
    {
      name: 'research-insights-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'research_add_source',
        description:
          'Add a new competitor or research source to monitor. Validates URL and scheduling options.',
        inputSchema: {
          type: 'object',
          properties: {
            label: {
              type: 'string',
              description: 'Human-friendly name for the source (required).',
            },
            url: {
              type: 'string',
              description: 'HTTP(S) URL to monitor (required).',
            },
            category: {
              type: 'string',
              description: 'Optional category label such as competitor, industry, or trend.',
            },
            frequency: {
              type: 'string',
              enum: ['hourly', 'every-4-hours', 'twice-daily', 'daily', 'weekly', 'manual'],
              description: 'Monitoring cadence. Manual runs use the monitor tool explicitly.',
            },
            notes: {
              type: 'string',
              description: 'Optional operator notes or tags.',
            },
          },
          required: ['label', 'url'],
        },
      },
      {
        name: 'research_list_sources',
        description: 'List configured research sources. Optionally include the latest snapshot metadata.',
        inputSchema: {
          type: 'object',
          properties: {
            include_snapshots: {
              type: 'boolean',
              description: 'Include last snapshot metadata (default true).',
            },
          },
        },
      },
      {
        name: 'research_remove_source',
        description: 'Remove a research source and associated snapshots.',
        inputSchema: {
          type: 'object',
          properties: {
            source_id: {
              type: 'string',
              description: 'Source identifier returned from add/list operations (required).',
            },
          },
          required: ['source_id'],
        },
      },
      {
        name: 'research_run_monitor',
        description:
          'Capture monitored sources, detect changes, and record new snapshots. Supports selective runs.',
        inputSchema: {
          type: 'object',
          properties: {
            source_ids: {
              type: 'array',
              items: { type: 'string' },
              description: 'Limit scanning to these source IDs.',
            },
            force: {
              type: 'boolean',
              description: 'Capture snapshots even if no changes are detected.',
            },
          },
        },
      },
      {
        name: 'research_get_digest',
        description: 'Build a digest summary from recent snapshots and return narrative highlights.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Limit the number of entries included in the digest (default 5).',
            },
          },
        },
      },
      {
        name: 'research_on_demand',
        description: 'Run an on-demand capture for a topic using explicit URLs or tracked sources.',
        inputSchema: {
          type: 'object',
          properties: {
            topic: {
              type: 'string',
              description: 'Topic headline for the summary (required).',
            },
            urls: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional list of URLs to scan (defaults to monitored sources).',
            },
          },
          required: ['topic'],
        },
      },
      {
        name: 'research_update_source',
        description: 'Update labels, URLs, notes, or frequency for an existing research source.',
        inputSchema: {
          type: 'object',
          properties: {
            source_id: {
              type: 'string',
              description: 'Source identifier to update (required).',
            },
            label: {
              type: 'string',
              description: 'Updated label.',
            },
            url: {
              type: 'string',
              description: 'Updated HTTP(S) URL.',
            },
            category: {
              type: 'string',
              description: 'Updated category value.',
            },
            frequency: {
              anyOf: [
                {
                  type: 'string',
                  enum: ['hourly', 'every-4-hours', 'twice-daily', 'daily', 'weekly', 'manual'],
                },
                { type: 'null' },
              ],
              description: 'Set to null to clear scheduled frequency.',
            },
            notes: {
              anyOf: [{ type: 'string' }, { type: 'null' }],
              description: 'Optional updated notes (null clears existing notes).',
            },
          },
          required: ['source_id'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    const { name, arguments: args } = request.params;

    try {
      logger.info('Tool invoked', { tool: name });

      switch (name) {
        case 'research_add_source':
          return await addSourceTool(args, DEFAULT_USER_ID);
        case 'research_list_sources':
          return await listSourcesTool(args, DEFAULT_USER_ID);
        case 'research_remove_source':
          return await removeSourceTool(args, DEFAULT_USER_ID);
        case 'research_run_monitor':
          return await runMonitorTool(args, DEFAULT_USER_ID);
        case 'research_get_digest':
          return await getDigestTool(args, DEFAULT_USER_ID);
        case 'research_on_demand':
          return await researchOnDemandTool(args, DEFAULT_USER_ID);
        case 'research_update_source':
          return await updateSourceTool(args, DEFAULT_USER_ID);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      logger.error('Tool execution failed', {
        tool: name,
        error: error instanceof Error ? error.message : String(error),
      });

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

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('Research Insights MCP server running on stdio.');
}

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled rejection', { reason });
});

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, closing database connection.');
  await db.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, closing database connection.');
  await db.disconnect();
  process.exit(0);
});

main().catch(async (error) => {
  logger.error('Failed to start Research Insights MCP server', {
    error: error instanceof Error ? error.message : String(error),
  });
  await db.disconnect();
  process.exit(1);
});
