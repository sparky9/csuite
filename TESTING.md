# Testing Guide

This document describes the testing setup and practices for the OC-Suite platform.

## Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [CI/CD Testing](#cicd-testing)
- [Test Coverage](#test-coverage)
- [Troubleshooting](#troubleshooting)

## Overview

The OC-Suite project uses **Vitest** as the testing framework across all packages and applications. We have three types of tests:

1. **Unit Tests**: Test individual functions and modules in isolation
2. **Integration Tests**: Test interactions between multiple components
3. **Smoke Tests**: Test critical user journeys end-to-end

## Test Structure

```
csuite-pivot/
├── apps/
│   ├── api/
│   │   ├── tests/
│   │   │   ├── integration/
│   │   │   │   └── smoke.test.ts          # API smoke tests
│   │   │   ├── utils/
│   │   │   │   └── test-helpers.ts        # Test utilities
│   │   │   └── setup.ts                   # Test setup
│   │   └── vitest.config.ts
│   └── web/
│       └── vitest.config.ts
├── packages/
│   ├── db/
│   │   ├── tests/
│   │   └── vitest.config.ts
│   ├── crypto/
│   │   ├── tests/
│   │   └── vitest.config.ts
│   └── module-sdk/
│       ├── tests/
│       └── vitest.config.ts
```

## Running Tests

### Run All Tests

```bash
# Run all tests across all packages and apps
pnpm test

# Run tests in watch mode (auto-rerun on changes)
pnpm test:watch

# Run tests with coverage report
pnpm test:coverage
```

### Run Tests for Specific Packages/Apps

```bash
# Run API tests only
pnpm --filter api test

# Run database package tests
pnpm --filter @ocsuite/db test

# Run web app tests
pnpm --filter web test
```

### Run Integration Tests

```bash
# Run API integration/smoke tests
pnpm test:integration
```

### Phase 4 Regression Suites

Phase 4 introduced dedicated coverage for the approval pipeline:

- `apps/api/tests/unit/utils/risk-scoring.test.ts` – risk heuristics for submitted actions.
- `apps/api/tests/unit/services/action-approvals.test.ts` – submit/approve/reject flows, queue hooks, and notifications.
- `apps/api/tests/unit/workers/action-executor.worker.test.ts` – worker success, idempotency, and failure handling.
- `apps/api/tests/integration/actions.test.ts` – REST endpoints with RLS enforcement and audit access control.

## Writing Tests

### Unit Tests

Unit tests should be placed next to the source files they test, using the `.test.ts` or `.spec.ts` extension.

```typescript
// src/utils/format.ts
export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// src/utils/format.test.ts
import { describe, it, expect } from "vitest";
import { formatCurrency } from "./format";

describe("formatCurrency", () => {
  it("should format currency correctly", () => {
    expect(formatCurrency(100)).toBe("$100.00");
    expect(formatCurrency(99.5)).toBe("$99.50");
  });
});
```

### Integration Tests

Integration tests are located in the `tests/integration/` directory.

```typescript
// apps/api/tests/integration/auth.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";

describe("Authentication", () => {
  let app: any;

  beforeAll(async () => {
    app = createApp();
  });

  it("should reject requests without auth token", async () => {
    const response = await request(app).get("/tasks").expect(401);

    expect(response.body).toHaveProperty("error");
  });
});
```

### Test Helpers

Use the provided test helpers for common operations:

```typescript
import {
  createTestTenant,
  createTestUser,
  cleanupTestData,
  TEST_TENANT_ID,
  TEST_USER_ID,
  generateMockJWT,
} from "../utils/test-helpers.js";

describe("My Test Suite", () => {
  beforeAll(async () => {
    await createTestTenant();
    await createTestUser();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("should work with test data", async () => {
    // Your test here
  });
});
```

## CI/CD Testing

### GitHub Actions Workflows

We have three main workflows:

#### 1. CI Workflow (`.github/workflows/ci.yml`)

Runs on every push and pull request to `main` and `develop` branches.

**Jobs:**

- **Lint and Type Check**: Validates code style and TypeScript types
- **Test**: Runs all tests with PostgreSQL and Redis services
- **Build**: Builds all packages and apps
- **Security Audit**: Checks for security vulnerabilities

#### 2. Deploy to Staging (`.github/workflows/deploy-staging.yml`)

Runs on push to `develop` branch.

**Jobs:**

- Build and deploy to staging environment
- Run database migrations
- Deploy API and Web apps
- Run smoke tests against staging

#### 3. Deploy to Production (`.github/workflows/deploy-production.yml`)

Runs on push to `main` branch or version tags.

**Jobs:**

- Build and deploy to production environment
- Run database migrations
- Deploy API and Web apps
- Run smoke tests against production
- Create GitHub release (for tagged versions)

### Test Environment Variables

The CI pipeline uses the following environment variables:

```yaml
DATABASE_URL: postgresql://postgres:postgres@localhost:5432/csuite_test
REDIS_URL: redis://localhost:6379
MASTER_ENCRYPTION_KEY: test-master-encryption-key-32-bytes-long!!
CLERK_SECRET_KEY: test-clerk-secret-key
CLERK_PUBLISHABLE_KEY: test-clerk-publishable-key
NODE_ENV: test
```

### Local Testing with Docker

To run tests locally with the same environment as CI:

```bash
# Start PostgreSQL and Redis using Docker Compose
docker-compose -f docker-compose.dev.yml up -d postgres redis

# Run tests
pnpm test

# Stop services
docker-compose -f docker-compose.dev.yml down
```

## Test Coverage

### Viewing Coverage Reports

```bash
# Generate coverage report
pnpm test:coverage

# View HTML report
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
start coverage/index.html  # Windows
```

### Coverage Goals

- **Overall Coverage**: 70%+
- **Critical Paths**: 90%+
- **Utility Functions**: 80%+

Coverage reports are automatically generated in CI and uploaded to Codecov.

## Troubleshooting

### Common API Integration Failures

| Symptom                                                                | Likely Cause                                                                              | Fix                                                                                                                                          |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `400 TENANT_HEADER_REQUIRED`                                           | Request missing `X-Tenant-ID` header. Auth mock enforces the same contract as production. | Add the tenant header when calling API helpers in tests (see `TEST_TENANT_ID` or suite-specific IDs).                                        |
| `401 AUTH_REQUIRED`                                                    | Bearer token omitted. Our Clerk mock still requires `Authorization: Bearer …`.            | Generate a mock JWT via `generateMockJWT` and pass it in request headers.                                                                    |
| Chat SSE test hangs                                                    | Rate limiter not bypassed or Redis stub misconfigured.                                    | Ensure `NODE_ENV=test` and that `tests/setup.ts` is loaded via `vitest.config.ts`; the setup swaps in a no-op limiter and Redis script shim. |
| Google Analytics test hits unique constraint on `(tenantId, provider)` | Suite reuses tenant data from another run.                                                | Use the dedicated `GA_TEST_TENANT_ID` (already provided) or run `cleanupTestData(GA_TEST_TENANT_ID)` before reseeding.                       |
| Notifications tests return 400                                         | Missing `X-Tenant-ID` header or using shared Clerk ID that conflicts with other suites.   | Set both the Bearer token and tenant header; the tests use `notifications-user-…` to stay isolated.                                          |

### Database Connection Issues

If tests fail with database connection errors:

1. Ensure PostgreSQL is running:

   ```bash
   docker-compose -f docker-compose.dev.yml up -d postgres
   ```

2. Check the DATABASE_URL is correct:

   ```bash
   echo $DATABASE_URL
   ```

3. Run migrations:
   ```bash
   pnpm db:push
   ```

### Redis Connection Issues

If tests fail with Redis connection errors:

1. Ensure Redis is running:

   ```bash
   docker-compose -f docker-compose.dev.yml up -d redis
   ```

2. Check the REDIS_URL is correct:
   ```bash
   echo $REDIS_URL
   ```

### Clerk Authentication Issues

The tests use mocked Clerk authentication. If you see auth errors:

1. Check that `tests/setup.ts` is properly mocking the auth middleware
2. Ensure test files import from the correct paths

### Test Timeouts

If tests timeout, you can increase the timeout:

```typescript
// In vitest.config.ts
export default defineConfig({
  test: {
    testTimeout: 30000, // 30 seconds
  },
});

// Or for individual tests
it(
  "slow test",
  async () => {
    // test code
  },
  { timeout: 60000 }
); // 60 seconds
```

### Cleaning Up Test Data

If tests leave behind test data:

```typescript
import { cleanupTestData } from "./utils/test-helpers.js";

afterAll(async () => {
  await cleanupTestData();
});
```

## Best Practices

1. **Isolate Tests**: Each test should be independent and not rely on other tests
2. **Clean Up**: Always clean up test data in `afterAll` or `afterEach` hooks
3. **Mock External Services**: Use mocks for external APIs, auth services, etc.
4. **Use Descriptive Names**: Test names should clearly describe what they test
5. **Test Edge Cases**: Don't just test happy paths
6. **Keep Tests Fast**: Aim for tests to run in < 1 second each
7. **Use Test Helpers**: Reuse common setup code with test helpers
8. **Don't Test Implementation Details**: Test behavior, not internal implementation

## Adding New Tests

When adding new features, follow this checklist:

- [ ] Add unit tests for new functions/modules
- [ ] Add integration tests for new API endpoints
- [ ] Update smoke tests if critical user journeys changed
- [ ] Ensure tests pass locally: `pnpm test`
- [ ] Check test coverage: `pnpm test:coverage`
- [ ] Update this documentation if needed

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Supertest Documentation](https://github.com/ladjs/supertest)
- [Testing Library](https://testing-library.com/)
- [Test-Driven Development (TDD)](https://martinfowler.com/bliki/TestDrivenDevelopment.html)
