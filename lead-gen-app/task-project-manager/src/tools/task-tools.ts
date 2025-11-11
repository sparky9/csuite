import { z } from 'zod';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { TaskService } from '../services/task-service.js';
import type {
  TaskCreateInput,
  TaskUpdateInput,
  ProgressReportInput,
} from '../types/index.js';
import { Logger } from '../utils/logger.js';

type ToolResponse = {
  content: Array<{ type: 'text'; text: string }>;
};

type TaskToolHandler = (input: unknown) => Promise<ToolResponse>;

interface TaskToolDefinition<Schema extends z.ZodTypeAny> {
  tool: Tool;
  schema: Schema;
  execute: (parsed: z.infer<Schema>) => Promise<unknown>;
}

const STATUS_ENUM = ['todo', 'in_progress', 'blocked', 'waiting', 'done'] as const;

const createTaskSchema = z.object({
  userId: z.string().uuid(),
  task: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    projectId: z.string().uuid().optional(),
    dueDate: z.string().datetime().optional(),
    startDate: z.string().datetime().optional(),
    status: z.enum(STATUS_ENUM).optional(),
    impact: z.number().min(1).max(5).optional(),
    effort: z.number().min(1).max(5).optional(),
    confidence: z.number().min(1).max(5).optional(),
    estimatedMinutes: z.number().min(1).optional(),
    tags: z.array(z.string()).optional(),
  }),
});

const updateTaskSchema = z.object({
  userId: z.string().uuid(),
  task: z.object({
    taskId: z.string().uuid(),
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    projectId: z.string().uuid().nullable().optional(),
    dueDate: z.string().datetime().nullable().optional(),
    startDate: z.string().datetime().nullable().optional(),
    status: z.enum(STATUS_ENUM).optional(),
    impact: z.number().min(1).max(5).nullable().optional(),
    effort: z.number().min(1).max(5).nullable().optional(),
    confidence: z.number().min(1).max(5).nullable().optional(),
    estimatedMinutes: z.number().min(1).nullable().optional(),
    actualMinutes: z.number().min(0).nullable().optional(),
    blockedReason: z.string().nullable().optional(),
    tags: z.array(z.string()).nullable().optional(),
  }),
});

const focusListSchema = z.object({
  userId: z.string().uuid(),
});

const progressReportSchema = z.object({
  userId: z.string().uuid(),
  options: z
    .object({
      timeframe: z.enum(['day', 'week', 'month']).optional(),
      referenceDate: z.string().datetime().optional(),
    })
    .optional(),
});

const recommendationsSchema = z.object({
  userId: z.string().uuid(),
  limit: z.number().min(1).max(50).optional(),
});

const taskIdSchema = z.object({
  userId: z.string().uuid(),
  taskId: z.string().uuid(),
});

