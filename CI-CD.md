# CI/CD Pipeline Documentation

This document describes the Continuous Integration and Continuous Deployment (CI/CD) setup for the OC-Suite platform.

## Table of Contents

- [Overview](#overview)
- [Workflows](#workflows)
- [Environment Setup](#environment-setup)
- [Deployment Guide](#deployment-guide)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Overview

The OC-Suite platform uses **GitHub Actions** for automated CI/CD. We have three main workflows:

1. **CI Pipeline**: Runs on every push and pull request
2. **Staging Deployment**: Deploys to staging on push to `develop` branch
3. **Production Deployment**: Deploys to production on push to `main` branch or version tags

## Workflows

### 1. CI Workflow

**File**: `.github/workflows/ci.yml`

**Triggers**:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

**Jobs**:

#### Lint and Type Check
- Sets up Node.js 20 and pnpm
- Installs dependencies with caching
- Runs ESLint across all packages
- Runs TypeScript type checking

#### Test
- Starts PostgreSQL (with pgvector) and Redis services
- Installs dependencies
- Generates Prisma client
- Runs database migrations
- Executes all tests with coverage
- Uploads coverage reports to Codecov

#### Build
- Builds all packages and applications
- Archives production artifacts (`.next` and `dist` folders)
- Uploads artifacts for later deployment

#### Security Audit
- Runs `pnpm audit` to check for security vulnerabilities
- Continues on error (doesn't fail the build)

**Status Badge**:
```markdown
![CI](https://github.com/your-org/csuite-pivot/workflows/CI/badge.svg)
```

### 2. Staging Deployment Workflow

**File**: `.github/workflows/deploy-staging.yml`

**Triggers**:
- Push to `develop` branch
- Manual trigger via workflow_dispatch

**Environment**: staging
**URL**: https://staging.ocsuite.app

**Jobs**:

#### Deploy
- Builds all packages and apps
- Runs database migrations on staging database
- Deploys API service
- Deploys Web app
- Runs smoke tests against staging
- Sends deployment notifications

**Required Secrets**:
- `STAGING_DATABASE_URL`: Staging database connection string
- Platform-specific tokens (Railway, Vercel, Fly.io, etc.)

### 3. Production Deployment Workflow

**File**: `.github/workflows/deploy-production.yml`

**Triggers**:
- Push to `main` branch
- Push of version tags (e.g., `v1.0.0`)
- Manual trigger via workflow_dispatch

**Environment**: production
**URL**: https://ocsuite.app

**Jobs**:

#### Deploy
- Builds all packages and apps
- Runs database migrations on production database
- Deploys API service
- Deploys Web app
- Runs smoke tests against production
- Creates GitHub release (for tagged versions)
- Sends deployment notifications

**Required Secrets**:
- `PRODUCTION_DATABASE_URL`: Production database connection string
- Platform-specific tokens

## Environment Setup

### GitHub Secrets

Configure the following secrets in your GitHub repository settings:

#### Database
- `STAGING_DATABASE_URL`: PostgreSQL connection string for staging
- `PRODUCTION_DATABASE_URL`: PostgreSQL connection string for production

#### Hosting Platforms

**Option A: Railway**
- `RAILWAY_TOKEN`: Railway API token

**Option B: Vercel + Fly.io**
- `VERCEL_TOKEN`: Vercel deployment token
- `VERCEL_ORG_ID`: Vercel organization ID
- `VERCEL_PROJECT_ID`: Vercel project ID
- `FLY_API_TOKEN`: Fly.io API token

**Option C: AWS**
- `AWS_ACCESS_KEY_ID`: AWS access key
- `AWS_SECRET_ACCESS_KEY`: AWS secret key
- `AWS_REGION`: AWS region (e.g., `us-east-1`)

#### Notifications
- `SLACK_WEBHOOK_URL`: Slack webhook for notifications (optional)
- `DISCORD_WEBHOOK_URL`: Discord webhook for notifications (optional)

### GitHub Environments

Create two environments in GitHub repository settings:

#### Staging Environment
- **Name**: `staging`
- **URL**: `https://staging.ocsuite.app`
- **Protection Rules**: None (auto-deploy on push to `develop`)

#### Production Environment
- **Name**: `production`
- **URL**: `https://ocsuite.app`
- **Protection Rules**:
  - Required reviewers: 1+
  - Wait timer: 0 minutes (or set a delay)
  - Deployment branches: `main` only

## Deployment Guide

### Setting Up Deployment (Initial Setup)

The deployment workflows currently contain placeholder commands. You need to configure them based on your hosting platform.

#### Option 1: Railway

Railway is a simple PaaS that works great for full-stack apps.

1. **Install Railway CLI**:
   ```bash
   npm install -g @railway/cli
   ```

2. **Create Railway projects**:
   ```bash
   railway login
   railway init  # Create project for API
   railway init  # Create project for Web
   ```

3. **Update workflow files**:
   ```yaml
   - name: Deploy API
     run: railway up --service api
     env:
       RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
   ```

4. **Configure environment variables in Railway dashboard**

#### Option 2: Vercel (Web) + Fly.io (API)

Vercel is excellent for Next.js apps, Fly.io for Node.js APIs.

**For Web (Vercel)**:

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Link project**:
   ```bash
   cd apps/web
   vercel link
   ```

3. **Update workflow**:
   ```yaml
   - name: Deploy Web
     run: vercel --prod
     working-directory: apps/web
     env:
       VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
       VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
       VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
   ```

**For API (Fly.io)**:

1. **Install Fly CLI**:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Create Fly app**:
   ```bash
   cd apps/api
   fly launch --no-deploy
   ```

3. **Update workflow**:
   ```yaml
   - name: Deploy API
     run: fly deploy --remote-only
     working-directory: apps/api
     env:
       FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
   ```

#### Option 3: Docker + AWS ECS/Kubernetes

For more control, use Docker containers.

1. **Create Dockerfiles** (see examples below)

2. **Build and push to registry**:
   ```yaml
   - name: Build and push Docker image
     uses: docker/build-push-action@v5
     with:
       context: apps/api
       push: true
       tags: ${{ secrets.ECR_REGISTRY }}/api:${{ github.sha }}
   ```

3. **Deploy to ECS/EKS**:
   ```yaml
   - name: Deploy to ECS
     uses: aws-actions/amazon-ecs-deploy-task-definition@v1
     with:
       task-definition: task-definition.json
       service: api-service
       cluster: production-cluster
   ```

### Example Dockerfiles

**API Dockerfile** (`apps/api/Dockerfile`):
```dockerfile
FROM node:20-alpine AS base

# Install pnpm
RUN npm install -g pnpm@8

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/*/package.json ./packages/*/

# Install dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy source code
COPY apps/api ./apps/api
COPY packages ./packages

# Build
RUN pnpm --filter api build

# Production image
FROM node:20-alpine
WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/apps/api/dist ./apps/api/dist
COPY --from=base /app/packages ./packages

EXPOSE 3001

CMD ["node", "apps/api/dist/index.js"]
```

**Web Dockerfile** (`apps/web/Dockerfile`):
```dockerfile
FROM node:20-alpine AS base

RUN npm install -g pnpm@8

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/*/package.json ./packages/*/

RUN pnpm install --frozen-lockfile

COPY apps/web ./apps/web
COPY packages ./packages

RUN pnpm --filter web build

FROM node:20-alpine
WORKDIR /app

COPY --from=base /app/apps/web/.next ./apps/web/.next
COPY --from=base /app/apps/web/public ./apps/web/public
COPY --from=base /app/apps/web/package.json ./apps/web/
COPY --from=base /app/node_modules ./node_modules

EXPOSE 3000

CMD ["pnpm", "--filter", "web", "start"]
```

### Manual Deployment

To deploy manually without CI/CD:

```bash
# Build everything
pnpm build

# Deploy API (example with Railway)
cd apps/api
railway up

# Deploy Web (example with Vercel)
cd apps/web
vercel --prod
```

## Monitoring

### Deployment Status

Monitor deployments in GitHub Actions:
- Go to: `https://github.com/your-org/csuite-pivot/actions`
- View workflow runs and logs

### Application Monitoring

After deployment, monitor:

1. **Application Health**:
   ```bash
   curl https://api.ocsuite.app/health
   ```

2. **Logs**:
   - Railway: `railway logs`
   - Fly.io: `fly logs`
   - Vercel: Vercel dashboard
   - AWS: CloudWatch

3. **Database**:
   - Connection pool metrics
   - Query performance
   - Storage usage

4. **Redis**:
   - Memory usage
   - Connection count
   - Queue depths

### Setting Up Alerts

**Uptime Monitoring**:
- Use: UptimeRobot, Pingdom, or Better Uptime
- Monitor: `/health` endpoint
- Alert on: Downtime > 2 minutes

**Error Tracking**:
- Use: Sentry, Rollbar, or Bugsnag
- Track: Application errors, performance issues
- Alert on: Error rate spikes

**Performance Monitoring**:
- Use: New Relic, DataDog, or Prometheus
- Monitor: Response times, throughput, resource usage
- Alert on: Slow queries, high CPU/memory

## Troubleshooting

### Build Failures

**Symptom**: CI build fails

**Common Causes**:
1. TypeScript errors
2. Linting errors
3. Dependency issues

**Solutions**:
```bash
# Fix TypeScript errors
pnpm typecheck

# Fix linting errors
pnpm lint:fix

# Update dependencies
pnpm install
```

### Test Failures

**Symptom**: Tests fail in CI but pass locally

**Common Causes**:
1. Database connection issues
2. Missing environment variables
3. Race conditions

**Solutions**:
1. Check database service is running in CI
2. Verify all env vars are set in workflow
3. Increase test timeouts if needed

### Deployment Failures

**Symptom**: Deployment job fails

**Common Causes**:
1. Missing secrets
2. Database migration errors
3. Build artifacts missing

**Solutions**:
1. Verify all secrets are set in GitHub
2. Test migrations locally first
3. Check that build job completed successfully

### Database Migration Issues

**Symptom**: Migration fails during deployment

**Solutions**:

1. **Rollback migration**:
   ```bash
   # SSH into server or use Railway/Fly.io console
   pnpm --filter @ocsuite/db db:reset
   ```

2. **Apply migrations manually**:
   ```bash
   DATABASE_URL=your-db-url pnpm --filter @ocsuite/db migrate
   ```

3. **Check migration status**:
   ```bash
   pnpm --filter @ocsuite/db prisma migrate status
   ```

### Rollback Deployment

If a deployment causes issues:

1. **Revert to previous version**:
   ```bash
   git revert <commit-hash>
   git push origin main
   ```

2. **Or redeploy previous version**:
   ```bash
   # Railway
   railway rollback

   # Vercel
   vercel rollback <deployment-url>

   # Fly.io
   fly releases list
   fly releases rollback <version>
   ```

## Best Practices

1. **Always test locally before pushing**
2. **Use feature branches and pull requests**
3. **Review deployment logs after each deployment**
4. **Run database migrations during low-traffic periods**
5. **Keep secrets secure and rotate regularly**
6. **Monitor application health after deployments**
7. **Have a rollback plan ready**
8. **Use staging environment for testing changes**

## Next Steps

- [ ] Configure hosting platform (Railway/Vercel/Fly.io/AWS)
- [ ] Set up GitHub secrets
- [ ] Create GitHub environments (staging, production)
- [ ] Update deployment workflows with actual commands
- [ ] Set up monitoring and alerting
- [ ] Configure custom domains
- [ ] Set up SSL certificates
- [ ] Test full deployment pipeline
