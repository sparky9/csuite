# Phase 2 Quick Start (5 Minutes)

Get Phase 2 of csuite-pivot running locally in 5 minutes or less.

## Prerequisites

- Node.js 18+, pnpm 8+, Docker
- Fireworks AI API key ([sign up here](https://fireworks.ai/))
- Clerk account ([sign up here](https://clerk.com/))

## 1. Environment Setup (1 minute)

```bash
# Navigate to project
cd "D:\projects\Lead gen app\csuite-pivot"

# Copy environment template
cp .env.example .env
```

Edit `.env` and add your credentials:

```bash
# REQUIRED - Get from https://fireworks.ai/
FIREWORKS_API_KEY=fw_your_api_key_here

# REQUIRED - Get from https://clerk.com/
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_key_here

# Generate encryption key
# Run: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
MASTER_ENCRYPTION_KEY=your_generated_key_here

# OPTIONAL - For Google Analytics integration
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_secret_here
```

## 2. Install Dependencies (1 minute)

```bash
# Install all packages
pnpm install

# Build workspace packages
pnpm build:packages
```

## 3. Database & Seed Data (1 minute)

```bash
# Start PostgreSQL and Redis
docker compose -f docker-compose.dev.yml up -d

# Push database schema
pnpm db:push

# Generate Prisma client
pnpm db:generate
```

Optional: Seed demo data (if seed script exists)
```bash
pnpm --filter @ocsuite/db seed
```

## 4. Start Services (1 minute)

Open **3 terminal windows**:

### Terminal 1: API Server
```bash
pnpm dev:api
```

Wait for: `Server started on http://localhost:3001`

### Terminal 2: Background Workers
```bash
pnpm dev:workers
```

Wait for: `Growth Pulse worker started`

### Terminal 3: Web Application
```bash
pnpm dev:web
```

Wait for: `Ready on http://localhost:3000`

## 5. Test Features (1 minute)

### Open the App

Navigate to: **http://localhost:3000**

### Complete Onboarding

1. Click **Sign Up**
2. Complete Clerk registration
3. Fill out business profile:
   - Company name
   - Industry (e.g., SaaS)
   - Business stage (e.g., growth)
   - Company size (e.g., 11-50)
   - Annual revenue
   - Goals

### Test Real AI Chat

1. Navigate to **Dashboard** > **C-Suite Chat**
2. Type: `"What should I focus on this quarter?"`
3. Watch real-time AI response stream in!

### View Health Checks

Open: **http://localhost:3001/health/detailed**

Should see:
```json
{
  "status": "healthy",
  "checks": {
    "database": { "status": "healthy" },
    "redis": { "status": "healthy" },
    "queues": { "status": "healthy" }
  }
}
```

## What's Working?

After completing quick start, you have:

- Real LLM conversations with Fireworks AI
- Context-aware C-suite personas (CEO, CFO, CMO, CTO)
- Background job processing
- Growth Pulse module (ready for analytics)
- Google Analytics connector (if configured)
- Board Meeting dashboard
- Health monitoring

## Next Steps

### Explore Features

1. **Try All Personas**
   - CEO: Strategic vision
   - CFO: Financial planning
   - CMO: Marketing strategy
   - CTO: Technical architecture

2. **Trigger Growth Pulse** (if analytics data available)
   ```bash
   curl -X POST http://localhost:3001/modules/growth-pulse/run \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

3. **Connect Google Analytics**
   - Navigate to **Connectors**
   - Click **Connect Google Analytics**
   - Complete OAuth flow

4. **Generate Board Meeting**
   - Navigate to **Board Meeting**
   - Click **Generate Report**

### Advanced Configuration

See [phase-2-playbook.md](./phase-2-playbook.md) for:
- Detailed environment variables
- Troubleshooting guide
- Performance optimization
- Security best practices

### API Testing

Test endpoints with curl:

```bash
# Health check
curl http://localhost:3001/health

# List connectors
curl http://localhost:3001/connectors \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"

# Get insights
curl http://localhost:3001/modules/insights \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"

# Board meeting
curl -X POST http://localhost:3001/board-meeting \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
```

## Common Issues

### "Fireworks API key not configured"

**Solution**: Add `FIREWORKS_API_KEY=fw_...` to `.env` and restart API

### "Can't reach database server"

**Solution**:
```bash
docker compose -f docker-compose.dev.yml up -d
```

### "Rate limit exceeded"

**Solution**: Wait 1 minute (limit: 10 chat messages/minute)

### Chat not streaming

**Solution**: Check browser console for errors, verify SSE support

## Quick Commands

```bash
# Restart everything
docker compose -f docker-compose.dev.yml restart
pnpm dev

# View logs
docker compose -f docker-compose.dev.yml logs -f

# Check database
pnpm db:studio

# Reset database
pnpm db:reset

# Run tests
pnpm test
```

## Getting Help

- **Full Documentation**: [phase-2-playbook.md](./phase-2-playbook.md)
- **API Reference**: [API-REFERENCE-PHASE2.md](./API-REFERENCE-PHASE2.md)
- **Troubleshooting**: See playbook troubleshooting section
- **Issues**: Create GitHub issue

## Summary

You now have a fully functional Phase 2 environment with:

- Real AI-powered C-suite conversations
- Module-based insights
- OAuth integrations
- Background processing
- Observability

Time to build something amazing!

---

**Setup Time**: ~5 minutes
**Phase**: Phase 2
**Last Updated**: November 1, 2025