function toToolResponse(payload: unknown): ToolResponse {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

const toolDefinitions: TaskToolDefinition<any>[] = [
  {
    tool: {
      name: 'task_add',
      description: 'Create a new task with priority scoring and context.',
      inputSchema: {
        type: 'object',
        required: ['userId', 'task'],
        properties: {
          userId: {
            type: 'string',
            description: 'User identifier (UUID).',
            format: 'uuid',
          },
          task: {
            type: 'object',
            required: ['title'],
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              projectId: { type: 'string', format: 'uuid' },
              dueDate: { type: 'string', format: 'date-time' },
              startDate: { type: 'string', format: 'date-time' },
              status: { type: 'string', enum: [...STATUS_ENUM] },
              impact: { type: 'number', minimum: 1, maximum: 5 },
              effort: { type: 'number', minimum: 1, maximum: 5 },
              confidence: { type: 'number', minimum: 1, maximum: 5 },
              estimatedMinutes: { type: 'number', minimum: 1 },
              tags: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
      },
    },
    schema: createTaskSchema,
    execute: async (parsed) => {
      const service = new TaskService(parsed.userId);
      const task = await service.addTask(parsed.task as TaskCreateInput);
      return {
        success: true,
        action: 'task_add',
        task,
      };
    },
  },
  {
    tool: {
      name: 'task_update',
      description: 'Update an existing task and refresh its priority score.',
      inputSchema: {
        type: 'object',
        required: ['userId', 'task'],
        properties: {
          userId: {
            type: 'string',
            format: 'uuid',
            description: 'User identifier (UUID).',
          },
          task: {
            type: 'object',
            required: ['taskId'],
            properties: {
              taskId: { type: 'string', format: 'uuid' },
              title: { type: 'string' },
              description: { type: ['string', 'null'] },
              projectId: { type: ['string', 'null'], format: 'uuid' },
              dueDate: { type: ['string', 'null'], format: 'date-time' },
              startDate: { type: ['string', 'null'], format: 'date-time' },
              status: { type: 'string', enum: [...STATUS_ENUM] },
              impact: { type: ['number', 'null'], minimum: 1, maximum: 5 },
              effort: { type: ['number', 'null'], minimum: 1, maximum: 5 },
              confidence: { type: ['number', 'null'], minimum: 1, maximum: 5 },
              estimatedMinutes: { type: ['number', 'null'], minimum: 1 },
              actualMinutes: { type: ['number', 'null'], minimum: 0 },
              blockedReason: { type: ['string', 'null'] },
              tags: {
                type: ['array', 'null'],
                items: { type: 'string' },
              },
            },
          },
        },
      },
    },
    schema: updateTaskSchema,
    execute: async (parsed) => {
      const service = new TaskService(parsed.userId);
      const task = await service.updateTask(parsed.task as TaskUpdateInput);
      return {
        success: true,
        action: 'task_update',
        task,
      };
    },
  },
  {
    tool: {
      name: 'task_focus',
      description: 'Get Now/Next/Later focus list with smart grouping.',
      inputSchema: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: {
            type: 'string',
            format: 'uuid',
            description: 'User identifier (UUID).',
          },
        },
      },
    },
    schema: focusListSchema,
    execute: async (parsed) => {
      const service = new TaskService(parsed.userId);
      const focus = await service.getFocusList();
      return {
        success: true,
        action: 'task_focus',
        focus,
      };
    },
  },
  {
    tool: {
      name: 'task_progress_report',
      description: 'Generate a progress summary for the requested timeframe.',
      inputSchema: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: {
            type: 'string',
            format: 'uuid',
            description: 'User identifier (UUID).',
          },
          options: {
            type: 'object',
            properties: {
              timeframe: { type: 'string', enum: ['day', 'week', 'month'] },
              referenceDate: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
    schema: progressReportSchema,
    execute: async (parsed) => {
      const service = new TaskService(parsed.userId);
      const report = await service.getProgressReport(parsed.options as ProgressReportInput | undefined);
      return {
        success: true,
        action: 'task_progress_report',
        report,
      };
    },
  },
  {
    tool: {
      name: 'task_recommendations',
      description: 'Retrieve priority recommendations for next actions.',
      inputSchema: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: {
            type: 'string',
            format: 'uuid',
            description: 'User identifier (UUID).',
          },
          limit: {
            type: 'number',
            minimum: 1,
            maximum: 50,
            description: 'Maximum number of recommendations to return.',
          },
        },
      },
    },
    schema: recommendationsSchema,
    execute: async (parsed) => {
      const service = new TaskService(parsed.userId);
      const recommendations = await service.getPriorityRecommendations(parsed.limit);
      return {
        success: true,
        action: 'task_recommendations',
        recommendations,
      };
    },
  },
  {
    tool: {
      name: 'task_complete',
      description: 'Mark a task as completed.',
      inputSchema: {
        type: 'object',
        required: ['userId', 'taskId'],
        properties: {
          userId: { type: 'string', format: 'uuid' },
          taskId: { type: 'string', format: 'uuid' },
        },
      },
    },
    schema: taskIdSchema,
    execute: async (parsed) => {
      const service = new TaskService(parsed.userId);
      const task = await service.completeTask(parsed.taskId);
      return {
        success: true,
        action: 'task_complete',
        task,
      };
    },
  },
  {
    tool: {
      name: 'task_delete',
      description: 'Delete a task permanently.',
      inputSchema: {
        type: 'object',
        required: ['userId', 'taskId'],
        properties: {
          userId: { type: 'string', format: 'uuid' },
          taskId: { type: 'string', format: 'uuid' },
        },
      },
    },
    schema: taskIdSchema,
    execute: async (parsed) => {
      const service = new TaskService(parsed.userId);
      const result = await service.removeTask(parsed.taskId);
      return {
        success: true,
        action: 'task_delete',
        result,
      };
    },
  },
];

export const TASK_MANAGER_TOOLS: Tool[] = toolDefinitions.map((definition) => definition.tool);

export const TASK_TOOL_HANDLERS: Record<string, TaskToolHandler> = toolDefinitions.reduce(
  (handlers, definition) => {
    handlers[definition.tool.name] = async (input: unknown) => {
      try {
        const parsed = definition.schema.parse(input);
        const payload = await definition.execute(parsed);
        return toToolResponse(payload);
      } catch (error) {
        Logger.error('Task tool execution failed during validation or execution', {
          toolName: definition.tool.name,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    };
    return handlers;
  },
  {} as Record<string, TaskToolHandler>,
);
