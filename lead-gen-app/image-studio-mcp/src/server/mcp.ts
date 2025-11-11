/**
 * MCP Server implementation for Image Studio
 */
import path from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { ImageStudio } from '../core/stager.js';
import type { PromptGenerationOptions, TransformOptions } from '../types/index.js';
import { listAvailableStyles } from '../utils/stylePresets.js';
import { listCustomStyles, saveCustomStyle, removeCustomStyle } from '../utils/styleLibrary.js';
import { loadBatchTemplate } from '../utils/batchTemplate.js';

const toNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  return Boolean(value);
};

const toOptionalBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (trimmed.length === 0) {
      return undefined;
    }
    if (['true', '1', 'yes', 'y', 'on'].includes(trimmed)) {
      return true;
    }
    if (['false', '0', 'no', 'n', 'off'].includes(trimmed)) {
      return false;
    }
  }
  return Boolean(value);
};

type ToolArgs = Record<string, unknown>;

const normaliseArgs = (args: unknown): ToolArgs =>
  args && typeof args === 'object' ? (args as ToolArgs) : {};

const currentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const resolveMonth = (value: unknown): string => {
  const month = typeof value === 'string' && value.length > 0 ? value : currentMonth();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error(`Invalid month format: ${month}. Expected YYYY-MM.`);
  }
  return month;
};

const getString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

const requireString = (value: unknown, field: string): string => {
  const str = getString(value);
  if (!str) {
    throw new Error(`Missing or invalid required parameter "${field}"`);
  }
  return str;
};

const toStringArray = (value: unknown, field: string): string[] => {
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      const str = getString(item);
      if (!str) {
        throw new Error(`${field}[${index}] must be a non-empty string`);
      }
      return str;
    });
  }
  const str = getString(value);
  return str ? [str] : [];
};

export class ImageStudioMCPServer {
  private server: Server;
  private studio: ImageStudio;

