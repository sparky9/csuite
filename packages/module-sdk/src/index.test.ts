/**
 * Tests for core schemas and types
 */

import { describe, it, expect } from 'vitest';
import {
  ModuleCapabilitySchema,
  MetricSnapshotSchema,
  TaskExecutionRequestSchema,
  TaskExecutionResultSchema,
  WorkerRegistrationSchema,
  HealthCheckResponseSchema,
} from './index.js';

describe('ModuleCapabilitySchema', () => {
  it('validates a valid capability', () => {
    const validCapability = {
      name: 'analyze-financials-v1',
      version: '1.0.0',
      description: 'Analyzes financial data',
      inputsSchema: {
        type: 'object',
        properties: {
          amount: { type: 'number' },
        },
        required: ['amount'],
      },
      outputsSchema: {
        type: 'object',
        properties: {
          result: { type: 'string' },
        },
      },
    };

    const result = ModuleCapabilitySchema.safeParse(validCapability);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('analyze-financials-v1');
      expect(result.data.version).toBe('1.0.0');
    }
  });

  it('rejects capability with invalid version format', () => {
    const invalidCapability = {
      name: 'analyze-financials-v1',
      version: '1.0', // Invalid - must be semver (major.minor.patch)
      description: 'Analyzes financial data',
      inputsSchema: { type: 'object' },
      outputsSchema: { type: 'object' },
    };

    const result = ModuleCapabilitySchema.safeParse(invalidCapability);
    expect(result.success).toBe(false);
  });

  it('rejects capability with empty name', () => {
    const invalidCapability = {
      name: '',
      version: '1.0.0',
      description: 'Test',
      inputsSchema: { type: 'object' },
      outputsSchema: { type: 'object' },
    };

    const result = ModuleCapabilitySchema.safeParse(invalidCapability);
    expect(result.success).toBe(false);
  });

  it('accepts capability with optional metadata', () => {
    const capability = {
      name: 'test-capability-v1',
      version: '1.0.0',
      description: 'Test',
      inputsSchema: { type: 'object' },
      outputsSchema: { type: 'object' },
      metadata: {
        category: 'analytics',
        tags: ['finance', 'data'],
      },
    };

    const result = ModuleCapabilitySchema.safeParse(capability);
    expect(result.success).toBe(true);
  });
});

describe('MetricSnapshotSchema', () => {
  it('validates a valid metric snapshot', () => {
    const validMetric = {
      name: 'task_execution_duration_seconds',
      value: 1.234,
      timestamp: '2025-01-15T10:00:00Z',
      metadata: {
        status: 'success',
        capability: 'analyze-financials-v1',
      },
    };

    const result = MetricSnapshotSchema.safeParse(validMetric);
    expect(result.success).toBe(true);
  });

  it('rejects metric with invalid timestamp', () => {
    const invalidMetric = {
      name: 'test_metric',
      value: 100,
      timestamp: 'not-a-timestamp',
    };

    const result = MetricSnapshotSchema.safeParse(invalidMetric);
    expect(result.success).toBe(false);
  });

  it('accepts metric without metadata', () => {
    const metric = {
      name: 'test_metric',
      value: 42,
      timestamp: '2025-01-15T10:00:00Z',
    };

    const result = MetricSnapshotSchema.safeParse(metric);
    expect(result.success).toBe(true);
  });
});

describe('TaskExecutionRequestSchema', () => {
  it('validates a valid task request', () => {
    const validRequest = {
      taskId: '123e4567-e89b-12d3-a456-426614174000',
      capabilityName: 'analyze-financials-v1',
      inputs: {
        amount: 1000,
        currency: 'USD',
      },
      context: {
        userId: 'user123',
        tenantId: 'tenant456',
        timeoutMs: 30000,
      },
    };

    const result = TaskExecutionRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
  });

  it('rejects request with invalid UUID', () => {
    const invalidRequest = {
      taskId: 'not-a-uuid',
      capabilityName: 'test-v1',
      inputs: {},
      context: {},
    };

    const result = TaskExecutionRequestSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
  });

  it('rejects request with empty capability name', () => {
    const invalidRequest = {
      taskId: '123e4567-e89b-12d3-a456-426614174000',
      capabilityName: '',
      inputs: {},
      context: {},
    };

    const result = TaskExecutionRequestSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
  });

  it('accepts request with minimal context', () => {
    const request = {
      taskId: '123e4567-e89b-12d3-a456-426614174000',
      capabilityName: 'test-v1',
      inputs: { data: 'test' },
      context: {},
    };

    const result = TaskExecutionRequestSchema.safeParse(request);
    expect(result.success).toBe(true);
  });

  it('rejects request with negative timeout', () => {
    const invalidRequest = {
      taskId: '123e4567-e89b-12d3-a456-426614174000',
      capabilityName: 'test-v1',
      inputs: {},
      context: {
        timeoutMs: -1000,
      },
    };

    const result = TaskExecutionRequestSchema.safeParse(invalidRequest);
    expect(result.success).toBe(false);
  });
});

