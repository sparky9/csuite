import 'dotenv/config';
import process from 'node:process';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  type CallToolRequest
} from '@modelcontextprotocol/sdk/types.js';
import { db } from './db/client.js';
import { logger, logToolExecution } from './utils/logger.js';
import { REPUTATION_HANDLERS, REPUTATION_TOOLS } from './tools/index.js';

type ToolArguments = CallToolRequest['params']['arguments'];

async function ensureDatabase(): Promise<void> {
  try {
    await db.connect();
  } catch (error) {
    logger.error('Failed to connect to database', {
      error: describeUnknown(error)
    });
    throw error;
  }
}

function describeUnknown(value: unknown): string {
  if (value instanceof Error) {
    return value.message;
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeToolArguments(args: ToolArguments): Record<string, unknown> {
  if (args === undefined || args === null) {
    return {};
  }
  if (typeof args === 'object' && !Array.isArray(args)) {
    return args as Record<string, unknown>;
  }
  throw new McpError(ErrorCode.InvalidParams, 'Tool arguments must be a JSON object');
}

async function main(): Promise<void> {
  await ensureDatabase();
  logger.info('Starting Reputation & Review Agent MCP server');

  const server = new Server(
    {
      name: 'reputation-review-agent',
      version: '0.1.0',
      description: 'Automates solopreneur testimonial and review workflows.'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: REPUTATION_TOOLS
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    const params = request.params;
    const handler = REPUTATION_HANDLERS[params.name];

    if (!handler) {
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${params.name}. Available tools: ${Object.keys(REPUTATION_HANDLERS).join(', ')}`
      );
    }

    const started = Date.now();
    try {
      const toolArgs = normalizeToolArguments(params.arguments);
      const response = await handler(toolArgs);
      const durationMs = Date.now() - started;
      logToolExecution(params.name, { durationMs });
      return response;
    } catch (error) {
      const durationMs = Date.now() - started;
      logger.error('Tool execution failed', {
        tool: params.name,
        durationMs,
        error: describeUnknown(error)
      });
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Tool '${params.name}' failed: ${describeUnknown(error)}`
      );
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('Reputation & Review Agent ready for stdio requests');
}

async function shutdown(code: number): Promise<void> {
  logger.info('Shutting down Reputation & Review Agent', { code });
  await db.disconnect();
  process.exit(code);
}

process.on('SIGINT', () => {
  shutdown(0).catch((error) => {
    logger.error('SIGINT shutdown failed', {
      error: describeUnknown(error)
    });
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  shutdown(0).catch((error) => {
    logger.error('SIGTERM shutdown failed', {
      error: describeUnknown(error)
    });
    process.exit(1);
  });
});

process.on('uncaughtException', (error: unknown) => {
  logger.error('Uncaught exception', {
    error: describeUnknown(error)
  });
  shutdown(1).catch(() => process.exit(1));
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled rejection', { reason: describeUnknown(reason) });
  shutdown(1).catch(() => process.exit(1));
});

main().catch((error) => {
  logger.error('Failed to start server', {
    error: describeUnknown(error)
  });
  shutdown(1).catch(() => process.exit(1));
});
