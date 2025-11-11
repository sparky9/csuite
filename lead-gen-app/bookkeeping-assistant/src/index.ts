/**
 * Bookkeeping Assistant MCP Server
 * AI-powered bookkeeping tools for solopreneurs
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { logStartup, logger } from './utils/logger.js';
import { initializeBookkeepingDb, shutdownBookkeepingDb } from './db/client.js';
import { ALL_BOOKKEEPING_TOOLS, TOOL_HANDLERS } from './tools/index.js';

// Server configuration
const SERVER_INFO = {
  name: 'bookkeeping-assistant',
  version: '1.1.0',
  description: 'AI-powered bookkeeping tools for solopreneurs. Track expenses, scan receipts, export reports, and calculate taxes.',
  protocolVersion: '2024-11-05',
};

/**
 * Initialize and start the MCP server
 */
async function main() {
  try {
  const dbConnected = await initializeBookkeepingDb();
  logger.info('Starting Bookkeeping Assistant MCP server', { dbConnected });

    const server = new Server(SERVER_INFO, {
      capabilities: {
        tools: {},
      },
    });

    // Log startup information
    logStartup(SERVER_INFO.name, SERVER_INFO.version, ALL_BOOKKEEPING_TOOLS.map(t => t.name));

    // List available tools handler
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.debug('ListToolsRequest - returning available tools');
      return {
        tools: ALL_BOOKKEEPING_TOOLS,
      };
    });

    // Handle tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const handler = TOOL_HANDLERS[name];

      if (!handler) {
        logger.warn('Unknown tool requested', { toolName: name, availableTools: Object.keys(TOOL_HANDLERS) });
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}. Available tools: ${Object.keys(TOOL_HANDLERS).join(', ')}`
        );
      }

      logger.info('Tool execution requested', { toolName: name });

      try {
        const startTime = Date.now();
        const result = await handler(args);

        const duration = Date.now() - startTime;
        logger.info('Tool execution completed', { toolName: name, durationMs: duration });

        return result;
      } catch (error: any) {
        logger.error('Tool execution failed', {
          toolName: name,
          error: error.message,
          stack: error.stack,
        });

        // Return error in MCP format
        throw new McpError(
          ErrorCode.InternalError,
          `Tool '${name}' failed: ${error.message}`
        );
      }
    });

    // Start the server
    logger.info('Bookkeeping Assistant MCP Server starting on stdio transport', {
      toolsAvailable: ALL_BOOKKEEPING_TOOLS.length,
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);

  } catch (error: any) {
    logger.error('Failed to start Bookkeeping Assistant MCP server', {
      error: error.message,
      stack: error.stack,
    });

    // Log initialization errors to stderr for debugging
    console.error('Bookkeeping Assistant MCP Server initialization failed:', error.message);

    // Exit with error code for MCP client awareness
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully');
  await shutdownBookkeepingDb();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  await shutdownBookkeepingDb();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  process.exit(1);
});

// Start the server
main()
  .catch(async (error) => {
    logger.error('Main function failed', { error: error.message, stack: error.stack });
    await shutdownBookkeepingDb();
    process.exit(1);
  });
