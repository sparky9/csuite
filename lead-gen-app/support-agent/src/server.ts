import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { ensureDataDir } from './rag/config.js';
import { supportAgentTool } from './tools/support-agent.tool.js';
import { supportRagQueryTool } from './tools/support-rag-query.tool.js';
import { logger } from './utils/logger.js';

dotenv.config();

function validateEnvironment(): void {
  ensureDataDir();

  if (!process.env.ANTHROPIC_API_KEY && process.env.MOCK_SUPPORT_AGENT !== '1') {
    logger.warn('ANTHROPIC_API_KEY is not set. Enable MOCK_SUPPORT_AGENT=1 for offline testing.');
  }
}

async function main(): Promise<void> {
  validateEnvironment();
  logger.info('Starting Support Agent MCP server...');

  const server = new Server(
    {
      name: 'support-agent-mcp',
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
        name: 'support_agent',
        description:
          'Resolve a support ticket using the autonomous support agent. Performs RAG lookup and drafts replies.',
        inputSchema: {
          type: 'object',
          properties: {
            ticket_id: {
              type: 'string',
              description: 'Unique ticket identifier (required).',
            },
            subject: {
              type: 'string',
              description: 'Ticket subject or short summary (required).',
            },
            body: {
              type: 'string',
              description: 'Full ticket body or customer transcript (required).',
            },
            customer_name: {
              type: 'string',
              description: 'Customer name for personalization.',
            },
            channel: {
              type: 'string',
              enum: ['email', 'chat', 'phone', 'webform'],
              description: 'Support intake channel.',
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'urgent'],
              description: 'Ticket priority level.',
            },
            metadata: {
              type: 'object',
              description: 'Arbitrary metadata to pass through to the agent.',
            },
            top_k: {
              type: 'number',
              description: 'Maximum knowledge chunks to retrieve (default 6).',
            },
            min_score: {
              type: 'number',
              description: 'Minimum similarity score threshold (default 0.2).',
            },
            auto_escalate_score: {
              type: 'number',
              description: 'Auto escalates if highest score falls below this value (default 0.28).',
            },
          },
          required: ['ticket_id', 'subject', 'body'],
        },
      },
      {
        name: 'support_rag_query',
        description: 'Search the local support knowledge base and return the top matching chunks.',
        inputSchema: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: 'Query to search against the knowledge base (required).',
            },
            top_k: {
              type: 'number',
              description: 'How many results to return (default 8).',
            },
            min_score: {
              type: 'number',
              description: 'Minimum similarity score required for a match.',
            },
            source_filter: {
              anyOf: [
                { type: 'string' },
                { type: 'array', items: { type: 'string' } },
              ],
              description: 'Restrict results to one or more source identifiers.',
            },
          },
          required: ['question'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    const { name, arguments: args } = request.params;

    try {
      logger.info('Tool invoked', { tool: name });

      switch (name) {
        case 'support_agent':
          return await supportAgentTool(args);
        case 'support_rag_query':
          return await supportRagQueryTool(args);
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

  logger.info('Support Agent MCP server is running (stdio transport)');
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason });
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down.');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down.');
  process.exit(0);
});

main().catch((error) => {
  logger.error('Failed to start Support Agent MCP server', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
