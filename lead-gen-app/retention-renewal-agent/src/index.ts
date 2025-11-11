import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { initializeRetentionDb, shutdownRetentionDb } from './db/client.js';
import { getConfig } from './utils/config.js';
import { logger, logStartup } from './utils/logger.js';
import { ALL_RETENTION_TOOLS, RETENTION_TOOL_HANDLERS } from './tools/index.js';

const SERVER_INFO = {
  name: 'retention-renewal-agent',
  version: '0.1.0',
  description: 'Monitors customer health signals and orchestrates renewal playbooks.',
  protocolVersion: '2024-11-05',
};

async function main() {
  try {
    await initializeRetentionDb();
    const config = getConfig();

    logger.info('Retention & Renewal Agent starting', {
      config: {
        hasSlackWebhook: Boolean(config.NOTIFICATION_SLACK_WEBHOOK),
      },
      tools: ALL_RETENTION_TOOLS.length,
    });

    const server = new Server(SERVER_INFO, {
      capabilities: {
        tools: {},
      },
    });

    logStartup(
      SERVER_INFO.name,
      SERVER_INFO.version,
      ALL_RETENTION_TOOLS.map((tool: any) => tool.name ?? 'retention_tool')
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: ALL_RETENTION_TOOLS,
    }));

  server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      const { name, arguments: args } = request.params;
      const handler = RETENTION_TOOL_HANDLERS[name];

      if (!handler) {
        logger.warn('Unknown tool requested', { toolName: name });
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }

      try {
        return await handler(args ?? {});
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
    logger.error('Retention & Renewal Agent failed to start', { error: error.message });
    console.error('Retention & Renewal Agent failed to start:', error.message);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down.');
  await shutdownRetentionDb();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down.');
  await shutdownRetentionDb();
  process.exit(0);
});

process.on('uncaughtException', async (error: any) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  await shutdownRetentionDb();
  process.exit(1);
});

process.on('unhandledRejection', async (reason: any) => {
  logger.error('Unhandled rejection', { reason });
  await shutdownRetentionDb();
  process.exit(1);
});

main().catch(async (error) => {
  logger.error('Main entry failed', { error: error.message });
  await shutdownRetentionDb();
  process.exit(1);
});
