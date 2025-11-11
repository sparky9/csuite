# Hosted Pivot · Slice 2 Build Brief (For Sonnet 4.5)

## Objective

Move from mocked shell to an actively useful hosted experience by powering the C-Suite orchestration with live data, real modules, and production-ready guardrails. Phase 2 focuses on connecting the platform to real LLM output, ingesting customer context via connectors, and delivering actionable board guidance inside the multi-tenant web app.

## Scope Overview

- Replace mocked CEO responses with a real streaming generation pipeline (Fireworks Qwen3 preferred) that respects tenant isolation.
- Stand up the first end-to-end module ("Growth & Revenue Pulse") using `@ocsuite/module-sdk`, including data ingestion, task orchestration, and surfaced insights.
- Deliver a usable dashboard: live KPIs, recent activity, and module alerts sourced from real tasks and connector data.
- Expand the API/worker layer with scheduled jobs, retry logic, and observability needed for production pilot tenants.
- Keep the developer experience smooth: migrations, seed scripts, and docs must enable anyone to spin up Slice 2 locally.

## Deliverables

### 1. Conversational Intelligence Upgrade

- Stream live CEO persona responses via Fireworks (or equivalent) with guardrails:
  - Use tenant-specific prompt templates and context assembled from connector data + task results.
  - Implement `@ocsuite/crypto` key usage to sign Fireworks requests without exposing secrets.
  - Add rate limiting per tenant + per user; emit 429s with friendly retry messaging.
- Capture full token usage + model metadata per message in the database (`Message.metadata`).
- Expand chat API to support follow-up questions referencing prior insights (e.g., conversation memory buffer capped by tokens).
- Provide Vitest coverage for the new prompt builder + streaming parser (mock the Fireworks client).

### 2. Module Orchestration ("Growth & Revenue Pulse")

- Define module contract implementation in `packages/module-sdk`:
  - Capability manifest, input schema (revenue + funnel metrics), output schema (insights, risks, recommended actions).
  - Versioned `1.0.0` manifest with changelog entry.
- Create worker in `apps/api/src/workers/modules/growth-pulse.worker.ts`:
  - Pull raw data from connectors (initially Google Analytics demo payload + manual revenue upload).
  - Run aggregation task, call LLM for commentary, persist summary in new `ModuleInsight` table (include tenantId, moduleSlug, score, highlights, actionItems).
  - Send alert notification to queue (`alerts` channel) when insight severity >= threshold.
- Add API surface:
  - `GET /modules/growth-pulse/insights` (paginated, tenant-scoped).
  - `POST /modules/growth-pulse/run` to trigger ad-hoc refresh.
- Update dashboard to display the latest insight card with severity badge, summary bullets, and "take action" links (placeholder modal acceptable).

### 3. Connector Pipeline (Google Analytics Lite)

- Implement OAuth flow end-to-end:
  - Use Google OAuth (server-side) with Clerk session bridging.
  - Store refresh/access tokens encrypted via `@ocsuite/crypto`; rotate keys monthly.
- Add ingestion job in BullMQ:
  - `sync-analytics` queue pulling sessions/users/conversions for last 30 days.
  - Normalize into new `AnalyticsSnapshot` Prisma model (tenantId, date, sessions, conversions, revenue, sourceBreakdown JSON).
- Surface connector health in UI:
  - Status indicators (active/error/stale data) with last sync timestamp.
  - Retry + disconnect controls hitting API endpoints.
- Write integration tests stubbing Google APIs (use Nock) for OAuth callback and ingestion job.

### 4. Board Meeting Experience (MCP-style Agenda)

- Flesh out `POST /c-suite/board-meeting` to aggregate:
  - Recent chat questions + answers (last 5 messages).
  - Latest module insights (from Growth Pulse).
  - Operational metrics (tasks executed, connectors status, top risks).
- Return structured JSON (agenda sections, highlights, decisions, required follow-ups) for front-end rendering.
- Implement front-end board view at `apps/web/src/app/(dashboard)/board/page.tsx`:
  - Multi-column layout with agenda timeline, risk callouts, and task assignments.
  - Allow exporting summary as downloadable PDF (use existing UI components; actual PDF generation can be TODO with spec describing approach).

### 5. Observability & Reliability

- Add centralized metrics + tracing hooks:
  - Pino logs enriched with requestId, tenantId, jobId.
  - `apps/api/src/utils/metrics.ts` with OpenTelemetry counter placeholders (HTTP latency, job runtime, LLM token usage).
  - Health endpoints for queues (`/tasks/health`, `/connectors/health`) returning queue depth + failed count.
- Implement retry/backoff policies for LLM + connector calls; store failures in DLQs with actionable metadata.
- Add `scripts/seed/slice2.ts` to populate demo tenant with analytics snapshots, module insight, and board data.

### 6. Database & Schema

- Prisma migrations for:
  - `ModuleInsight` (tenantId, moduleSlug, severity, summary, actionItems JSONB, createdAt).
  - `AnalyticsSnapshot` (see connector section) with indexes for reporting.
  - Additional fields on `Task` for module/connector linkage (`moduleSlug`, `connectorId` nullable).
- Extend RLS policies for new tables; update RLS tests and add coverage for new models.
- Update `packages/types` and `@ocsuite/db` exports.

### 7. Documentation & DX

- Create `docs/phase-2-playbook.md` including:
  - Environment variables (Fireworks keys, Google OAuth credentials) and setup instructions.
  - Step-by-step local workflow (run migrations, seed data, execute module job, view dashboard).
  - Troubleshooting section for common OAuth/LLM issues.
- Update README quick-start to reference Phase 2 capabilities and new commands:
  - `pnpm dev:workers:modules`, `pnpm seed:slice2`, etc.
- Provide Loom or text walkthrough script for product demo (outline in doc is sufficient).

## Acceptance Criteria

1. Developer can run `pnpm migrate && pnpm seed:slice2 && pnpm dev` and:
   - Authenticate via Clerk, finish onboarding, and see populated dashboard metrics.
   - Open chat, receive streaming Fireworks response referencing live analytics data.
   - Navigate to Board page and view structured agenda populated from module insights + analytics snapshots.
   - Trigger Growth Pulse run manually and watch task progress via SSE with real updates.
2. Queue health check and `/health` endpoints show green status; DLQs contain actionable payloads on intentional failures.
3. Tests (`pnpm test`) cover:
   - Prompt builder + streaming parser (unit).
   - Connector OAuth + ingestion job (integration with stubs).
   - Module worker pipeline (unit with mocked LLM response).
   - RLS enforcement on new tables.
4. Codebase passes lint/typecheck; documentation accurately reflects setup (validated by fresh clone dry-run).

## Risks & Open Questions

- **LLM cost & rate limits:** Confirm Fireworks budget; consider fallback deterministic responses in non-prod environments.
- **OAuth credentials storage:** Evaluate using Clerk or external secret manager for production; document interim plan.
- **Data freshness expectations:** Define acceptable latency for analytics sync (default hourly?).
- **PDF export implementation:** Decide whether to integrate a service (e.g., React PDF) or defer to later slice.

## Next Steps

1. Merge outstanding Phase 1 migrations and ensure Sonnet has clean baseline (`pnpm db:migrate`).
2. Review/approve this brief with stakeholders; log adjustments in `INTEGRATION_PROGRESS.md`.
3. Assign Sonnet Phase 2 branch; provide Fireworks + Google OAuth sandbox credentials via secure channel.
4. Schedule midway review focusing on LLM output quality + connector reliability before code freeze.
