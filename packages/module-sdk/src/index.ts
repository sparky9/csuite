/**
 * @ocsuite/module-sdk
 *
 * Core SDK defining the contract between the control plane and MCP workers.
 * This module provides TypeScript types and Zod schemas for runtime validation
 * of all communication between the control plane and module workers.
 */

import { z } from 'zod';

/**
 * JSON Schema representation for defining input/output structures
 * Supports basic JSON Schema Draft 7 features commonly used for API validation
 */
export const JsonSchemaSchema = z.object({
  type: z.enum(['object', 'array', 'string', 'number', 'boolean', 'null']),
  properties: z.record(z.any()).optional(),
  items: z.any().optional(),
  required: z.array(z.string()).optional(),
  description: z.string().optional(),
  additionalProperties: z.boolean().optional(),
  enum: z.array(z.any()).optional(),
});

export type JsonSchema = z.infer<typeof JsonSchemaSchema>;

/**
 * ModuleCapability defines a single capability that a worker module provides.
 * Each capability represents a discrete unit of functionality (e.g., "analyze-financials-v1")
 * with well-defined inputs and outputs.
 *
 * Versioning Strategy:
 * - Capability names MUST include version suffix (e.g., "analyze-financials-v1")
 * - Use semantic versioning for breaking changes
 * - Breaking changes require new capability name with incremented version
 * - Non-breaking changes can update the version field in metadata
 */
export const ModuleCapabilitySchema = z.object({
  /**
   * Unique capability identifier including version
   * Format: "{capability-name}-v{major-version}"
   * Example: "analyze-financials-v1", "generate-report-v2"
   */
  name: z.string().min(1),

  /**
   * Semantic version of this capability implementation
   * Used for compatibility checking and rolling updates
   */
  version: z.string().regex(/^\d+\.\d+\.\d+$/),

  /**
   * Human-readable description of what this capability does
   */
  description: z.string(),

  /**
   * JSON Schema defining required and optional inputs
   * The control plane validates requests against this schema before dispatch
   */
  inputsSchema: JsonSchemaSchema,

  /**
   * JSON Schema defining the structure of successful outputs
   * Workers must return data matching this schema on success
   */
  outputsSchema: JsonSchemaSchema,

  /**
   * Optional metadata for capability discovery and routing
   */
  metadata: z.record(z.any()).optional(),
});

export type ModuleCapability = z.infer<typeof ModuleCapabilitySchema>;

/**
 * MetricSnapshot represents a single metric data point emitted by a worker.
 * Workers can emit metrics during task execution for monitoring and observability.
 */
export const MetricSnapshotSchema = z.object({
  /**
   * Metric name following Prometheus naming conventions
   * Example: "task_execution_duration_seconds", "api_calls_total"
   */
  name: z.string().min(1),

  /**
   * Numeric value of the metric
   */
  value: z.number(),

  /**
   * ISO 8601 timestamp when the metric was captured
   */
  timestamp: z.string().datetime(),

  /**
   * Additional labels/dimensions for the metric
   * Example: { "status": "success", "capability": "analyze-financials-v1" }
   */
  metadata: z.record(z.string()).optional(),
});

export type MetricSnapshot = z.infer<typeof MetricSnapshotSchema>;

/**
 * TaskExecutionRequest is sent from the control plane to a worker
 * to execute a specific capability with given inputs.
 */
export const TaskExecutionRequestSchema = z.object({
  /**
   * Unique identifier for this task execution
   * Used for tracking, logging, and correlating results
   */
  taskId: z.string().uuid(),

  /**
   * Name of the capability to invoke (must match a registered capability)
   */
  capabilityName: z.string().min(1),

  /**
   * Input data for the capability execution
   * Must conform to the capability's inputsSchema
   */
  inputs: z.record(z.any()),

  /**
   * Execution context and metadata
   */
  context: z.object({
    /**
     * User or service account initiating the request
     */
    userId: z.string().optional(),

    /**
     * Tenant/organization context for multi-tenant isolation
     */
    tenantId: z.string().optional(),

    /**
     * Maximum execution time in milliseconds
     */
    timeoutMs: z.number().positive().optional(),

    /**
     * Request tracing ID for distributed tracing
     */
    traceId: z.string().optional(),

    /**
     * Additional context fields
     */
    metadata: z.record(z.any()).optional(),
  }),
});

