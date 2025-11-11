# Phase 2 Playbook - Complete Developer Guide

## Overview

Phase 2 of the csuite-pivot project transforms the platform from a mock-based prototype into a production-ready AI-powered strategic guidance platform. This playbook provides everything you need to get Phase 2 running locally and understand its new capabilities.

### What's New in Phase 2

Phase 2 introduces five major enhancements:

1. **Real LLM Integration** - Fireworks AI integration with Qwen 2.5 72B model for authentic C-suite persona conversations
2. **Growth Pulse Module** - Automated analytics insights with actionable recommendations
3. **Google Analytics Connector** - OAuth flow and automatic data synchronization
4. **Board Meeting Dashboard** - Aggregated insights, metrics, and action items across all modules
5. **Observability** - Health checks, metrics endpoints, and comprehensive logging

### Architecture Overview

```
Phase 2 Components:
├── LLM Services
│   ├── Fireworks client (streaming SSE)
│   ├── Prompt builder (context-aware)
│   └── Rate limiting (cost control)
├── Growth Pulse Module
│   ├── Analytics worker
│   ├── Insight generation
│   └── Action item tracking
├── Google Analytics Integration
│   ├── OAuth flow
│   ├── Token management
│   └── Data sync worker
├── Board Meeting Page
│   ├── Multi-module aggregation
│   ├── Risk identification
│   └── Executive summary
└── Observability
    ├── Health checks (DB, Redis, Queues)
    ├── Metrics collection
    └── Structured logging
```

## Prerequisites

Before setting up Phase 2 locally, ensure you have:

### Required Software

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0
- **Docker** and **Docker Compose** (for PostgreSQL and Redis)
- **Git** (for version control)

### Required Accounts

1. **Fireworks AI Account**
   - Sign up at https://fireworks.ai/
   - Create an API key
   - Required for: Real LLM conversations

2. **Clerk Account**
   - Sign up at https://clerk.com/
   - Create a new application
   - Required for: User authentication

3. **Google Cloud Platform Account** (Optional for Analytics)
   - Create a project at https://console.cloud.google.com/
   - Enable Google Analytics API
   - Create OAuth 2.0 credentials
   - Required for: Google Analytics integration

### Hardware Requirements

- **Minimum**: 8GB RAM, 2 CPU cores, 10GB disk space
- **Recommended**: 16GB RAM, 4 CPU cores, 20GB disk space

## Environment Setup

### Step 1: Clone and Install Dependencies

```bash
# Navigate to project directory
cd "D:\projects\Lead gen app\csuite-pivot"

# Install all dependencies
pnpm install
```

### Step 2: Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```bash
# ============================================================================
# DATABASE
# ============================================================================
DATABASE_URL=postgresql://user:password@localhost:5432/ocsuite_dev?schema=public

# ============================================================================
# REDIS
# ============================================================================
REDIS_URL=redis://localhost:6379

# ============================================================================
# CLERK AUTHENTICATION (Phase 1)
# ============================================================================
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# ============================================================================
# FIREWORKS AI - LLM INTEGRATION (Phase 2 - REQUIRED)
# ============================================================================
# Get your API key from https://fireworks.ai/
FIREWORKS_API_KEY=fw_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional: Customize model and parameters (defaults shown)
FIREWORKS_MODEL=accounts/fireworks/models/qwen2p5-72b-instruct
FIREWORKS_BASE_URL=https://api.fireworks.ai/inference/v1
FIREWORKS_MAX_TOKENS=2048
FIREWORKS_TEMPERATURE=0.7

# ============================================================================
# GOOGLE OAUTH - ANALYTICS CONNECTOR (Phase 2 - Optional)
# ============================================================================
# Get credentials from https://console.cloud.google.com/
GOOGLE_CLIENT_ID=xxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=http://localhost:3001/connectors/google/callback

# ============================================================================
# ENCRYPTION (Phase 1)
# ============================================================================
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
MASTER_ENCRYPTION_KEY=your-base64-encoded-32-byte-key-here

