import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { initializeTaskDatabase, closePool } from './db/client.js';
import { Logger } from './utils/logger.js';
import { TASK_MANAGER_TOOLS, TASK_TOOL_HANDLERS } from './tools/task-tools.js';

const SERVER_INFO = {
  name: 'task-project-manager',
  version: '0.1.0',
  description: 'AI-assisted task and project management tools for solopreneurs.',
  protocolVersion: '2024-11-05',
};

async function main() {
  try {
    const dbConnected = await initializeTaskDatabase();
    Logger.info('Starting Task Project Manager MCP server', { dbConnected });

    const server = new Server(SERVER_INFO, {
      capabilities: {
        tools: {},
      },
    });

    server.setRequestHandler(ListToolsRequestSchema, async () => {
      Logger.debug('ListToolsRequest handled');
      return {
        tools: TASK_MANAGER_TOOLS,
      };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const handler = TASK_TOOL_HANDLERS[name];

      if (!handler) {
        Logger.warn('Unknown tool requested', { toolName: name });
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}. Available tools: ${Object.keys(TASK_TOOL_HANDLERS).join(', ')}`,
        );
      }

      Logger.info('Executing tool', { toolName: name });

      try {
        const start = Date.now();
        const result = await handler(args);
        const durationMs = Date.now() - start;
        Logger.info('Tool execution completed', { toolName: name, durationMs });
        return result;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        Logger.error('Tool execution failed', { toolName: name, error: message });
        throw new McpError(ErrorCode.InternalError, `Tool '${name}' failed: ${message}`);
      }
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);

    Logger.info('Task Project Manager MCP server listening on stdio');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    Logger.error('Failed to start Task Project Manager MCP server', { error: message });
    console.error('Task Project Manager MCP server failed to start:', message);
    await closePool();
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  Logger.info('Received SIGINT, shutting down');
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  Logger.info('Received SIGTERM, shutting down');
  await closePool();
  process.exit(0);
});

process.on('uncaughtException', async (error) => {
  Logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  await closePool();
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  Logger.error('Unhandled rejection', { reason });
  await closePool();
  process.exit(1);
});

main().catch(async (error) => {
  Logger.error('Main bootstrap failed', { error: error instanceof Error ? error.message : error });
  await closePool();
  process.exit(1);
});
