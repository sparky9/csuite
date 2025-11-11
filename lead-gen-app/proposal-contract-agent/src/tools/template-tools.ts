import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { TemplateListInputSchema, TemplateSaveInputSchema } from '../types/tools.js';
import { templateService } from '../services/template-service.js';
import { logger, logToolExecution } from '../utils/logger.js';

export const templateListTool: Tool = {
  name: 'template_list',
  description: 'List available proposal templates with token requirements.',
  inputSchema: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'User identifier (optional).' },
      category: { type: 'string', description: 'Filter by category label.' },
      search: { type: 'string', description: 'Search by template name or description.' },
    },
  },
};

export const templateSaveTool: Tool = {
  name: 'template_save',
  description: 'Create or update a proposal template.',
  inputSchema: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'User identifier (optional).' },
      name: { type: 'string', description: 'Template name.' },
      description: { type: 'string', description: 'Short description.' },
      category: { type: 'string', description: 'Category label.' },
      body: { type: 'string', description: 'Template body with {{token}} placeholders.' },
      requiredTokens: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tokens required for rendering.',
      },
      optionalTokens: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional tokens with safe fallbacks.',
      },
      metadata: { type: 'object', description: 'Extra metadata for templating clients.' },
    },
    required: ['name', 'body'],
  },
};

export async function handleTemplateList(args: unknown) {
  const started = Date.now();
  try {
    const params = TemplateListInputSchema.parse(args ?? {});
    const templates = await templateService.listTemplates(params);
    logToolExecution('template_list', params, Date.now() - started);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, count: templates.length, templates }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    logger.error('template_list failed', { error: error.message });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: false, error: error.message }, null, 2),
        },
      ],
      isError: true,
    };
  }
}

export async function handleTemplateSave(args: unknown) {
  const started = Date.now();
  try {
    const params = TemplateSaveInputSchema.parse(args ?? {});
    const saved = await templateService.saveTemplate(params);
    logToolExecution('template_save', params, Date.now() - started);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, template: saved }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    logger.error('template_save failed', { error: error.message });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: false, error: error.message }, null, 2),
        },
      ],
      isError: true,
    };
  }
}
