/**
 * Calendar meeting MCP server entrypoint.
 */

import 'dotenv/config';
import { createRequire } from 'module';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { tools, toolHandlers } from './tools/index.js';
import { logStartup, logger } from './utils/logger.js';
import { initializeCalendarDb, shutdownCalendarDb } from './db/client.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  const server = new Server({
    name: pkg.name,
    version: pkg.version,
    description: pkg.description,
    capabilities: {
      tools: {},
    },
  });

  server.oninitialized = () => {
    logStartup(pkg.name, pkg.version, tools.map(tool => tool.name));
  };

  server.fallbackRequestHandler = async (request: any) => {
    switch (request.method) {
      case 'tools/list':
        return { tools };
      case 'tools/call': {
        const params = (request.params ?? {}) as { name: string; arguments?: unknown };
        const handler = toolHandlers[params.name];

        if (!handler) {
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${params.name}`);
        }

        try {
          return await handler(params.arguments ?? {});
        } catch (error) {
          logger.error('Tool execution failed', { tool: params.name, error });
          throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${params.name}`);
        }
      }
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unsupported method: ${request.method}`);
    }
  };

  const connected = await initializeCalendarDb();
  if (!connected) {
    logger.warn('Proceeding without database connectivity; using synthetic data.');
  }

  await server.connect(transport);

  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down.');
    await shutdownCalendarDb();
    await transport.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down.');
    await shutdownCalendarDb();
    await transport.close();
    process.exit(0);
  });
}

main().catch(error => {
  logger.error('Fatal error starting calendar MCP server', { error });
  process.exit(1);
});
