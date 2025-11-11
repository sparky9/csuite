import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  type CallToolResult
} from '@modelcontextprotocol/sdk/types.js';
import {
  applyDatabaseSchema,
  initializeDatabase,
  shutdownDatabase
} from './db/client.js';
import { logToolExecution, logger } from './utils/logger.js';
import { toolDefinitions, toolHandlers } from './tools/index.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SERVER_INFO = {
  name: 'time-billing-agent',
  version: '0.1.0',
  description: 'Track billable time, manage rate cards, and automate invoicing and payments.',
  protocolVersion: '2024-11-05'
};

const TOOL_DEFINITIONS = toolDefinitions;

async function main(): Promise<void> {
  try {
    await initializeDatabase();
    await applyDatabaseSchema();

    logger.info('Time & Billing Agent starting', {
      tools: TOOL_DEFINITIONS.length
    });

    const server = new Server(SERVER_INFO, {
      capabilities: {
        tools: {}
      }
    });

    server.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: TOOL_DEFINITIONS
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
      const { name, arguments: args } = request.params;
      const handler = toolHandlers[name];

      if (!handler) {
        logger.warn('Unknown tool requested', { toolName: name });
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }

      try {
        const result = await handler(args ?? {});
        logToolExecution(name, { success: true });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Tool execution failed', { toolName: name, error: message });
        throw new McpError(ErrorCode.InternalError, `Tool '${name}' failed: ${message}`);
      }
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Time & Billing Agent failed to start', { error: message });
    console.error('Time & Billing Agent failed to start:', message);
    await shutdownDatabase();
    process.exit(1);
  }
}

function scheduleShutdown(code: number, details: Record<string, unknown> = {}): void {
  void shutdownDatabase()
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Error during shutdown', { error: message, ...details });
    })
    .finally(() => {
      process.exit(code);
    });
}

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down.');
  scheduleShutdown(0, { signal: 'SIGINT' });
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down.');
  scheduleShutdown(0, { signal: 'SIGTERM' });
});

process.on('uncaughtException', (error) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error('Uncaught exception', { error: message });
  scheduleShutdown(1, { context: 'uncaughtException' });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason });
  scheduleShutdown(1, { context: 'unhandledRejection' });
});

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error('Main entry failed', { error: message });
  await shutdownDatabase();
  process.exit(1);
});
