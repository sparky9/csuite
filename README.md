# Online C Suite · Hosted Platform

Multi-tenant SaaS platform delivering AI-powered strategic guidance through persona-driven agents.

## Architecture

```
csuite-pivot/
├── apps/
│   ├── web/         # Next.js frontend
│   └── api/         # Express API gateway
└── packages/
    ├── types/       # Shared TypeScript types
    ├── module-sdk/  # MCP module contract definitions
    ├── db/          # Prisma client & migrations
    └── crypto/      # Tenant-specific encryption
```

## Quick Start

### Prerequisites

- Node.js >= 18
- pnpm >= 8
- Docker & Docker Compose
- PostgreSQL 15+ (via Docker)
- Redis 7+ (via Docker)

### Setup

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Start infrastructure**

   ```bash
   docker compose up -d
   ```

3. **Configure environment**

   ```bash
   cp .env.example .env
   # Edit .env with your Clerk & Fireworks credentials
   ```

4. **Run migrations**

```bash
pnpm db:migrate
```

5. **Seed demo data** (optional, recommended for demos)

```bash
pnpm seed:slice3   # Board meeting narrative + action items
pnpm seed:slice4   # Action approvals + notifications walkthrough
```

6. **Start dev servers**

   ```bash
   pnpm dev
   ```

   - Web: http://localhost:3000
   - API: http://localhost:3001

## Development

### Common Commands

- `pnpm dev` - Start all apps in parallel
- `pnpm dev:api` - Start API server only
- `pnpm dev:web` - Start web app only
- `pnpm dev:workers` - Start background workers
- `pnpm build` - Build all packages & apps
- `pnpm test` - Run all tests
- `pnpm test:watch` - Run tests in watch mode
- `pnpm test:coverage` - Run tests with coverage
- `pnpm test:integration` - Run API integration tests
- `pnpm lint` - Lint all packages
- `pnpm lint:fix` - Auto-fix linting issues
- `pnpm typecheck` - Type-check all packages
- `pnpm format` - Format code with Prettier
- `pnpm db:generate` - Generate Prisma client
- `pnpm db:migrate` - Run database migrations
- `pnpm db:studio` - Open Prisma Studio
- `pnpm seed:slice3` - Load sample multi-persona board meeting data
- `pnpm seed:slice4` - Load action approvals, tasks, and notifications demo data

## Phase 3 Highlights

Phase 3 elevates the platform into a collaborative board room experience:

- **Board Meeting Orchestrator** - Streams coordinated insights from CEO, CFO, CMO, and CTO personas
  - Agenda-aware prompt planning with shared context
  - Persona turns persisted with full transcripts and metrics
  - Board action items captured, prioritised, and assignable to members

- **Meeting Telemetry & Governance**
  - Token usage tracked per persona and stored with meeting metadata
  - Ratings and sentiment surfaced for success reviews
  - Row-Level Security enforced across board meeting tables (see `packages/db/tests/rls-phase3.test.ts`)

- **Seeded Demo Experience**
  - `seed:slice3` script generates a complete sample meeting
  - Persona turns include realistic CTO delivery guidance
  - Action items demonstrate assignment flow and follow-ups

- **Foundational Phase 2 Capabilities** remain in place (Growth Pulse, analytics integration, observability) and continue to power persona context.

**Get Started**: Seed the Slice 3 demo, then run `pnpm dev` to experience a full board session with four executive personas.

## Phase 4 Highlights

Phase 4 introduces automation guardrails so tenants can trust AI-driven execution:

- **Action Approval Pipeline** – New `ActionApproval` model, REST endpoints, and risk heuristics capture every requested workflow with audit history.
- **Execution Router Worker** – BullMQ worker enforces idempotency, resolves module capabilities, streams task progress, and records results + rollback stubs.
- **Approvals Dashboard** – `/actions` inbox surfaces risk badges, payload previews, audit timelines, and approval controls with comment capture.
- **Notification System** – Persistent notification feed, toast/badge indicators, email preference toggles, and Clerk-protected approval deeplinks.
- **Audit & Compliance** – Owner/Admin audit endpoint, task linkage, and seeded demo data (`pnpm seed:slice4`) showcasing pending, executing, and executed flows.

**Next Up**: Extend rollback execution using stored `undoPayload` and bring Slack delivery online once the connector launches.

## Documentation

### Phase 2 Documentation

- **[Phase 2 Playbook](docs/phase-2-playbook.md)** - Complete developer guide for Phase 2
- **[Quick Start Guide](docs/QUICK-START-PHASE2.md)** - Get Phase 2 running in 5 minutes
- **[API Reference](docs/API-REFERENCE-PHASE2.md)** - Complete API documentation for Phase 2 endpoints
- **[LLM Implementation](./FIREWORKS-LLM-IMPLEMENTATION.md)** - Fireworks AI integration details
- **[Quick Start LLM](./QUICK-START-LLM.md)** - LLM quick reference
- **[Persona Playbook](docs/persona-playbook.md)** - Persona definitions, tone guidance, and extension process
- **[Phase 4 Approvals](docs/phase-4-approvals.md)** - Approval workflow architecture, risk heuristics, testing, and troubleshooting
- **[Phase 4 Load Test Plan](docs/phase-4-load-test-plan.md)** - Performance validation plan for the approval pipeline

### General Documentation

- **[TESTING.md](./TESTING.md)** - Testing guide and best practices
- **[CI-CD.md](./CI-CD.md)** - CI/CD pipeline and deployment guide
- **[DEPLOYMENT-CHECKLIST.md](./DEPLOYMENT-CHECKLIST.md)** - Pre-deployment checklist
- **[docs/](./docs/)** - Additional documentation on:
  - Architecture & design decisions
  - Security & tenant isolation
  - Module contract specifications

## Project Phases

### Phase 1 (Complete)

Delivered SaaS baseline with:

- Multi-tenant onboarding & authentication
- Chat interface with mocked CEO responses
- Connector OAuth scaffolding
- Queue & worker infrastructure
- RLS-enforced tenant isolation

### Phase 2 (Complete)

Delivered production AI features:

- Real LLM integration (Fireworks AI)
- Growth Pulse module with insights
- Google Analytics connector
- Board Meeting dashboard
- Health checks and observability