# ============================================================================
# API CONFIGURATION
# ============================================================================
API_PORT=3001
API_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001

# ============================================================================
# ENVIRONMENT
# ============================================================================
NODE_ENV=development
```

### Environment Variables Explained

#### Fireworks AI Configuration

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `FIREWORKS_API_KEY` | Yes | API key from Fireworks AI console | - |
| `FIREWORKS_MODEL` | No | LLM model to use | `accounts/fireworks/models/qwen2p5-72b-instruct` |
| `FIREWORKS_MAX_TOKENS` | No | Maximum response length | `2048` |
| `FIREWORKS_TEMPERATURE` | No | Response randomness (0-1) | `0.7` |

**Getting a Fireworks API Key:**
1. Sign up at https://fireworks.ai/
2. Navigate to API Keys section
3. Create a new API key
4. Copy the key (starts with `fw_`)

#### Google OAuth Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLIENT_ID` | For Analytics | OAuth 2.0 client ID |
| `GOOGLE_CLIENT_SECRET` | For Analytics | OAuth 2.0 client secret |
| `GOOGLE_REDIRECT_URI` | For Analytics | OAuth callback URL |

**Setting up Google OAuth:**
1. Go to https://console.cloud.google.com/
2. Create a new project or select existing
3. Enable Google Analytics API
4. Go to Credentials > Create Credentials > OAuth 2.0 Client ID
5. Set authorized redirect URI: `http://localhost:3001/connectors/google/callback`
6. Copy Client ID and Client Secret

#### Encryption Key Generation

Generate a secure encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

This key is used to encrypt sensitive data like OAuth tokens.

### Step 3: Start Infrastructure Services

Start PostgreSQL and Redis using Docker Compose:

```bash
# Start services in detached mode
docker compose -f docker-compose.dev.yml up -d

# Check services are running
docker compose -f docker-compose.dev.yml ps

# View logs if needed
docker compose -f docker-compose.dev.yml logs -f
```

Verify services are accessible:

```bash
# Test PostgreSQL connection
psql $DATABASE_URL -c "SELECT 1"

# Test Redis connection
redis-cli -u $REDIS_URL ping
```

## Step-by-Step Local Setup

### 1. Database Setup

#### Run Migrations

```bash
# Generate Prisma client
pnpm db:generate

# Push schema to database (development)
pnpm db:push

# Or run migrations (production-like)
pnpm db:migrate
```

#### Verify Database Schema

```bash
# Open Prisma Studio to view database
pnpm db:studio
```

You should see these tables:
- `tenants` - Tenant organizations
- `users` - User accounts
- `tenant_members` - User-tenant relationships
- `conversations` - Chat conversations
- `messages` - Chat messages
- `connectors` - OAuth connectors
- `tasks` - Background tasks
- `module_insights` - Growth Pulse insights
- `analytics_snapshots` - Analytics data
- `business_profiles` - Business information
- `knowledge_entries` - Knowledge base

### 2. Seed Demo Data (Optional)

Create sample data for testing:

```bash
# Run seed script (if available)
pnpm --filter @ocsuite/db seed

# Or manually create via API after starting services
```

### 3. Build Packages

Build all workspace packages:

```bash
# Build all packages
pnpm build:packages

# Or build individually
pnpm --filter @ocsuite/types build
pnpm --filter @ocsuite/db build
pnpm --filter @ocsuite/crypto build
pnpm --filter @ocsuite/module-sdk build
```

### 4. Start Development Servers

You'll need 3 terminal windows:

#### Terminal 1: API Server

```bash
pnpm dev:api
```

Expected output:
```
[api] Server started on http://localhost:3001
[api] Health check: http://localhost:3001/health
[api] Metrics: http://localhost:3001/metrics
```

#### Terminal 2: Background Workers

```bash
pnpm dev:workers
```

Expected output:
```
[workers] Growth Pulse worker started
[workers] Analytics sync worker started
[workers] Connector sync worker started
[workers] Task execution worker started
```

#### Terminal 3: Web Application

