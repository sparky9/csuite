/**
 * Social Media Manager MCP Server
 * AI-powered social media management tools for solopreneurs
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
import { initializeSocialDb, shutdownSocialDb } from './db/client.js';
import { ALL_SOCIAL_TOOLS, TOOL_HANDLERS } from './tools/index.js';

// Server configuration
const SERVER_INFO = {
  name: 'social-media-manager',
  version: '1.0.0',
  description: 'AI-powered social media management tools for solopreneurs. Generate posts, schedule content, analyze performance, and optimize your social media strategy.',
  protocolVersion: '2024-11-05',
};

/**
 * Initialize and start the MCP server
 */
async function main() {
  try {
  const dbConnected = await initializeSocialDb();
  logger.info('Starting Social Media Manager MCP server', { dbConnected });

    const server = new Server(SERVER_INFO, {
      capabilities: {
        tools: {},
      },
    });

    // Log startup information
    logStartup(SERVER_INFO.name, SERVER_INFO.version, ALL_SOCIAL_TOOLS.map(t => t.name));

    // List available tools handler
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.debug('ListToolsRequest - returning available tools');
      return {
        tools: ALL_SOCIAL_TOOLS,
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
    logger.info('Social Media Manager MCP Server starting on stdio transport', {
      toolsAvailable: ALL_SOCIAL_TOOLS.length,
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);

  } catch (error: any) {
    logger.error('Failed to start Social Media Manager MCP server', {
      error: error.message,
      stack: error.stack,
    });

    // Log initialization errors to stderr for debugging
    console.error('Social Media Manager MCP Server initialization failed:', error.message);

    // Exit with error code for MCP client awareness
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully');
  await shutdownSocialDb();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  await shutdownSocialDb();
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
    await shutdownSocialDb();
    process.exit(1);
  });
