/**
 * Tests for validation helpers
 */

import { describe, it, expect } from 'vitest';
import {
  validateCapability,
  validateTaskRequest,
  validateTaskResult,
  validateWorkerRegistration,
  validateHealthCheckResponse,
  isValidationSuccess,
  formatValidationErrors,
} from './validation.js';

describe('validateCapability', () => {
  it('validates a correct capability', () => {
    const capability = {
      name: 'analyze-financials-v1',
      version: '1.0.0',
      description: 'Analyzes financial data',
      inputsSchema: {
        type: 'object',
        properties: { amount: { type: 'number' } },
      },
      outputsSchema: {
        type: 'object',
        properties: { result: { type: 'string' } },
      },
    };

    const result = validateCapability(capability);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('analyze-financials-v1');
    }
  });

  it('rejects capability with missing required fields', () => {
    const invalidCapability = {
      name: 'test-v1',
      version: '1.0.0',
      // Missing description, inputsSchema, outputsSchema
    };

    const result = validateCapability(invalidCapability);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.path.includes('description'))).toBe(
        true
      );
    }
  });

  it('provides helpful error messages for invalid version', () => {
    const invalidCapability = {
      name: 'test-v1',
      version: 'invalid-version',
      description: 'Test',
      inputsSchema: { type: 'object' },
      outputsSchema: { type: 'object' },
    };

    const result = validateCapability(invalidCapability);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.path === 'version')).toBe(true);
    }
  });

  it('accepts capability with metadata', () => {
    const capability = {
      name: 'test-v1',
      version: '1.0.0',
      description: 'Test capability',
      inputsSchema: { type: 'object' },
      outputsSchema: { type: 'object' },
      metadata: { category: 'test' },
    };

    const result = validateCapability(capability);
    expect(result.success).toBe(true);
  });
});

describe('validateTaskRequest', () => {
  it('validates a correct task request', () => {
    const request = {
      taskId: '123e4567-e89b-12d3-a456-426614174000',
      capabilityName: 'analyze-financials-v1',
      inputs: { amount: 1000 },
      context: {
        userId: 'user123',
        tenantId: 'tenant456',
      },
    };

    const result = validateTaskRequest(request);
    expect(result.success).toBe(true);
  });

  it('rejects request with invalid UUID', () => {
    const invalidRequest = {
      taskId: 'not-a-uuid',
      capabilityName: 'test-v1',
      inputs: {},
      context: {},
    };

    const result = validateTaskRequest(invalidRequest);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.path === 'taskId')).toBe(true);
    }
  });

  it('rejects request with empty capability name', () => {
    const invalidRequest = {
      taskId: '123e4567-e89b-12d3-a456-426614174000',
      capabilityName: '',
      inputs: {},
      context: {},
    };

    const result = validateTaskRequest(invalidRequest);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.path === 'capabilityName')).toBe(true);
    }
  });

  it('provides clear error messages for multiple validation failures', () => {
    const invalidRequest = {
      taskId: 'invalid-uuid',
      capabilityName: '',
      inputs: {},
      context: {},
    };

    const result = validateTaskRequest(invalidRequest);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('validateTaskResult', () => {
  it('validates a successful task result', () => {
    const result = {
      taskId: '123e4567-e89b-12d3-a456-426614174000',
      success: true,
      outputs: { result: 'completed' },
      metadata: {
        durationMs: 1000,
        startedAt: '2025-01-15T10:00:00.000Z',
        completedAt: '2025-01-15T10:00:01.000Z',
      },
    };

    const validationResult = validateTaskResult(result);
    expect(validationResult.success).toBe(true);
  });

  it('validates a failed task result', () => {
    const result = {
      taskId: '123e4567-e89b-12d3-a456-426614174000',
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
      },
      metadata: {
        durationMs: 100,
        startedAt: '2025-01-15T10:00:00.000Z',
        completedAt: '2025-01-15T10:00:00.100Z',
      },
    };

    const validationResult = validateTaskResult(result);
    expect(validationResult.success).toBe(true);
  });

  it('rejects successful result without outputs', () => {
    const invalidResult = {
      taskId: '123e4567-e89b-12d3-a456-426614174000',
      success: true,
      // Missing outputs
      metadata: {
        durationMs: 1000,
        startedAt: '2025-01-15T10:00:00Z',
        completedAt: '2025-01-15T10:00:01Z',
      },
    };

    const result = validateTaskResult(invalidResult);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.code === 'MISSING_OUTPUTS')).toBe(
        true
      );
    }
  });

  it('rejects failed result without error', () => {
    const invalidResult = {
      taskId: '123e4567-e89b-12d3-a456-426614174000',
      success: false,
      // Missing error
      metadata: {
        durationMs: 100,
        startedAt: '2025-01-15T10:00:00Z',
        completedAt: '2025-01-15T10:00:00.1Z',
      },
    };

    const result = validateTaskResult(invalidResult);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.code === 'MISSING_ERROR')).toBe(true);
    }
  });

  it('rejects result with invalid timestamp order', () => {
    const invalidResult = {
      taskId: '123e4567-e89b-12d3-a456-426614174000',
      success: true,
      outputs: {},
      metadata: {
        durationMs: 1000,
        startedAt: '2025-01-15T10:00:01Z',
        completedAt: '2025-01-15T10:00:00Z', // Before start!
      },
    };

    const result = validateTaskResult(invalidResult);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.errors.some((e) => e.code === 'INVALID_TIMESTAMP_ORDER')
      ).toBe(true);
    }
  });

  it('rejects result with mismatched duration and timestamps', () => {
    const invalidResult = {
      taskId: '123e4567-e89b-12d3-a456-426614174000',
      success: true,
      outputs: {},
      metadata: {
        durationMs: 5000, // Claims 5 seconds
        startedAt: '2025-01-15T10:00:00.000Z',
        completedAt: '2025-01-15T10:00:01.000Z', // Actually 1 second
      },
    };

    const result = validateTaskResult(invalidResult);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.code === 'DURATION_MISMATCH')).toBe(
        true
      );
    }
  });

  it('accepts result with metrics', () => {
    const result = {
      taskId: '123e4567-e89b-12d3-a456-426614174000',
      success: true,
      outputs: {},
      metadata: {
        durationMs: 1000,
        startedAt: '2025-01-15T10:00:00.000Z',
        completedAt: '2025-01-15T10:00:01.000Z',
        metrics: [
          {
            name: 'api_calls',
            value: 5,
            timestamp: '2025-01-15T10:00:00.5Z',
          },
        ],
      },
    };

    const validationResult = validateTaskResult(result);
    expect(validationResult.success).toBe(true);
  });

  it('allows small duration tolerance for rounding', () => {
    const result = {
      taskId: '123e4567-e89b-12d3-a456-426614174000',
      success: true,
      outputs: {},
      metadata: {
        durationMs: 1500,
        startedAt: '2025-01-15T10:00:00.000Z',
        completedAt: '2025-01-15T10:00:01.234Z', // 1234ms actual
      },
    };

    const validationResult = validateTaskResult(result);
    expect(validationResult.success).toBe(true);
  });
});