```bash
pnpm dev:web
```

Expected output:
```
[web] Ready on http://localhost:3000
```

### 5. Verify Installation

Open your browser and check:

1. **Web App**: http://localhost:3000
2. **API Health**: http://localhost:3001/health
3. **API Detailed Health**: http://localhost:3001/health/detailed
4. **Queue Health**: http://localhost:3001/health/queues
5. **Metrics**: http://localhost:3001/metrics

All health checks should return `status: "healthy"`.

## Feature Walkthrough

### 1. User Onboarding

#### Sign Up Flow

1. Navigate to http://localhost:3000
2. Click "Sign Up"
3. Complete Clerk registration
4. You'll be redirected to `/onboarding`

#### Complete Business Profile

Fill out the onboarding form with your business information:

- **Company Name**: Your business name
- **Industry**: Select from dropdown
- **Business Stage**: startup, growth, mature, enterprise
- **Company Size**: 1-10, 11-50, 51-200, 201-500, 500+
- **Annual Revenue**: Revenue range
- **Goals**: Primary business objectives

This profile data is used to contextualize AI responses.

### 2. Testing Chat with Real LLM

#### Start a Conversation

1. Navigate to **Dashboard** after onboarding
2. Click on **C-Suite Chat** or **CEO Chat**
3. Type a message: "What should I focus on this quarter?"
4. Watch real-time streaming response from Fireworks AI

#### What's Happening Behind the Scenes

When you send a chat message:

1. **Authentication**: Clerk verifies your session
2. **Tenant Resolution**: System identifies your tenant
3. **Rate Limiting**: Check you haven't exceeded 10 messages/minute
4. **Context Fetching**:
   - Business profile
   - Recent analytics data
   - Module insights
   - Conversation history (last 5 exchanges)
5. **Prompt Building**: Persona-specific system prompt + context
6. **LLM Streaming**: Real-time response from Fireworks
7. **Token Tracking**: Usage logged for cost monitoring
8. **Message Storage**: Conversation saved to database

#### Test Different Personas

Try different C-suite executives:

- **CEO** (Chief Executive Officer): Strategic vision, growth, market positioning
- **CFO** (Chief Financial Officer): Financial planning, budgeting, cash flow
- **CMO** (Chief Marketing Officer): Marketing strategy, customer acquisition, branding
- **CTO** (Chief Technology Officer): Technical architecture, innovation, scalability

Each persona has specialized knowledge and response style.

#### Verify Token Tracking

Check the browser developer console for SSE events:

```javascript
event: start
data: {"conversationId":"clp123abc","personaType":"ceo"}

event: chunk
data: {"content":"Based on ","conversationId":"clp123abc"}

event: chunk
data: {"content":"your analytics, ","conversationId":"clp123abc"}

event: done
data: {"conversationId":"clp123abc"}
```

Messages are stored with token metadata in the database.

### 3. Triggering Growth Pulse Analysis

Growth Pulse analyzes your analytics data and generates insights.

#### Manual Trigger

1. Navigate to **Modules** or **Growth Pulse**
2. Click **Run Analysis**
3. Optionally specify date range
4. Analysis job is queued

#### API Trigger

```bash
curl -X POST http://localhost:3001/modules/growth-pulse/run \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dateRange": "last_30_days"}'
```

Response:
```json
{
  "success": true,
  "data": {
    "jobId": "123",
    "status": "queued",
    "message": "Growth Pulse analysis started"
  }
}
```

#### Check Job Status

```bash
curl http://localhost:3001/modules/growth-pulse/job/123 \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
```

Response:
```json
{
  "success": true,
  "data": {
    "jobId": "123",
    "state": "completed",
    "progress": 100,
    "returnvalue": {
      "insightId": "clp456def"
    }
  }
}
```

### 4. Viewing Module Insights

#### List All Insights

Navigate to **Dashboard** > **Insights** to see:

- **Insight Summary**: Key finding
- **Severity**: info, warning, critical
- **Module**: Source module (growth-pulse, etc.)
- **Action Items**: Recommended next steps
- **Created At**: Timestamp

