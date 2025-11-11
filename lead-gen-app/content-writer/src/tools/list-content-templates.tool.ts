/**
 * MCP Tool: List Content Templates
 * Manage reusable content templates
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { listContentTemplatesSchema } from '../utils/validation.js';
import { logger } from '../utils/logger.js';
import type { ListContentTemplatesParams, ContentTemplate, ListTemplatesResult } from '../types/content.types.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const TEMPLATES_FILE = path.join(DATA_DIR, 'content-templates.json');

/**
 * Ensure data directory and file exist with default templates
 */
function ensureTemplatesFile(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(TEMPLATES_FILE)) {
    // Initialize with some default templates
    const defaultTemplates: ContentTemplate[] = [
      {
        id: 'template-001',
        name: 'Product Launch Email',
        type: 'email',
        variables: ['product_name', 'launch_date', 'cta_url', 'key_features'],
        usageCount: 0,
      },
      {
        id: 'template-002',
        name: 'Weekly Newsletter',
        type: 'newsletter',
        variables: ['week_number', 'top_stories', 'upcoming_events', 'cta_text'],
        usageCount: 0,
      },
      {
        id: 'template-003',
        name: 'How-To Blog Post',
        type: 'blog',
        variables: ['topic', 'steps', 'tools_needed', 'expected_outcome'],
        usageCount: 0,
      },
      {
        id: 'template-004',
        name: 'LinkedIn Announcement',
        type: 'social',
        variables: ['announcement', 'company_name', 'hashtags', 'call_to_action'],
        usageCount: 0,
      },
      {
        id: 'template-005',
        name: 'Cold Outreach Email',
        type: 'email',
        variables: ['recipient_name', 'company_name', 'value_proposition', 'meeting_cta'],
        usageCount: 0,
      },
      {
        id: 'template-006',
        name: 'Twitter Thread Starter',
        type: 'social',
        variables: ['hook', 'main_points', 'conclusion', 'hashtags'],
        usageCount: 0,
      },
      {
        id: 'template-007',
        name: 'Case Study Blog',
        type: 'blog',
        variables: ['client_name', 'challenge', 'solution', 'results', 'testimonial'],
        usageCount: 0,
      },
      {
        id: 'template-008',
        name: 'Monthly Newsletter',
        type: 'newsletter',
        variables: ['month', 'highlights', 'metrics', 'next_month_preview'],
        usageCount: 0,
      },
      {
        id: 'template-009',
        name: 'Event Invitation Email',
        type: 'email',
        variables: ['event_name', 'event_date', 'location', 'registration_url', 'benefits'],
        usageCount: 0,
      },
      {
        id: 'template-010',
        name: 'Instagram Caption',
        type: 'social',
        variables: ['visual_description', 'message', 'call_to_action', 'hashtags'],
        usageCount: 0,
      },
    ];

    fs.writeFileSync(
      TEMPLATES_FILE,
      JSON.stringify({ templates: defaultTemplates }, null, 2)
    );
  }
}

/**
 * Load content templates from file
 */
function loadContentTemplates(): ContentTemplate[] {
  ensureTemplatesFile();
  const data = fs.readFileSync(TEMPLATES_FILE, 'utf-8');
  const parsed = JSON.parse(data);
  return parsed.templates || [];
}

export const listContentTemplatesTool: Tool = {
  name: 'list_content_templates',
  description: `List available content templates.

Retrieve reusable content templates with variables that can be filled in.

Required parameters:
- user_id: User ID for multi-tenant support

Optional parameters:
- template_type: Filter by type (email, blog, social, newsletter)

Returns:
- templates: Array of available templates with:
  - id: Template identifier
  - name: Template name
  - type: Content type
  - variables: Array of variable names that can be customized
  - usageCount: Number of times template has been used

Example:
{
  "user_id": "user-123",
  "template_type": "email"
}`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (required)' },
      template_type: {
        type: 'string',
        enum: ['email', 'blog', 'social', 'newsletter'],
        description: 'Filter by template type (optional)',
      },
    },
    required: ['user_id'],
  },
};

export async function handleListContentTemplates(args: unknown, userId?: string) {
  const startTime = Date.now();

  try {
    // Validate parameters
    const params = listContentTemplatesSchema.parse(args) as ListContentTemplatesParams;

    logger.info('Listing content templates', {
      userId: params.user_id || userId,
      templateType: params.template_type,
    });

    // Load templates from file
    let templates = loadContentTemplates();

    // Filter by template type if specified
    if (params.template_type) {
      templates = templates.filter(t => t.type === params.template_type);
    }

    const duration = Date.now() - startTime;

    logger.info('Content templates listed successfully', {
      userId: params.user_id || userId,
      durationMs: duration,
      templateCount: templates.length,
    });

    const result: ListTemplatesResult = {
      templates,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              ...result,
              metadata: {
                template_type_filter: params.template_type,
                total_count: templates.length,
                generation_time_ms: duration,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error('list_content_templates tool failed', {
      error: error.message,
      durationMs: duration,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: error.message,
              tool: 'list_content_templates',
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}