describe('validateWorkerRegistration', () => {
  it('validates a correct worker registration', () => {
    const registration = {
      workerId: 'worker-1',
      capabilities: [
        {
          name: 'test-v1',
          version: '1.0.0',
          description: 'Test capability',
          inputsSchema: { type: 'object' },
          outputsSchema: { type: 'object' },
        },
      ],
    };

    const result = validateWorkerRegistration(registration);
    expect(result.success).toBe(true);
  });

  it('rejects registration with empty capabilities', () => {
    const invalidRegistration = {
      workerId: 'worker-1',
      capabilities: [],
    };

    const result = validateWorkerRegistration(invalidRegistration);
    expect(result.success).toBe(false);
  });

  it('rejects registration with invalid capability', () => {
    const invalidRegistration = {
      workerId: 'worker-1',
      capabilities: [
        {
          name: 'test-v1',
          version: 'invalid',
          description: 'Test',
          inputsSchema: { type: 'object' },
          outputsSchema: { type: 'object' },
        },
      ],
    };

    const result = validateWorkerRegistration(invalidRegistration);
    expect(result.success).toBe(false);
  });
});

describe('validateHealthCheckResponse', () => {
  it('validates healthy status', () => {
    const response = {
      status: 'healthy',
      timestamp: '2025-01-15T10:00:00Z',
    };

    const result = validateHealthCheckResponse(response);
    expect(result.success).toBe(true);
  });

  it('validates degraded status with details', () => {
    const response = {
      status: 'degraded',
      timestamp: '2025-01-15T10:00:00Z',
      details: { reason: 'High load' },
    };

    const result = validateHealthCheckResponse(response);
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const response = {
      status: 'unknown',
      timestamp: '2025-01-15T10:00:00Z',
    };

    const result = validateHealthCheckResponse(response);
    expect(result.success).toBe(false);
  });
});

describe('isValidationSuccess', () => {
  it('returns true for successful validation', () => {
    const result = validateHealthCheckResponse({
      status: 'healthy',
      timestamp: '2025-01-15T10:00:00Z',
    });

    expect(isValidationSuccess(result)).toBe(true);
  });

  it('returns false for failed validation', () => {
    const result = validateHealthCheckResponse({
      status: 'invalid',
      timestamp: '2025-01-15T10:00:00Z',
    });

    expect(isValidationSuccess(result)).toBe(false);
  });
});

describe('formatValidationErrors', () => {
  it('formats errors with paths', () => {
    const errors = [
      { path: 'taskId', message: 'Invalid UUID', code: 'invalid_string' },
      { path: 'inputs.amount', message: 'Required', code: 'required' },
    ];

    const formatted = formatValidationErrors(errors);
    expect(formatted).toContain('taskId: Invalid UUID');
    expect(formatted).toContain('inputs.amount: Required');
  });

  it('formats errors without paths', () => {
    const errors = [
      { path: '', message: 'General error', code: 'custom' },
    ];

    const formatted = formatValidationErrors(errors);
    expect(formatted).toBe('General error');
  });

  it('joins multiple errors with newlines', () => {
    const errors = [
      { path: 'field1', message: 'Error 1', code: 'error1' },
      { path: 'field2', message: 'Error 2', code: 'error2' },
    ];

    const formatted = formatValidationErrors(errors);
    expect(formatted.split('\n')).toHaveLength(2);
  });
});