#### API: Fetch Insights

```bash
# All insights
curl http://localhost:3001/modules/insights \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"

# Growth Pulse only
curl http://localhost:3001/modules/growth-pulse/insights \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"

# Specific insight
curl http://localhost:3001/modules/growth-pulse/insights/INSIGHT_ID \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
```

#### Insight Structure

```json
{
  "id": "clp456def",
  "tenantId": "tenant123",
  "moduleSlug": "growth-pulse",
  "summary": "User growth accelerating - conversion rate up 15%",
  "severity": "info",
  "actionItems": [
    {
      "title": "Increase ad spend to capitalize on trend",
      "priority": "high",
      "estimatedImpact": "20% revenue increase"
    }
  ],
  "metadata": {
    "metrics": {
      "conversionRate": 0.15,
      "changePercent": 15
    }
  },
  "createdAt": "2025-11-01T10:30:00Z"
}
```

### 5. Accessing Board Meeting Page

The Board Meeting page aggregates data across all modules.

#### Navigate to Board Meeting

1. Go to **Dashboard** > **Board Meeting**
2. Click **Generate Report**

#### What's Included

The board meeting report contains:

1. **Executive Summary**
   - Total insights generated
   - Tasks completed
   - Integration health

2. **Growth & Revenue**
   - Growth Pulse insights
   - Revenue trends
   - Key metrics

3. **Recent Discussions**
   - Latest C-suite chat excerpts
   - Strategic conversations

4. **Action Items**
   - Prioritized recommendations
   - Estimated impact
   - Responsible parties

5. **Risks**
   - Critical/warning severity insights
   - Risk mitigation steps

6. **Metrics**
   - Sessions, users, conversions
   - Revenue, growth rates

#### API: Generate Board Meeting

```bash
curl -X POST http://localhost:3001/board-meeting \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
```

Response:
```json
{
  "success": true,
  "data": {
    "generatedAt": "2025-11-01T12:00:00Z",
    "agenda": [...],
    "risks": [...],
    "metrics": {...},
    "decisions": [],
    "followUps": [...]
  }
}
```

### 6. Testing Google Analytics OAuth

#### Prerequisites

- Google Analytics account
- OAuth credentials configured
- Analytics property with data

#### OAuth Flow

1. Navigate to **Connectors** page
2. Click **Connect Google Analytics**
3. You'll be redirected to Google OAuth consent screen
4. Approve requested permissions
5. Redirected back to app with OAuth code
6. Backend exchanges code for tokens
7. Tokens encrypted and stored
8. Connector status: **Active**

#### API Flow

```bash
# Step 1: Initiate OAuth
curl -X POST http://localhost:3001/connectors/google/authorize \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"

# Response contains authorization URL
{
  "authorizationUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
}

# Step 2: User completes OAuth in browser

# Step 3: Callback handles token exchange automatically
# GET /connectors/google/callback?code=xxx&state=xxx

# Step 4: Verify connector
curl http://localhost:3001/connectors \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
```

#### Trigger Analytics Sync

Once connected, sync analytics data:

```bash
# Manual sync trigger (if implemented)
curl -X POST http://localhost:3001/connectors/google/sync \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
```

Or wait for automatic background sync (runs on schedule).

#### View Synced Analytics

```bash
# Check latest analytics snapshot
curl http://localhost:3001/analytics/latest \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Fireworks API Errors

**Problem**: `Error: Fireworks API key not configured`

**Solution**:
```bash
# Verify environment variable is set
echo $FIREWORKS_API_KEY

# Should start with 'fw_'
# If empty, add to .env file and restart API server
```

**Problem**: `Error: 401 Unauthorized from Fireworks`

**Solution**:
- API key is invalid or expired
- Generate new key at https://fireworks.ai/
- Update `FIREWORKS_API_KEY` in `.env`
- Restart API server

**Problem**: `Error: 429 Too Many Requests`

**Solution**:
- Rate limit exceeded on Fireworks side
- Wait a few minutes
- Or upgrade Fireworks plan
- Check usage at https://fireworks.ai/dashboard

#### 2. Google OAuth Setup

**Problem**: `Redirect URI mismatch`

**Solution**:
```bash
# Ensure redirect URI in Google Cloud Console matches exactly:
http://localhost:3001/connectors/google/callback

