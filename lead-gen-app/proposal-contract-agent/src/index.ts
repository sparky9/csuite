import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { initializeProposalContractDb, shutdownProposalContractDb } from './db/client.js';
import { logger, logStartup } from './utils/logger.js';
import { ALL_PROPOSAL_CONTRACT_TOOLS, TOOL_HANDLERS } from './tools/index.js';

const SERVER_INFO = {
  name: 'proposal-contract-agent',
  version: '0.1.0',
  description: 'Proposal generation, contract workflows, and signature reminders for solopreneurs.',
  protocolVersion: '2024-11-05',
};

async function main() {
  try {
    await initializeProposalContractDb();
    logger.info('Proposal & Contract Agent MCP starting', { tools: ALL_PROPOSAL_CONTRACT_TOOLS.length });

    const server = new Server(SERVER_INFO, {
      capabilities: {
        tools: {},
      },
    });

    logStartup(SERVER_INFO.name, SERVER_INFO.version, ALL_PROPOSAL_CONTRACT_TOOLS.map((tool) => tool.name));

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: ALL_PROPOSAL_CONTRACT_TOOLS,
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const handler = TOOL_HANDLERS[name];

      if (!handler) {
        logger.warn('Unknown tool requested', { toolName: name });
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
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
    logger.error('Failed to start MCP server', { error: error.message });
    console.error('Proposal & Contract Agent failed to start:', error.message);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down.');
  await shutdownProposalContractDb();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down.');
  await shutdownProposalContractDb();
  process.exit(0);
});

process.on('uncaughtException', async (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  await shutdownProposalContractDb();
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  logger.error('Unhandled rejection', { reason });
  await shutdownProposalContractDb();
  process.exit(1);
});

main().catch(async (error) => {
  logger.error('Main entry failed', { error: error.message });
  await shutdownProposalContractDb();
  process.exit(1);
});
