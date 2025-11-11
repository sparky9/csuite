#!/usr/bin/env node

/**
 * EmailOrchestrator MCP Server
 * AI-powered email automation for B2B lead generation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { db } from './db/client.js';
import { logger } from './utils/logger.js';
import { gmailClient } from './email/gmail-client.js';
import { smtpClient } from './email/smtp-client.js';
import { tools, toolHandlers } from './tools/index.js';

// Load environment variables
dotenv.config();

/**
 * MCP Server implementation
 */
class EmailOrchestratorServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'email-orchestrator-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      logger.info('Tool called', { tool: name, args });

      try {
        const handler = toolHandlers[name];
        if (!handler) {
          throw new Error(`Unknown tool: ${name}`);
        }

        const result = await handler(args || {});
        return result;
      } catch (error: any) {
        logger.error('Tool execution failed', {
          tool: name,
          error: error.message,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error.message,
                tool: name,
              }),
            },
          ],
          isError: true,
        };
      }
    });
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      logger.error('MCP Server error', { error });
    };

    process.on('SIGINT', async () => {
      logger.info('Shutting down EmailOrchestrator MCP server');
      await db.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Shutting down EmailOrchestrator MCP server');
      await db.disconnect();
      process.exit(0);
    });
  }

  async start(): Promise<void> {
    try {
      // Connect to database
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) {
        throw new Error('DATABASE_URL environment variable not set');
      }

      await db.connect(dbUrl);
      logger.info('Database connected');

      const emailProvider =
        process.env.EMAIL_PROVIDER?.toLowerCase() === 'smtp' ? 'smtp' : 'gmail';
      logger.info('Email provider configured', { provider: emailProvider });

      if (emailProvider === 'smtp') {
        try {
          await smtpClient.initialize();
          logger.info('SMTP client initialized');
        } catch (error) {
          logger.error('SMTP initialization failed', { error });
          throw error;
        }
      }

      // Initialize Gmail client (required for Gmail sending, optional for SMTP)
      try {
        await gmailClient.initialize();
        if (gmailClient.isAuthenticated()) {
          logger.info('Gmail client authenticated');
        } else {
          logger.warn('Gmail not authenticated. Run `npm run gmail:auth` to set up OAuth.');
        }
      } catch (error) {
        logger.warn('Gmail initialization failed (non-critical)', { error });
      }

      // Start MCP server with stdio transport
      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      logger.info('EmailOrchestrator MCP server started', {
        tools: tools.map((t) => t.name),
      });
    } catch (error) {
      logger.error('Failed to start server', { error });
      process.exit(1);
    }
  }
}

// Start server
const server = new EmailOrchestratorServer();
server.start().catch((error) => {
  logger.error('Fatal error', { error });
  process.exit(1);
});
