#!/usr/bin/env node

/**
 * VPA Core MCP Server
 *
 * Main entry point for the VPA (Virtual Personal Assistant) MCP orchestrator.
 * Provides 5 unified tools that route to specialized modules.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { initializeDatabase, shutdownDatabase, db } from './db/client.js';
import { validateLicenseKey, type User } from './auth/license.js';
import { executeVPATool } from './orchestrator.js';
import { logger, logError } from './utils/logger.js';
import { isVPAError, formatErrorForMCP } from './utils/errors.js';
import { startBackgroundMonitor, stopBackgroundMonitor } from './research/background-monitor.js';

// Load environment variables
dotenv.config();

/**
 * VPA Server class
 */
class VPAServer {
  private server: Server;
  private currentUser: User | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'vpa-core',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.setupHandlers();
  }

  /**
   * Setup MCP request handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getTools()
    }));

    // Execute tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        // Ensure user is authenticated
        if (!this.currentUser) {
          throw new Error('VPA not initialized. License validation required.');
        }

        const { name, arguments: args } = request.params;

        logger.info('Tool called', {
          userId: this.currentUser.userId,
          tool: name,
          args
        });

        // Route based on tool name
        const result = await this.handleToolCall(name, args || {});

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        logError('Tool execution failed', error, {
          tool: request.params.name,
          userId: this.currentUser?.userId
        });

        return formatErrorForMCP(error);
      }
    });
  }

  /**
   * Define VPA tools
   */
  private getTools(): Tool[] {
    return [
      {
        name: 'vpa_prospects',
        description: 'Find, scrape, and enrich B2B prospects. Search companies by industry/location, find decision makers, enrich data.',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['search', 'find_contacts', 'enrich', 'export', 'stats'],
              description: 'Action to perform with prospects'
            },
            parameters: {
              type: 'object',
              description: 'Action-specific parameters (varies by action)',
              additionalProperties: true
            }
          },
          required: ['action']
        }
      },
      {
        name: 'vpa_pipeline',
        description: 'Manage sales pipeline, track prospects, log activities, schedule follow-ups.',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: [
                'add',
                'update',
                'search',
                'log_activity',
                'follow_ups',
                'stats',
                'import',
                'update_follow_up',
                'next_actions',
                'win_loss_report'
              ],
              description: 'Pipeline action to perform'
            },
            parameters: {
              type: 'object',
              description: 'Action-specific parameters',
              additionalProperties: true
            }
          },
          required: ['action']
        }
      },
      {
        name: 'vpa_tasks',
        description: 'Capture tasks, surface priorities, and generate progress reports.',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['add', 'update', 'focus', 'recommendations', 'recommendation', 'priority', 'priorities', 'complete', 'delete', 'report', 'progress_report'],
              description: 'Task management action to perform'
            },
            parameters: {
              type: 'object',
              description: 'Action-specific parameters',
              additionalProperties: true
            }
          },
          required: ['action']
        }
      },
      {
        name: 'vpa_email',
        description: 'Create email campaigns, send emails, track performance.',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['create_campaign', 'add_sequence', 'start', 'send_one', 'stats', 'pause', 'history', 'create_and_start_sequence'],
              description: 'Email action to perform'
            },
            parameters: {
              type: 'object',
              description: 'Action-specific parameters',
              additionalProperties: true
            }
          },
          required: ['action']
        }
      },
      {
        name: 'vpa_research',
        description: 'Track competitor updates, gather market research, and generate daily digests.',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['add_source', 'list_sources', 'remove_source', 'update_source', 'monitor', 'digest', 'on_demand'],
              description: 'Research workflow action'
            },
            parameters: {
              type: 'object',
              description: 'Action-specific parameters',
              additionalProperties: true
            }
          },
          required: ['action']
        }
      },
      {
        name: 'vpa_modules',
        description: 'Browse enabled modules, upcoming upgrades, and quick-start actions.',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['list'],
              description: 'Module discovery action',
              default: 'list'
            }
          }
        }
      },
      {
        name: 'vpa_status',
        description: 'Check VPA status, enabled modules, usage statistics, subscription info.',
        inputSchema: {
          type: 'object',
          properties: {
            report_type: {
              type: 'string',
              enum: ['modules', 'usage', 'subscription', 'health', 'daily_brief'],
              description: 'Type of status report to generate',
              default: 'modules'
            }
          }
        }
      },
      {
        name: 'vpa_configure',
        description: 'Configure VPA preferences and module settings.',
        inputSchema: {
          type: 'object',
          properties: {
            setting: {
              type: 'string',
              description: 'Setting to configure (e.g., "default_timezone", "email_signature")'
            },
            value: {
              description: 'New value for the setting'
            }
          },
          required: ['setting', 'value']
        }
      },
      {
        name: 'vpa_metrics_dashboard',
        description: 'Get consolidated metrics dashboard with KPIs from all modules (pipeline, business, productivity, reputation).',
        inputSchema: {
          type: 'object',
          properties: {
            timeframe: {
              type: 'string',
              enum: ['7d', '30d', '90d', '1y'],
              description: 'Timeframe for metrics',
              default: '30d'
            }
          }
        }
      }
    ];
  }

  /**
   * Handle tool calls
   */
  private async handleToolCall(toolName: string, args: any): Promise<any> {
    if (!this.currentUser) {
      throw new Error('User not authenticated');
    }

    // Special handling for vpa_metrics_dashboard (no action parameter)
    if (toolName === 'vpa_metrics_dashboard') {
      return await executeVPATool(
        toolName,
        'dashboard',
        args,
        this.currentUser.userId
      );
    }

    // Extract action and parameters
    const action = args.action || 'default';
    const parameters = args.parameters || args;

    // Route to orchestrator
    return await executeVPATool(
      toolName,
      action,
      parameters,
      this.currentUser.userId
    );
  }

  /**
   * Initialize VPA server
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing VPA Core...');

      // Connect to database
      await initializeDatabase();
      logger.info('Database connected');

      // Validate license key
      const licenseKey = process.env.LICENSE_KEY;
      if (!licenseKey) {
        throw new Error('LICENSE_KEY environment variable not set');
      }

      this.currentUser = await validateLicenseKey(licenseKey);
      logger.info('License validated', {
        userId: this.currentUser.userId,
        email: this.currentUser.email,
        plan: this.currentUser.planName,
        modules: this.currentUser.modules
      });

      logger.info('VPA Core initialized successfully', {
        user: this.currentUser.email,
        modules: this.currentUser.modules.length
      });

      // Start background research monitor if research-insights module is enabled
      if (this.currentUser.modules.includes('research-insights')) {
        const checkIntervalMinutes = parseInt(process.env.RESEARCH_CHECK_INTERVAL_MINUTES || '5', 10);
        startBackgroundMonitor(checkIntervalMinutes * 60 * 1000);
        logger.info('Background research monitor started', {
          checkIntervalMinutes
        });
      }
    } catch (error) {
      logError('VPA initialization failed', error);
      throw error;
    }
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    logger.info('VPA Core MCP server started', {
      userId: this.currentUser?.userId,
      email: this.currentUser?.email
    });

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Shutting down VPA Core...');
      stopBackgroundMonitor();
      await shutdownDatabase();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Shutting down VPA Core...');
      stopBackgroundMonitor();
      await shutdownDatabase();
      process.exit(0);
    });
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    const vpaServer = new VPAServer();
    await vpaServer.initialize();
    await vpaServer.start();
  } catch (error) {
    logError('Failed to start VPA server', error);
    process.exit(1);
  }
}

// Run the server
main();