# Check .env file:
GOOGLE_REDIRECT_URI=http://localhost:3001/connectors/google/callback
```

**Problem**: `Error: invalid_client`

**Solution**:
- Client ID or secret is incorrect
- Verify credentials in Google Cloud Console
- Update `.env` with correct values
- Restart API server

**Problem**: `OAuth consent screen not configured`

**Solution**:
1. Go to Google Cloud Console
2. Navigate to OAuth consent screen
3. Configure consent screen (internal or external)
4. Add necessary scopes
5. Retry OAuth flow

#### 3. LLM Streaming Issues

**Problem**: Chat response not streaming, receiving all at once

**Solution**:
- Check browser supports Server-Sent Events (SSE)
- Verify `Content-Type: text/event-stream` header
- Check for reverse proxy buffering issues
- Test with `curl`:

```bash
curl -N http://localhost:3001/c-suite/ceo/chat \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello"}'
```

**Problem**: `Error: Stream interrupted`

**Solution**:
- Network connection lost
- Fireworks API timeout
- Check API logs for details
- Frontend should implement reconnection logic

#### 4. Analytics Sync Failures

**Problem**: `Error: Failed to sync Google Analytics`

**Solution**:
- Check connector status: `GET /connectors`
- Verify OAuth token not expired (refresh if needed)
- Check Google Analytics API quota
- Verify Analytics property ID is correct
- Check worker logs for detailed error

**Problem**: No analytics data syncing

**Solution**:
```bash
# Check worker is running
pnpm dev:workers

# Check queue health
curl http://localhost:3001/health/queues

# Manually trigger sync
# (implementation-specific)
```

#### 5. Queue Worker Problems

**Problem**: Workers not processing jobs

**Solution**:
```bash
# Check Redis connection
redis-cli -u $REDIS_URL ping

# Check worker processes
pnpm dev:workers

# View queue status
curl http://localhost:3001/health/queues
```

**Problem**: Jobs stuck in queue

**Solution**:
```bash
# Check job status
curl http://localhost:3001/modules/growth-pulse/job/JOB_ID

# Restart workers
# Ctrl+C in workers terminal, then:
pnpm dev:workers
```

#### 6. Database Connection Issues

**Problem**: `Error: Can't reach database server`

**Solution**:
```bash
# Check PostgreSQL is running
docker compose -f docker-compose.dev.yml ps

# Check DATABASE_URL is correct
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Restart PostgreSQL if needed
docker compose -f docker-compose.dev.yml restart postgres
```

**Problem**: `Error: Tenant not found`

**Solution**:
- User hasn't completed onboarding
- Tenant record missing in database
- Check `tenants` and `tenant_members` tables
- Complete onboarding flow

#### 7. Rate Limiting Issues

**Problem**: `Error: 429 Too Many Requests`

**Solution**:
```bash
# Default limits:
# - Chat: 10 requests/minute
# - API: 100 requests/15 minutes

# Wait for rate limit window to reset
# Or adjust limits in apps/api/src/middleware/rate-limit.ts

# Check when limit resets (see Retry-After header)
```

#### 8. Build Errors

**Problem**: `Error: Cannot find module '@ocsuite/db'`

**Solution**:
```bash
# Build packages first
pnpm build:packages

# Then build apps
pnpm build:apps
```

**Problem**: TypeScript errors after pulling changes

**Solution**:
```bash
# Clean and rebuild
pnpm clean
pnpm install
pnpm build

# Regenerate Prisma client
pnpm db:generate
```

### Debug Logging

Enable detailed logging:

```bash
# Set log level in .env
LOG_LEVEL=debug

# Or use pino-pretty for readable logs
NODE_ENV=development pnpm dev:api
```

