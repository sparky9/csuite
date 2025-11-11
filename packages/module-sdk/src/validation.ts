/**
 * Validation helpers for runtime validation of module SDK data structures.
 * These functions provide user-friendly error messages for validation failures.
 */

import { ZodError } from 'zod';
import {
  ModuleCapabilitySchema,
  TaskExecutionRequestSchema,
  TaskExecutionResultSchema,
  WorkerRegistrationSchema,
  HealthCheckResponseSchema,
  type ModuleCapability,
  type TaskExecutionRequest,
  type TaskExecutionResult,
  type WorkerRegistration,
  type HealthCheckResponse,
} from './index.js';

/**
 * Validation result that's either successful with parsed data
 * or failed with detailed error messages
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: ValidationError[] };

/**
 * Structured validation error with path and message
 */
export interface ValidationError {
  /**
   * JSON path to the field that failed validation
   * Example: "capabilities[0].name", "inputs.amount"
   */
  path: string;

  /**
   * Human-readable error message
   */
  message: string;

  /**
   * Error code for programmatic handling
   */
  code: string;
}

/**
 * Formats Zod validation errors into user-friendly error messages
 */
function formatZodError(error: ZodError): ValidationError[] {
  return error.errors.map((err) => ({
    path: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));
}

/**
 * Validates ModuleCapability structure
 *
 * Checks:
 * - All required fields are present
 * - name follows naming conventions
 * - version is valid semver
 * - schemas are valid JSON Schema objects
 *
 * @param data - Data to validate
 * @returns ValidationResult with parsed capability or errors
 *
 * @example
 * ```typescript
 * const result = validateCapability({
 *   name: "analyze-financials-v1",
 *   version: "1.0.0",
 *   description: "Analyzes financial data",
 *   inputsSchema: { type: "object", properties: {} },
 *   outputsSchema: { type: "object", properties: {} }
 * });
 *
 * if (result.success) {
 *   console.log("Valid capability:", result.data);
 * } else {
 *   console.error("Validation errors:", result.errors);
 * }
 * ```
 */
export function validateCapability(
  data: unknown
): ValidationResult<ModuleCapability> {
  try {
    const parsed = ModuleCapabilitySchema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, errors: formatZodError(error) };
    }
    return {
      success: false,
      errors: [
        {
          path: '',
          message: 'Unknown validation error',
          code: 'UNKNOWN_ERROR',
        },
      ],
    };
  }
}

/**
 * Validates TaskExecutionRequest structure
 *
 * Checks:
 * - taskId is a valid UUID
 * - capabilityName is present
 * - inputs is an object
 * - context has valid structure
 *
 * @param data - Data to validate
 * @returns ValidationResult with parsed request or errors
 *
 * @example
 * ```typescript
 * const result = validateTaskRequest({
 *   taskId: "123e4567-e89b-12d3-a456-426614174000",
 *   capabilityName: "analyze-financials-v1",
 *   inputs: { amount: 1000 },
 *   context: { userId: "user123" }
 * });
 * ```
 */
export function validateTaskRequest(
  data: unknown
): ValidationResult<TaskExecutionRequest> {
  try {
    const parsed = TaskExecutionRequestSchema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, errors: formatZodError(error) };
    }
    return {
      success: false,
      errors: [
        {
          path: '',
          message: 'Unknown validation error',
          code: 'UNKNOWN_ERROR',
        },
      ],
    };
  }
}

/**
 * Validates TaskExecutionResult structure
 *
 * Checks:
 * - taskId is a valid UUID
 * - success is boolean
 * - outputs present when success=true
 * - error present when success=false
 * - metadata has required fields (durationMs, startedAt, completedAt)
 *
 * @param data - Data to validate
 * @returns ValidationResult with parsed result or errors
 *
 * @example
 * ```typescript
 * const result = validateTaskResult({
 *   taskId: "123e4567-e89b-12d3-a456-426614174000",
 *   success: true,
 *   outputs: { result: "analysis complete" },
 *   metadata: {
 *     durationMs: 1234,
 *     startedAt: "2025-01-15T10:00:00Z",
 *     completedAt: "2025-01-15T10:00:01Z"
 *   }
 * });
 * ```
 */
export function validateTaskResult(
  data: unknown
): ValidationResult<TaskExecutionResult> {
  try {
    const parsed = TaskExecutionResultSchema.parse(data);

    // Additional semantic validation
    const errors: ValidationError[] = [];

    // If success=true, outputs should be present
    if (parsed.success && !parsed.outputs) {
      errors.push({
        path: 'outputs',
        message: 'outputs must be present when success is true',
        code: 'MISSING_OUTPUTS',
      });
    }

    // If success=false, error should be present
    if (!parsed.success && !parsed.error) {
      errors.push({
        path: 'error',
        message: 'error must be present when success is false',
        code: 'MISSING_ERROR',
      });
    }

    // Validate timestamps make sense
    const startedAt = new Date(parsed.metadata.startedAt);
    const completedAt = new Date(parsed.metadata.completedAt);
    if (completedAt < startedAt) {
      errors.push({
        path: 'metadata.completedAt',
        message: 'completedAt must be after startedAt',
        code: 'INVALID_TIMESTAMP_ORDER',
      });
    }

    // Validate duration matches timestamps
    const actualDuration = completedAt.getTime() - startedAt.getTime();
    const reportedDuration = parsed.metadata.durationMs;
    // Allow 1 second tolerance for rounding
    if (Math.abs(actualDuration - reportedDuration) > 1000) {
      errors.push({
        path: 'metadata.durationMs',
        message: `durationMs (${reportedDuration}) doesn't match timestamp difference (${actualDuration})`,
        code: 'DURATION_MISMATCH',
      });
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, errors: formatZodError(error) };
    }
    return {
      success: false,
      errors: [
        {
          path: '',
          message: 'Unknown validation error',
          code: 'UNKNOWN_ERROR',
        },
      ],
    };
  }
}

/**
 * Validates WorkerRegistration structure
 *
 * Checks:
 * - workerId is present
 * - capabilities array has at least one capability
 * - each capability is valid
 *
 * @param data - Data to validate
 * @returns ValidationResult with parsed registration or errors
 */
export function validateWorkerRegistration(
  data: unknown
): ValidationResult<WorkerRegistration> {
  try {
    const parsed = WorkerRegistrationSchema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, errors: formatZodError(error) };
    }
    return {
      success: false,
      errors: [
        {
          path: '',
          message: 'Unknown validation error',
          code: 'UNKNOWN_ERROR',
        },
      ],
    };
  }
}

/**
 * Validates HealthCheckResponse structure
 *
 * @param data - Data to validate
 * @returns ValidationResult with parsed health check response or errors
 */
export function validateHealthCheckResponse(
  data: unknown
): ValidationResult<HealthCheckResponse> {
  try {
    const parsed = HealthCheckResponseSchema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, errors: formatZodError(error) };
    }
    return {
      success: false,
      errors: [
        {
          path: '',
          message: 'Unknown validation error',
          code: 'UNKNOWN_ERROR',
        },
      ],
    };
  }
}

/**
 * Type guard to check if a validation result is successful
 */
export function isValidationSuccess<T>(
  result: ValidationResult<T>
): result is { success: true; data: T } {
  return result.success;
}

/**
 * Formats validation errors into a human-readable string
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  return errors
    .map((err) => {
      const pathPrefix = err.path ? `${err.path}: ` : '';
      return `${pathPrefix}${err.message}`;
    })
    .join('\n');
}
