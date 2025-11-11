import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export type ToolResponse = {
  content: Array<{ type: 'text'; text: string }>;
};

export interface ToolDefinition<Schema extends z.ZodTypeAny, Result> {
  name: string;
  description: string;
  schema: Schema;
  execute: (input: z.infer<Schema>) => Promise<Result>;
}

export interface RegisteredTool {
  tool: Tool;
  handler: (input: unknown) => Promise<ToolResponse>;
}

const DEFAULT_ERROR_MESSAGE = 'Invalid tool input. Please check required fields.';

export function registerTool<Schema extends z.ZodTypeAny, Result>(
  definition: ToolDefinition<Schema, Result>
): RegisteredTool {
  const inputSchema = zodToJsonSchema(definition.schema, {
    target: 'jsonSchema7',
    name: `${definition.name}_input`
  }) as Tool['inputSchema'];

  const tool: Tool = {
    name: definition.name,
    description: definition.description,
    inputSchema
  };

  const handler = async (input: unknown): Promise<ToolResponse> => {
    const parsed = definition.schema.safeParse(input);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue: z.ZodIssue) => issue.message).join('; ');
      throw new McpError(ErrorCode.InvalidParams, issues || DEFAULT_ERROR_MESSAGE);
    }

    const result = await definition.execute(parsed.data as z.infer<Schema>);
    return toToolResponse({
      success: true,
      tool: definition.name,
      data: result
    });
  };

  return { tool, handler };
}

export function toToolResponse(payload: unknown): ToolResponse {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload, null, 2)
      }
    ]
  };
}
