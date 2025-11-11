# @ocsuite/module-sdk

SDK defining the contract between the control plane and MCP (Model Context Protocol) workers in the Online C-Suite platform.

## Overview

The module-sdk package provides TypeScript types and Zod schemas for runtime validation of all communication between the control plane and worker modules. It ensures type safety and validation consistency across the distributed system.

## Core Concepts

### Module Capability Contract

Workers expose **capabilities** - discrete units of functionality with well-defined inputs and outputs. Each capability:

- Has a unique name with version suffix (e.g., `analyze-financials-v1`)
- Defines input/output schemas using JSON Schema
- Follows semantic versioning for compatibility
- Can be independently versioned and deployed

### Versioning Strategy

**Capability Naming:**
- Format: `{capability-name}-v{major-version}`
- Example: `analyze-financials-v1`, `generate-report-v2`
- Major version in name indicates breaking changes
- Full semver in `version` field for minor/patch updates

**Compatibility Rules:**
1. Major versions must match exactly (breaking changes)
2. Minor version upgrades are backward compatible
3. Patch updates are always compatible

**Example:**
```typescript
// Worker registers capability
{
  name: "analyze-financials-v1",
  version: "1.2.3",  // Full semver for precise versioning
  description: "Analyzes financial data and generates insights",
  inputsSchema: { /* ... */ },
  outputsSchema: { /* ... */ }
}
```

## Installation

```bash
pnpm add @ocsuite/module-sdk
```

## Usage

### Defining a Capability

```typescript
import { ModuleCapability } from '@ocsuite/module-sdk';

const capability: ModuleCapability = {
  name: 'analyze-financials-v1',
  version: '1.0.0',
  description: 'Analyzes financial data and generates insights',
  inputsSchema: {
    type: 'object',
    properties: {
      amount: { type: 'number', description: 'Transaction amount' },
      currency: { type: 'string', description: 'Currency code (USD, EUR, etc.)' },
      date: { type: 'string', description: 'Transaction date (ISO 8601)' }
    },
    required: ['amount', 'currency']
  },
  outputsSchema: {
    type: 'object',
    properties: {
      category: { type: 'string' },
      confidence: { type: 'number' },
      insights: { type: 'array', items: { type: 'string' } }
    },
    required: ['category', 'confidence']
  },
  metadata: {
    category: 'finance',
    tags: ['analysis', 'insights']
  }
};
```

### Validating Data

```typescript
import {
  validateCapability,
  validateTaskRequest,
  validateTaskResult
} from '@ocsuite/module-sdk/validation';

// Validate a capability definition
const result = validateCapability(capability);

if (result.success) {
  console.log('Valid capability:', result.data);
} else {
  console.error('Validation errors:');
  result.errors.forEach(err => {
    console.error(`  ${err.path}: ${err.message}`);
  });
}

// Validate a task request
const taskResult = validateTaskRequest({
  taskId: '123e4567-e89b-12d3-a456-426614174000',
  capabilityName: 'analyze-financials-v1',
  inputs: { amount: 1000, currency: 'USD' },
  context: { userId: 'user123' }
});
```

### Worker Registration

```typescript
import { WorkerRegistration } from '@ocsuite/module-sdk';
import { validateWorkerRegistration } from '@ocsuite/module-sdk/validation';

const registration: WorkerRegistration = {
  workerId: 'worker-abc-123',
  capabilities: [
    {
      name: 'analyze-financials-v1',
      version: '1.2.0',
      description: 'Financial analysis capability',
      inputsSchema: { type: 'object' },
      outputsSchema: { type: 'object' }
    }
  ],
  metadata: {
    version: '1.0.0',
    hostname: 'worker-node-1',
    maxConcurrency: 10
  }
};

const result = validateWorkerRegistration(registration);
if (result.success) {
  // Register worker with control plane
}
```

### Executing Tasks

```typescript
import {
  TaskExecutionRequest,
  TaskExecutionResult
} from '@ocsuite/module-sdk';

// Control plane sends request
const request: TaskExecutionRequest = {
  taskId: '123e4567-e89b-12d3-a456-426614174000',
  capabilityName: 'analyze-financials-v1',
  inputs: {
    amount: 1000,
    currency: 'USD',
    date: '2025-01-15T10:00:00Z'
  },
  context: {
    userId: 'user123',
    tenantId: 'tenant456',
    timeoutMs: 30000
  }
};

// Worker returns result
const successResult: TaskExecutionResult = {
  taskId: '123e4567-e89b-12d3-a456-426614174000',
  success: true,
  outputs: {
    category: 'expense',
    confidence: 0.95,
    insights: ['Regular monthly expense', 'Similar to previous months']
  },
  metadata: {
    durationMs: 1234,
    startedAt: '2025-01-15T10:00:00.000Z',
    completedAt: '2025-01-15T10:00:01.234Z',
    workerId: 'worker-abc-123'
  }
};

// Or error result
const errorResult: TaskExecutionResult = {
  taskId: '123e4567-e89b-12d3-a456-426614174000',
  success: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid currency code',
    details: { field: 'currency', provided: 'XXX' }
  },
  metadata: {
    durationMs: 50,
    startedAt: '2025-01-15T10:00:00.000Z',
    completedAt: '2025-01-15T10:00:00.050Z'
  }
};
```

### Version Compatibility

