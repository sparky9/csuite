import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { initializeOnboardingDb, shutdownOnboardingDb } from './db/client.js';
import { logger } from './utils/logger.js';
import { ALL_ONBOARDING_TOOLS, ONBOARDING_TOOL_HANDLERS } from './tools/index.js';

const SERVER_INFO = {
  name: 'client-onboarding-agent',
  version: '0.1.0',
  description: 'MCP server that orchestrates client onboarding plans, intake, and kickoff workflows.',
  protocolVersion: '2024-11-05',
};

async function main() {
  try {
    await initializeOnboardingDb();
    logger.info('Client Onboarding Agent starting', { tools: ALL_ONBOARDING_TOOLS.length });

    const server = new Server(SERVER_INFO, {
      capabilities: {
        tools: {},
      },
    });

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: ALL_ONBOARDING_TOOLS,
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      const { name, arguments: args } = request.params;
      const handler = ONBOARDING_TOOL_HANDLERS[name];

      if (!handler) {
        logger.warn('Unknown tool requested', { toolName: name });
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }

      try {
  return handler(args ?? {});
      } catch (error: any) {
        logger.error('Tool execution failed', {
          toolName: name,
          error: error.message,
        });
        throw new McpError(ErrorCode.InternalError, `Tool '${name}' failed: ${error.message}`);
      }
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error: any) {
    logger.error('Failed to start Client Onboarding Agent', { error: error.message });
    console.error('Client Onboarding Agent failed to start:', error.message);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down.');
  await shutdownOnboardingDb();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down.');
  await shutdownOnboardingDb();
  process.exit(0);
});

process.on('uncaughtException', async (error: any) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  await shutdownOnboardingDb();
  process.exit(1);
});

process.on('unhandledRejection', async (reason: any) => {
  logger.error('Unhandled rejection', { reason });
  await shutdownOnboardingDb();
  process.exit(1);
});

main().catch(async (error) => {
  logger.error('Main entry failed', { error: error.message });
  await shutdownOnboardingDb();
  process.exit(1);
});