View structured logs:

```bash
# API logs show:
# - Request IDs
# - Tenant IDs
# - User IDs
# - Error stacks
# - Performance metrics
```

### Health Checks

Verify system health:

```bash
# Basic health
curl http://localhost:3001/health

# Detailed health (DB, Redis, Queues)
curl http://localhost:3001/health/detailed

# Queue-specific health
curl http://localhost:3001/health/queues

# Metrics
curl http://localhost:3001/metrics
```

## Development Tips

### Hot Reload

All services support hot reload:
- **API**: Automatically reloads on file changes
- **Web**: Next.js Fast Refresh
- **Workers**: Restart required for changes

### Testing Changes

```bash
# Run all tests
pnpm test

# Run specific package tests
pnpm --filter api test

# Watch mode
pnpm --filter api test:watch

# Coverage
pnpm test:coverage
```

### Debugging

#### VS Code Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug API",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["--filter", "api", "dev"],
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

#### Chrome DevTools

Debug Node.js with Chrome:

```bash
node --inspect-brk apps/api/dist/index.js
```

Open `chrome://inspect` and attach debugger.

### Database Inspection

```bash
# Open Prisma Studio
pnpm db:studio

# Direct SQL queries
psql $DATABASE_URL

# View specific tables
psql $DATABASE_URL -c "SELECT * FROM tenants;"
psql $DATABASE_URL -c "SELECT * FROM module_insights ORDER BY created_at DESC LIMIT 10;"
```

### Redis Inspection

```bash
# Connect to Redis
redis-cli -u $REDIS_URL

# View all keys
KEYS *

# Check queue jobs
# Bull/BullMQ stores jobs as hashes
HGETALL bull:growth-pulse:123

# Monitor commands in real-time
MONITOR
```

## Performance Optimization

### Response Time Goals

- **API Health Check**: < 50ms
- **Chat Message (first token)**: < 2 seconds
- **Chat Message (complete)**: < 10 seconds
- **Analytics Sync**: < 30 seconds
- **Growth Pulse Analysis**: < 2 minutes

### Monitoring

Track these metrics:

1. **Token Usage**
   - Input tokens per message
   - Output tokens per message
   - Cost per conversation

2. **API Performance**
   - Request duration (p50, p95, p99)
   - Error rate
   - Rate limit hits

3. **Queue Performance**
   - Job processing time
   - Queue depth
   - Failed jobs

4. **Database Performance**
   - Query duration
   - Connection pool usage
   - Slow queries

## Security Checklist

- [ ] All environment variables in `.env`, not committed to git
- [ ] `MASTER_ENCRYPTION_KEY` is 32+ bytes, base64-encoded
- [ ] Fireworks API key kept secret
- [ ] Google OAuth secrets not exposed
- [ ] Database uses strong password
- [ ] Redis not exposed to public internet
- [ ] Clerk webhooks use signing secret (production)
- [ ] Rate limiting enabled
- [ ] CORS configured properly
- [ ] Input validation on all endpoints

## Next Steps

After getting Phase 2 running:

1. **Explore Features**
   - Try all personas (CEO, CFO, CMO, CTO)
   - Generate Growth Pulse insights
   - Connect Google Analytics
   - View Board Meeting report

2. **Customize**
   - Adjust persona system prompts
   - Modify rate limits
   - Add custom modules
   - Extend analytics

3. **Deploy**
   - See [DEPLOYMENT-CHECKLIST.md](../DEPLOYMENT-CHECKLIST.md)
   - Configure production environment
   - Set up monitoring
   - Enable backups

4. **Contribute**
   - See [CONTRIBUTING.md](../CONTRIBUTING.md)
   - Follow coding standards
   - Write tests
   - Update documentation

## Resources

### Documentation

- [Quick Start Guide](../QUICK-START-LLM.md) - 5-minute setup
- [API Reference](./API-REFERENCE-PHASE2.md) - Endpoint documentation
- [Testing Guide](../TESTING.md) - Test strategies
- [CI/CD Guide](../CI-CD.md) - Deployment pipeline

