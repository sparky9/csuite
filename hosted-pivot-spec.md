# Online C Suite · Hosted Pivot Master Plan

## Vision

Deliver a fully hosted, multi-tenant Online C Suite that gives solopreneurs a turnkey "AI board of directors" able to provide strategic guidance and execute operational tasks through a growing catalog of MCP modules. The platform must:

- Onboard users in minutes with zero local setup.
- Orchestrate persona-driven conversations (CEO, CFO, etc.) with multi-agent "board meeting" support.
- Connect securely to customer SaaS systems, leaving source data in-place whenever possible.
- Execute repeatable automation through hosted MCP workers that can be added or swapped without touching the core shell.
- Keep costs predictable via efficient model usage (Qwen3 by default) and transparent usage limits.

## Guiding Principles

1. **Hosted-first** – All services run in our cloud environment. Customers authenticate to third-party tools via OAuth; no local installs.
2. **Modular contract** – The control plane communicates with MCP workers through a narrow, versioned interface (capabilities, inputs, outputs).
3. **Tenant isolation** – Every piece of customer data (including embeddings) is scoped to a tenant ID, with encryption-in-depth and gating at DB, cache, and worker layers.
4. **Progressive enhancement** – Each slice ships a complete vertical experience. Later slices extend rather than rewrite earlier work.
5. **Two-tier knowledge** – Maintain a private RAG for company IP plus per-tenant knowledge stores sourced from customer systems.
6. **Cost discipline** – Prefer serverless or usage-based infrastructure until revenue grows; keep architectural choices migration-friendly.

## Slice / Phase Roadmap

### Slice 1 · Hosted Control Plane & Shell
**Goal:** Deliver the SaaS baseline with mocked modules so the app runs end-to-end, proving tenancy, chat streaming, connector flows, queue plumbing, and security primitives.
- Tenant-aware Next.js dashboard + chat + connector UX.
- Express API gateway with Clerk auth, tenant middleware, rate limiting.
- Postgres row-level security (RLS) policies enabled from day one; Prisma middleware + tests guarding tenant isolation.
- Message queue + worker scaffold (BullMQ/Redis) with stub processors and dead-letter queue configured.
- Connector OAuth flow for at least one provider (Google demo) storing encrypted tokens with tenant-derived keys.
- Module contract SDK (`@ocsuite/module-sdk`) defining capabilities schema; mocked module responses conform to this contract.
- Vector store scaffolding (pgvector extension or Qdrant client) wired for company & tenant knowledge bases.
- WebSocket channel for task status updates (even if streaming mock data initially).
- CI/CD pipeline & environments (dev/staging) defined.

### Slice 2 · Core MCP Workers (LeadTracker, Bookkeeping, Email)
**Goal:** Replace mocks with hosted workers for the three critical operational pillars.
- Implement LeadTracker Pro hosted worker (CRM metrics, pipeline summaries).
- Implement Bookkeeping assistant worker (financial metrics, burn rate).
- Implement Email Orchestrator worker with Gmail OAuth + campaign exec (queue-backed).
- Persist derived metrics + task results in Postgres; surface in dashboard.
- Hardening: connector status monitoring, retry policies, structured logging.

### Slice 3 · Board Meetings & Multi-Agent Orchestration
**Goal:** Upgrade from single-agent chat to collaborative board sessions with actionable outputs.
- CEO + CFO + CMO personas with persona-specific prompts and knowledge packs.
- Board meeting orchestration service (serial fan-out, synthesis, streaming UI).
- Action-item extraction pipeline storing recommended tasks.
- Usage telemetry (token counts per persona, meeting ratings).

### Slice 4 · Execution Pipeline & Task Approvals
**Goal:** Allow users to approve/execute board recommendations safely.
- Action approval UI with previews and risk hints.
- Task execution router calling module capabilities with idempotency + audit logging.
- Notification system (in-app + email) for task status.
- Undo/fail-safe flow (rollbacks or manual follow-up instructions).

### Slice 5 · Knowledge Customization & Customer Storage
**Goal:** Enable customers to enrich persona knowledge without compromising isolation.
- Per-tenant knowledge ingestion (Google Drive, Notion, file uploads) -> embedding pipeline.
- Company HQ knowledge base accessible only to internal agents.
- Bring-your-own storage configuration: customer chooses to host files or let us store encrypted copies.
- Knowledge management UI with source health indicators.

### Slice 6 · Proactive Insights & Marketplace Foundations
**Goal:** Turn the platform from reactive to proactive and lay the groundwork for extensibility.
- Trigger engine for scheduled/anomaly-based alerts with triage UI.
- Widget/add-on registration metadata (no public marketplace yet).
- Billing instrumentation (Stripe/usage tracking) for premium tiers.
- Lightweight analytics (PostHog) for feature usage.

### Slice 7 · Polish, Compliance, & Scale Readiness
**Goal:** Prep for commercial launch with reliability and governance.
- Comprehensive observability (metrics, traces, logs) with SLO dashboards.
- Postgres RLS policies + per-tenant encryption key rotation.
- Security review, threat modeling, incident response playbook.
- Performance tuning (p95 chat latency, queue throughput) and horizontal scaling guides.

## Cross-Cutting Workstreams

- **Shared Libraries:** `@ocsuite/types`, `@ocsuite/db`, `@ocsuite/auth`, queue client, and module SDK updated as needed each slice.
- **Infrastructure Automation:** Terraform/Infra-as-code once we settle on cloud providers (initial manual setup acceptable).
- **Testing:** Unit tests for shared libs; integration tests per slice; end-to-end smoke covering signup -> board meeting -> task execution.
- **Documentation:** Living docs for connector setup, module contract, release notes per slice.
- **Cost Monitoring:** Track Fireworks usage, queue time, DB size; adjust tier limits/pricing as data arrives.

## Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| OAuth/credential sprawl | Central secrets vault, standard refresh flows, scoped access tokens |
| Queue bottlenecks | Separate critical vs bulk queues, auto-scale workers, queue monitoring |
| Tenant isolation bugs | Enforce Postgres RLS + automated tests + pen-test |
| Model costs spike | Token budgeting, optional prompt caching, future multi-model support |
| Module proliferation without governance | Module registry with capability metadata and minimum logging requirements |

---

This plan positions Slice 1 as the universal shell everyone depends on, ensuring subsequent slices can focus on delivering high-value capabilities without rework.