export type TaskExecutionRequest = z.infer<typeof TaskExecutionRequestSchema>;

/**
 * TaskExecutionResult is returned by a worker after executing a task.
 * Contains either successful outputs or error information.
 */
export const TaskExecutionResultSchema = z.object({
  /**
   * Task ID from the original request
   */
  taskId: z.string().uuid(),

  /**
   * Whether the task completed successfully
   */
  success: z.boolean(),

  /**
   * Output data when success=true
   * Must conform to the capability's outputsSchema
   */
  outputs: z.record(z.any()).optional(),

  /**
   * Error information when success=false
   */
  error: z.object({
    /**
     * Error code for programmatic handling
     * Example: "VALIDATION_ERROR", "TIMEOUT", "RESOURCE_NOT_FOUND"
     */
    code: z.string(),

    /**
     * Human-readable error message
     */
    message: z.string(),

    /**
     * Optional stack trace for debugging (should not be sent to end users)
     */
    stack: z.string().optional(),

    /**
     * Additional error context
     */
    details: z.record(z.any()).optional(),
  }).optional(),

  /**
   * Execution metadata
   */
  metadata: z.object({
    /**
     * Execution duration in milliseconds
     */
    durationMs: z.number().nonnegative(),

    /**
     * Worker instance that executed the task
     */
    workerId: z.string().optional(),

    /**
     * Timestamp when execution started (ISO 8601)
     */
    startedAt: z.string().datetime(),

    /**
     * Timestamp when execution completed (ISO 8601)
     */
    completedAt: z.string().datetime(),

    /**
     * Metrics emitted during execution
     */
    metrics: z.array(MetricSnapshotSchema).optional(),

    /**
     * Additional metadata
     */
    extra: z.record(z.any()).optional(),
  }),
});

export type TaskExecutionResult = z.infer<typeof TaskExecutionResultSchema>;

/**
 * WorkerRegistration is sent by a worker to the control plane
 * when it starts up, advertising its available capabilities.
 */
export const WorkerRegistrationSchema = z.object({
  /**
   * Unique identifier for this worker instance
   */
  workerId: z.string().min(1),

  /**
   * List of capabilities this worker can execute
   */
  capabilities: z.array(ModuleCapabilitySchema).min(1),

  /**
   * Worker metadata
   */
  metadata: z.object({
    /**
     * Worker version/build info
     */
    version: z.string().optional(),

    /**
     * Hostname or instance identifier
     */
    hostname: z.string().optional(),

    /**
     * Maximum concurrent tasks this worker can handle
     */
    maxConcurrency: z.number().positive().optional(),

    /**
     * Additional worker metadata
     */
    extra: z.record(z.any()).optional(),
  }).optional(),
});

export type WorkerRegistration = z.infer<typeof WorkerRegistrationSchema>;

/**
 * HealthCheckResponse is returned by workers for health/readiness checks
 */
export const HealthCheckResponseSchema = z.object({
  /**
   * Worker health status
   */
  status: z.enum(['healthy', 'degraded', 'unhealthy']),

  /**
   * Timestamp of the health check (ISO 8601)
   */
  timestamp: z.string().datetime(),

  /**
   * Optional health check details
   */
  details: z.record(z.any()).optional(),
});

export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

// Export all schemas for runtime validation
export const schemas = {
  JsonSchema: JsonSchemaSchema,
  ModuleCapability: ModuleCapabilitySchema,
  MetricSnapshot: MetricSnapshotSchema,
  TaskExecutionRequest: TaskExecutionRequestSchema,
  TaskExecutionResult: TaskExecutionResultSchema,
  WorkerRegistration: WorkerRegistrationSchema,
  HealthCheckResponse: HealthCheckResponseSchema,
};

// Export module capabilities
export * from './modules/growth-pulse';
export * from './personas';
export * from './widgets.js';