### External Resources

- [Fireworks AI Documentation](https://docs.fireworks.ai/)
- [Qwen 2.5 Model](https://huggingface.co/Qwen/Qwen2.5-72B-Instruct)
- [Clerk Documentation](https://clerk.com/docs)
- [Google Analytics API](https://developers.google.com/analytics)
- [Prisma Documentation](https://www.prisma.io/docs)
- [BullMQ Documentation](https://docs.bullmq.io/)

### Support

- **Issues**: Create GitHub issue
- **Questions**: Check existing documentation
- **Contributing**: See CONTRIBUTING.md
- **Updates**: Follow changelog

## Appendix

### Environment Variable Reference

Complete list of all environment variables:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ocsuite_dev?schema=public

# Redis
REDIS_URL=redis://localhost:6379

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# Fireworks AI
FIREWORKS_API_KEY=fw_...
FIREWORKS_MODEL=accounts/fireworks/models/qwen2p5-72b-instruct
FIREWORKS_BASE_URL=https://api.fireworks.ai/inference/v1
FIREWORKS_MAX_TOKENS=2048
FIREWORKS_TEMPERATURE=0.7

# Google OAuth
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_REDIRECT_URI=http://localhost:3001/connectors/google/callback

# Encryption
MASTER_ENCRYPTION_KEY=base64_encoded_32_byte_key

# API
API_PORT=3001
API_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001

# Environment
NODE_ENV=development
LOG_LEVEL=info
```

### Common Commands Reference

```bash
# Development
pnpm dev                    # Start all services
pnpm dev:api               # Start API only
pnpm dev:web               # Start web only
pnpm dev:workers           # Start workers only

# Database
pnpm db:generate           # Generate Prisma client
pnpm db:push               # Push schema (dev)
pnpm db:migrate            # Run migrations
pnpm db:studio             # Open Prisma Studio
pnpm db:reset              # Reset database

# Building
pnpm build                 # Build all
pnpm build:packages        # Build packages only
pnpm build:apps            # Build apps only

# Testing
pnpm test                  # Run all tests
pnpm test:watch            # Watch mode
pnpm test:coverage         # With coverage
pnpm test:integration      # Integration tests

# Code Quality
pnpm lint                  # Lint all
pnpm lint:fix              # Auto-fix
pnpm typecheck             # Type check
pnpm format                # Format with Prettier
pnpm format:check          # Check formatting

# Cleanup
pnpm clean                 # Remove build artifacts
```

### Port Reference

| Service | Port | URL |
|---------|------|-----|
| Web App | 3000 | http://localhost:3000 |
| API Server | 3001 | http://localhost:3001 |
| PostgreSQL | 5432 | localhost:5432 |
| Redis | 6379 | localhost:6379 |

### File Structure

```
csuite-pivot/
├── apps/
│   ├── api/                 # Express API server
│   │   ├── src/
│   │   │   ├── routes/      # API endpoints
│   │   │   ├── services/    # Business logic
│   │   │   │   └── llm/     # LLM integration
│   │   │   ├── workers/     # Background jobs
│   │   │   │   └── modules/ # Module workers
│   │   │   ├── middleware/  # Express middleware
│   │   │   ├── queue/       # Queue management
│   │   │   ├── config/      # Configuration
│   │   │   └── utils/       # Utilities
│   │   └── tests/           # API tests
│   └── web/                 # Next.js frontend
│       ├── src/
│       │   ├── app/         # App Router pages
│       │   ├── components/  # React components
│       │   └── lib/         # Utilities
│       └── public/          # Static assets
├── packages/
│   ├── db/                  # Prisma database client
│   ├── types/               # Shared TypeScript types
│   ├── crypto/              # Encryption utilities
│   └── module-sdk/          # Module contracts
├── docs/                    # Documentation
└── .env                     # Environment variables
```

---

**Last Updated**: November 1, 2025
**Phase**: Phase 2
**Status**: Complete