describe('TaskExecutionResultSchema', () => {
  it('validates a successful task result', () => {
    const validResult = {
      taskId: '123e4567-e89b-12d3-a456-426614174000',
      success: true,
      outputs: {
        result: 'analysis complete',
        confidence: 0.95,
      },
      metadata: {
        durationMs: 1234,
        startedAt: '2025-01-15T10:00:00Z',
        completedAt: '2025-01-15T10:00:01.234Z',
        workerId: 'worker-1',
      },
    };

    const result = TaskExecutionResultSchema.safeParse(validResult);
    expect(result.success).toBe(true);
  });

  it('validates a failed task result', () => {
    const validResult = {
      taskId: '123e4567-e89b-12d3-a456-426614174000',
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input parameters',
        details: {
          field: 'amount',
          reason: 'must be positive',
        },
      },
      metadata: {
        durationMs: 100,
        startedAt: '2025-01-15T10:00:00Z',
        completedAt: '2025-01-15T10:00:00.1Z',
      },
    };

    const result = TaskExecutionResultSchema.safeParse(validResult);
    expect(result.success).toBe(true);
  });

  it('rejects result with negative duration', () => {
    const invalidResult = {
      taskId: '123e4567-e89b-12d3-a456-426614174000',
      success: true,
      outputs: {},
      metadata: {
        durationMs: -100,
        startedAt: '2025-01-15T10:00:00Z',
        completedAt: '2025-01-15T10:00:01Z',
      },
    };

    const result = TaskExecutionResultSchema.safeParse(invalidResult);
    expect(result.success).toBe(false);
  });

  it('accepts result with metrics', () => {
    const result = {
      taskId: '123e4567-e89b-12d3-a456-426614174000',
      success: true,
      outputs: {},
      metadata: {
        durationMs: 1000,
        startedAt: '2025-01-15T10:00:00Z',
        completedAt: '2025-01-15T10:00:01Z',
        metrics: [
          {
            name: 'api_calls_total',
            value: 5,
            timestamp: '2025-01-15T10:00:00.5Z',
          },
        ],
      },
    };

    const parseResult = TaskExecutionResultSchema.safeParse(result);
    expect(parseResult.success).toBe(true);
  });
});

describe('WorkerRegistrationSchema', () => {
  it('validates a valid worker registration', () => {
    const validRegistration = {
      workerId: 'worker-abc-123',
      capabilities: [
        {
          name: 'analyze-financials-v1',
          version: '1.0.0',
          description: 'Analyzes financial data',
          inputsSchema: { type: 'object' },
          outputsSchema: { type: 'object' },
        },
      ],
      metadata: {
        version: '1.0.0',
        hostname: 'worker-node-1',
        maxConcurrency: 10,
      },
    };

    const result = WorkerRegistrationSchema.safeParse(validRegistration);
    expect(result.success).toBe(true);
  });

  it('rejects registration with empty capabilities array', () => {
    const invalidRegistration = {
      workerId: 'worker-1',
      capabilities: [],
    };

    const result = WorkerRegistrationSchema.safeParse(invalidRegistration);
    expect(result.success).toBe(false);
  });

  it('rejects registration with empty workerId', () => {
    const invalidRegistration = {
      workerId: '',
      capabilities: [
        {
          name: 'test-v1',
          version: '1.0.0',
          description: 'Test',
          inputsSchema: { type: 'object' },
          outputsSchema: { type: 'object' },
        },
      ],
    };

    const result = WorkerRegistrationSchema.safeParse(invalidRegistration);
    expect(result.success).toBe(false);
  });

  it('accepts registration without metadata', () => {
    const registration = {
      workerId: 'worker-1',
      capabilities: [
        {
          name: 'test-v1',
          version: '1.0.0',
          description: 'Test',
          inputsSchema: { type: 'object' },
          outputsSchema: { type: 'object' },
        },
      ],
    };

    const result = WorkerRegistrationSchema.safeParse(registration);
    expect(result.success).toBe(true);
  });
});

describe('HealthCheckResponseSchema', () => {
  it('validates a healthy status', () => {
    const validResponse = {
      status: 'healthy',
      timestamp: '2025-01-15T10:00:00Z',
      details: {
        uptime: 3600,
        activeTasksCount: 5,
      },
    };

    const result = HealthCheckResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
  });

  it('validates a degraded status', () => {
    const validResponse = {
      status: 'degraded',
      timestamp: '2025-01-15T10:00:00Z',
      details: {
        reason: 'High memory usage',
      },
    };

    const result = HealthCheckResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
  });

  it('validates an unhealthy status', () => {
    const validResponse = {
      status: 'unhealthy',
      timestamp: '2025-01-15T10:00:00Z',
      details: {
        error: 'Database connection failed',
      },
    };

    const result = HealthCheckResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const invalidResponse = {
      status: 'unknown',
      timestamp: '2025-01-15T10:00:00Z',
    };

    const result = HealthCheckResponseSchema.safeParse(invalidResponse);
    expect(result.success).toBe(false);
  });

  it('accepts response without details', () => {
    const response = {
      status: 'healthy',
      timestamp: '2025-01-15T10:00:00Z',
    };

    const result = HealthCheckResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });
});