  constructor(replicateToken: string) {
    this.studio = new ImageStudio(replicateToken);
    this.server = new Server(
      {
        name: 'image-studio-mcp',
        version: '1.0.0',
        description: 'Omni-purpose image generation, staging, and transformation tools',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.registerHandlers();
  }

  private getTools(): Tool[] {
    return [
      {
        name: 'generate_image',
        description: 'Generate an image from a text prompt',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { type: 'string', description: 'Text prompt describing the scene' },
            output_path: { type: 'string', description: 'Where to save the generated image' },
            model: { type: 'string', description: 'Replicate model ID override', nullable: true },
            resolution: { type: 'number', description: 'Output resolution', default: 768 },
            num_samples: { type: 'number', description: 'Number of variations to produce', default: 1 },
            negative_prompt: { type: 'string', description: 'Elements to avoid', nullable: true },
            seed: { type: 'number', description: 'Deterministic seed value', nullable: true },
            web_assets: {
              type: 'boolean',
              description: 'Generate multi-size WebP exports alongside the requested output',
              nullable: true,
            },
          },
          required: ['prompt', 'output_path'],
        },
      },
      {
        name: 'transform_image',
        description: 'Apply style/lighting/seasonal transforms to an existing image',
        inputSchema: {
          type: 'object',
          properties: {
            input_path: { type: 'string', description: 'Source image path' },
            output_path: { type: 'string', description: 'Destination path' },
            prompt: { type: 'string', description: 'Transformation instructions', nullable: true },
            model: { type: 'string', description: 'Replicate model ID override', nullable: true },
            resolution: { type: 'number', description: 'Output resolution', default: 768 },
            num_samples: { type: 'number', description: 'Number of variations to produce', default: 1 },
            strength: { type: 'number', description: 'Transformation strength 0-1', default: 0.8 },
            negative_prompt: { type: 'string', description: 'Elements to avoid', nullable: true },
            seed: { type: 'number', description: 'Deterministic seed value', nullable: true },
            web_assets: {
              type: 'boolean',
              description: 'Generate multi-size WebP exports alongside the transformed output',
              nullable: true,
            },
          },
          required: ['input_path', 'output_path'],
        },
      },
      {
        name: 'stage_image',
        description: 'Virtual staging for a single room photo',
        inputSchema: {
          type: 'object',
          properties: {
            input_path: { type: 'string' },
            output_path: { type: 'string' },
            style: {
              type: 'string',
              description: 'Style preset key or custom prompt',
              default: 'ikea_modern',
            },
            resolution: { type: 'number', description: 'Output resolution', default: 768 },
            prompt_strength: {
              type: 'number',
              description: 'Prompt strength to enforce the style (0.5-1.0)',
              default: 0.8,
            },
            num_samples: {
              type: 'number',
              description: 'Number of staged variations to create',
              default: 1,
            },
            negative_prompt: {
              type: 'string',
              description: 'Elements to avoid in the staging result',
              nullable: true,
            },
            seed: {
              type: 'number',
              description: 'Deterministic seed value',
              nullable: true,
            },
            create_comparison: {
              type: 'boolean',
              description: 'Create side-by-side before/after',
              default: false,
            },
            web_assets: {
              type: 'boolean',
              description: 'Generate multi-size WebP exports for the staged output',
              nullable: true,
            },
          },
          required: ['input_path', 'output_path'],
        },
      },
      {
        name: 'batch_stage_images',
        description: 'Stage every image in a folder with consistent styling',
        inputSchema: {
          type: 'object',
          properties: {
            input_folder: { type: 'string' },
            output_folder: { type: 'string' },
            style: {
              type: 'string',
              description: 'Style preset key or custom prompt',
              default: 'ikea_modern',
            },
            create_comparisons: {
              type: 'boolean',
              description: 'Generate comparison boards',
              default: false,
            },
            resolution: { type: 'number', description: 'Output resolution', default: 768 },
            prompt_strength: {
              type: 'number',
              description: 'Prompt strength to enforce the style (0.5-1.0)',
              default: 0.8,
            },
            num_samples: {
              type: 'number',
              description: 'Number of staged variations to create',
              default: 1,
            },
            negative_prompt: {
              type: 'string',
              description: 'Elements to avoid in the staging result',
              nullable: true,
            },
            seed: {
              type: 'number',
              description: 'Deterministic seed value',
              nullable: true,
            },
            template_path: {
              type: 'string',
              description: 'Optional CSV template defining per-image overrides',
              nullable: true,
            },
            web_assets: {
              type: 'boolean',
              description: 'Generate multi-size WebP exports for each staged output',
              nullable: true,
            },
          },
          required: ['input_folder', 'output_folder'],
        },
      },
      {
        name: 'generate_style_variations',
        description: 'Create multiple style variations for one photo',
        inputSchema: {
          type: 'object',
          properties: {
            input_path: { type: 'string' },
            output_folder: { type: 'string' },
            styles: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of preset keys or prompts',
            },
            resolution: { type: 'number', description: 'Output resolution', default: 768 },
            prompt_strength: {
              type: 'number',
              description: 'Prompt strength to enforce the style (0.5-1.0)',
            },
            negative_prompt: {
              type: 'string',
              description: 'Elements to avoid in the staging result',
              nullable: true,
            },
            seed: {
              type: 'number',
              description: 'Deterministic seed value',
              nullable: true,
            },
            web_assets: {
              type: 'boolean',
              description: 'Generate multi-size WebP exports for each variation output',
              nullable: true,
            },
          },
          required: ['input_path', 'output_folder', 'styles'],
        },
      },
      {
        name: 'list_styles',
        description: 'Return default staging styles with descriptions',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'validate_token',
        description: 'Validate the configured Replicate API token.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_cost_summary',
        description: 'Return total spend and usage metrics for a given month (YYYY-MM).',
        inputSchema: {
          type: 'object',
          properties: {
            month: {
              type: 'string',
              description: 'Month to summarize in YYYY-MM format (defaults to current month)',
            },
          },
        },
      },
      {
        name: 'create_style',
        description: 'Create or update a custom style preset with a prompt and metadata.',
        inputSchema: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description: 'Unique key for the style (used with --style)',
            },
            prompt: {
              type: 'string',
              description: 'Prompt text describing the style',
            },
            name: {
              type: 'string',
              description: 'Friendly display name',
            },
            description: {
              type: 'string',
              description: 'Optional description',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional list of tags',
            },
          },
          required: ['key', 'prompt'],
        },
      },
      {
        name: 'remove_style',
        description: 'Delete a custom style preset by key.',
        inputSchema: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description: 'Key of the custom style to remove',
            },
          },
          required: ['key'],
        },
      },
      {
        name: 'list_custom_styles',
        description: 'List saved custom style presets with metadata.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'list_revisions',
        description: 'List recent asset revisions captured during staging, generation, or transforms.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of entries to return (defaults to 20)',
            },
            operation: {
              type: 'string',
              description: 'Filter by operation (stage_image, generate_image, transform_image, etc.)',
            },
          },
        },
      },
      {
        name: 'get_revision',
        description: 'Fetch full revision details for a specific revision id.',
        inputSchema: {
          type: 'object',
          properties: {
            revision_id: {
              type: 'string',
              description: 'Revision identifier returned from other operations',
            },
          },
          required: ['revision_id'],
        },
      },
    ];
  }

  private registerHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getTools(),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const params = normaliseArgs(args);

      try {
        switch (name) {
          case 'generate_image': {
            const prompt = requireString(params.prompt, 'prompt');
            const outputPath = requireString(params.output_path, 'output_path');
            const webAssets = toOptionalBoolean(params.web_assets);
            const options: PromptGenerationOptions = {
              prompt,
              outputPath,
              model: getString(params.model),
              imageResolution: toNumber(params.resolution),
              numSamples: toNumber(params.num_samples),
              negativePrompt: getString(params.negative_prompt),
              seed: toNumber(params.seed),
              ...(webAssets !== undefined ? { webAssets } : {}),
            };
            const result = await this.studio.generateFromPrompt(options);
            return this.successResponse('Image generated successfully', result);
          }
          case 'transform_image': {
            const inputPath = requireString(params.input_path, 'input_path');
            const outputPath = requireString(params.output_path, 'output_path');
            const webAssets = toOptionalBoolean(params.web_assets);
            const transformOptions: TransformOptions = {
              inputPath,
              outputPath,
              prompt: getString(params.prompt),
              model: getString(params.model),
              imageResolution: toNumber(params.resolution),
              numSamples: toNumber(params.num_samples),
              strength: toNumber(params.strength),
              negativePrompt: getString(params.negative_prompt),
              seed: toNumber(params.seed),
              ...(webAssets !== undefined ? { webAssets } : {}),
            };
            const result = await this.studio.transformImageFile(transformOptions);
            return this.successResponse('Image transformed successfully', result);
          }
          case 'stage_image': {
            const inputPath = requireString(params.input_path, 'input_path');
            const outputPath = requireString(params.output_path, 'output_path');
            const webAssets = toOptionalBoolean(params.web_assets);
            const result = await this.studio.stageImageFile(
              inputPath,
              outputPath,
              {
                style: getString(params.style) ?? 'ikea_modern',
                imageResolution: toNumber(params.resolution),
                promptStrength: toNumber(params.prompt_strength),
                numSamples: toNumber(params.num_samples),
                negativePrompt: getString(params.negative_prompt),
                seed: toNumber(params.seed),
                ...(webAssets !== undefined ? { webAssets } : {}),
              },
              toBoolean(params.create_comparison),
            );
            return this.successResponse('Image staged successfully', result);
          }
          case 'batch_stage_images': {
            const inputFolderArg = requireString(params.input_folder, 'input_folder');
            const outputFolderArg = requireString(params.output_folder, 'output_folder');
            const resolvedInput = path.resolve(inputFolderArg);
            const resolvedOutput = path.resolve(outputFolderArg);
            const templatePath = getString(params.template_path);
            const webAssets = toOptionalBoolean(params.web_assets);

            let perImage: Awaited<ReturnType<typeof loadBatchTemplate>> | undefined;
            if (templatePath) {
              perImage = await loadBatchTemplate(templatePath, resolvedInput, resolvedOutput);
            }

            const result = await this.studio.processBatch({
              inputFolder: resolvedInput,
              outputFolder: resolvedOutput,
              style: getString(params.style) ?? 'ikea_modern',
              createComparisons: toBoolean(params.create_comparisons),
              imageResolution: toNumber(params.resolution),
              promptStrength: toNumber(params.prompt_strength),
              numSamples: toNumber(params.num_samples),
              negativePrompt: getString(params.negative_prompt),
              seed: toNumber(params.seed),
              ...(perImage && perImage.length > 0 ? { perImage } : {}),
              ...(webAssets !== undefined ? { webAssets } : {}),
            });
            return this.successResponse('Batch staging complete', result);
          }
          case 'generate_style_variations': {
            const styles = toStringArray(params.styles, 'styles');
            if (styles.length === 0) {
              throw new Error('At least one style must be provided');
            }
            const webAssets = toOptionalBoolean(params.web_assets);
            const variations = await this.studio.generateVariations(
              requireString(params.input_path, 'input_path'),
              requireString(params.output_folder, 'output_folder'),
              styles,
              {
                imageResolution: toNumber(params.resolution),
                promptStrength: toNumber(params.prompt_strength),
                negativePrompt: getString(params.negative_prompt),
                seed: toNumber(params.seed),
                ...(webAssets !== undefined ? { webAssets } : {}),
              },
            );
            return this.successResponse('Generated style variations', {
              variations,
              total_cost: variations.reduce((sum, item) => sum + item.cost, 0),
            });
          }
          case 'list_styles': {
            return this.successResponse('Available styles', {
              styles: listAvailableStyles(),
            });
          }
          case 'validate_token': {
            const valid = await this.studio.validateApiToken();
            return this.successResponse('Token validation complete', {
              valid,
            });
          }
          case 'get_cost_summary': {
            const month = resolveMonth(params.month);
            const summary = this.studio.getMonthlySummary(month);
            return this.successResponse('Monthly cost summary', summary ?? {
              month,
              totalCost: 0,
              totalEvents: 0,
              byOperation: [],
            });
          }
          case 'create_style': {
            const key = requireString(params.key, 'key');
            const prompt = requireString(params.prompt, 'prompt');
            const tags = Array.isArray(params.tags)
              ? params.tags.filter((tag): tag is string => typeof tag === 'string')
              : [];
            const style = saveCustomStyle({
              key,
              name: getString(params.name),
              prompt,
              description: getString(params.description),
              tags,
            });
            return this.successResponse('Custom style saved', style);
          }
          case 'remove_style': {
            const key = requireString(params.key, 'key');
            const removed = removeCustomStyle(key);
            if (!removed) {
              throw new Error(`No custom style found with key "${key}"`);
            }
            return this.successResponse('Custom style removed', { key });
          }
          case 'list_custom_styles': {
            const styles = listCustomStyles();
            return this.successResponse('Custom styles list', { styles });
          }
          case 'list_revisions': {
            const limitValue = toNumber(params.limit);
            const limit = typeof limitValue === 'number' && limitValue > 0 ? Math.floor(limitValue) : undefined;
            const operation = getString(params.operation);
            const revisions = await this.studio.listRevisions({ limit, operation });
            return this.successResponse('Revision history', { revisions });
          }
          case 'get_revision': {
            const revisionId = requireString(params.revision_id, 'revision_id');
            const revision = await this.studio.getRevision(revisionId);
            if (!revision) {
              throw new Error(`No revision found with id "${revisionId}"`);
            }
            return this.successResponse('Revision details', revision);
          }
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  error: error.message,
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    });
  }

  private successResponse(message: string, data: unknown) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              message,
              data,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Image Studio MCP server running on stdio transport');
  }
}