```typescript
import {
  isCompatible,
  findBestMatch,
  parseCapabilityVersion
} from '@ocsuite/module-sdk/versioning';

// Check if versions are compatible
isCompatible('1.0.0', '1.2.3');  // true - minor upgrade
isCompatible('1.5.0', '1.4.9');  // false - older minor
isCompatible('2.0.0', '1.9.9');  // false - major mismatch

// Parse capability name
const parsed = parseCapabilityVersion('analyze-financials-v1', '1.2.3');
// Returns: { baseName: 'analyze-financials', majorVersion: 1, fullVersion: '1.2.3' }

// Find best matching capability
const available = [
  { name: 'analyze-financials-v1', version: '1.0.0' },
  { name: 'analyze-financials-v1', version: '1.2.0' },
  { name: 'analyze-financials-v1', version: '1.3.0' }
];

const best = findBestMatch('analyze-financials-v1', '1.1.0', available);
// Returns: { name: 'analyze-financials-v1', version: '1.3.0' }
```

### Emitting Metrics

```typescript
import { MetricSnapshot } from '@ocsuite/module-sdk';

const metrics: MetricSnapshot[] = [
  {
    name: 'task_execution_duration_seconds',
    value: 1.234,
    timestamp: new Date().toISOString(),
    metadata: {
      status: 'success',
      capability: 'analyze-financials-v1'
    }
  },
  {
    name: 'api_calls_total',
    value: 5,
    timestamp: new Date().toISOString()
  }
];

// Include metrics in task result
const result: TaskExecutionResult = {
  // ... other fields
  metadata: {
    durationMs: 1234,
    startedAt: startTime,
    completedAt: endTime,
    metrics: metrics
  }
};
```

### Health Checks

```typescript
import { HealthCheckResponse } from '@ocsuite/module-sdk';

const healthResponse: HealthCheckResponse = {
  status: 'healthy',  // 'healthy' | 'degraded' | 'unhealthy'
  timestamp: new Date().toISOString(),
  details: {
    uptime: 3600,
    activeTasksCount: 5,
    memoryUsage: 0.75
  }
};
```

## API Reference

### Core Types

- **`ModuleCapability`** - Defines a worker capability
- **`MetricSnapshot`** - Metric data point
- **`TaskExecutionRequest`** - Request to execute a capability
- **`TaskExecutionResult`** - Result of task execution
- **`WorkerRegistration`** - Worker registration payload
- **`HealthCheckResponse`** - Health check response

### Validation Functions

All validation functions return `ValidationResult<T>`:
```typescript
type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: ValidationError[] }
```

- **`validateCapability(data)`** - Validates capability structure
- **`validateTaskRequest(data)`** - Validates task request
- **`validateTaskResult(data)`** - Validates task result (with semantic checks)
- **`validateWorkerRegistration(data)`** - Validates worker registration
- **`validateHealthCheckResponse(data)`** - Validates health check response
- **`isValidationSuccess(result)`** - Type guard for successful validation
- **`formatValidationErrors(errors)`** - Formats errors as readable string

### Versioning Functions

- **`parseCapabilityVersion(name, version?)`** - Parses capability name and version
- **`getMajorVersion(name)`** - Extracts major version from name
- **`getBaseName(name)`** - Extracts base name without version
- **`isCompatible(required, provided)`** - Checks version compatibility
- **`isSameCapability(name1, name2)`** - Checks if names refer to same capability
- **`findBestMatch(requiredName, requiredVersion, available)`** - Finds best compatible version
- **`isValidCapabilityName(name)`** - Validates capability name format
- **`formatCapabilityName(baseName, majorVersion)`** - Formats capability name
- **`isValidVersion(version)`** - Validates semver string

## Best Practices

### 1. Always Validate at Boundaries

```typescript
// In worker: validate incoming requests
const requestResult = validateTaskRequest(incomingData);
if (!requestResult.success) {
  return errorResult('VALIDATION_ERROR', formatValidationErrors(requestResult.errors));
}

// In control plane: validate worker responses
const resultValidation = validateTaskResult(workerResponse);
if (!resultValidation.success) {
  // Handle validation failure
}
```

### 2. Use Type Guards

```typescript
import { isValidationSuccess } from '@ocsuite/module-sdk/validation';

const result = validateTaskRequest(data);

if (isValidationSuccess(result)) {
  // TypeScript knows result.data is TaskExecutionRequest
  processTask(result.data);
} else {
  // TypeScript knows result.errors is ValidationError[]
  handleErrors(result.errors);
}
```

### 3. Version Your Capabilities Properly

```typescript
// GOOD: Breaking change = new major version
'analyze-financials-v1' -> 'analyze-financials-v2'

// GOOD: Backward-compatible change = increment minor/patch
{ name: 'analyze-financials-v1', version: '1.0.0' }
-> { name: 'analyze-financials-v1', version: '1.1.0' }

// BAD: Breaking change with same major version
{ name: 'analyze-financials-v1', version: '1.0.0', inputsSchema: {...} }
-> { name: 'analyze-financials-v1', version: '1.1.0', inputsSchema: {...completely different...} }
```

### 4. Include Helpful Metadata

```typescript
const capability: ModuleCapability = {
  // ... required fields
  metadata: {
    category: 'finance',
    tags: ['analysis', 'insights', 'ml'],
    estimatedDurationMs: 2000,
    requiresAuthentication: true,
    rateLimit: { requestsPerMinute: 60 }
  }
};
```

### 5. Emit Meaningful Metrics

```typescript
// Include metrics in task results for observability
const metrics: MetricSnapshot[] = [
  {
    name: 'external_api_calls_total',
    value: apiCallCount,
    timestamp: new Date().toISOString(),
    metadata: { endpoint: '/api/analyze' }
  },
  {
    name: 'cache_hit_ratio',
    value: cacheHits / totalRequests,
    timestamp: new Date().toISOString()
  }
];
```

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Watch mode
pnpm test:watch

# Type check
pnpm typecheck
```

## License

Private - Online C-Suite Platform
