# Online C Suite Build Slices

This document merges the v1 architecture from `web-app-spec.md`, Sonnet 4.5’s expansion, and Copilot recommendations into a slice-based delivery roadmap. Each slice is a thin, end-to-end vertical that ships working functionality while setting the stage for deeper iterations.

---

## Slice 1 · Core Shell + Single-Agent MVP

**Goal:** Prove that one executive persona (CEO) can answer user questions using live module data in a polished dashboard shell.

**Scope Highlights**

- Authentication + workspace bootstrapping (Clerk/Auth0).
- Unified dashboard scaffold with hero metrics and module card placeholders.
- Claude-powered CEO agent with curated RAG; 1-on-1 chat view.
- API gateway proxy to at least three MCP modules (leadtracker, bookkeeping, time-billing) for read-only queries.
- Logging, telemetry, cost tracking, and basic error handling.

**Deliverables**

- Next.js app skeleton (layout, dashboard page, chat sidebar).
- Express API with module proxy, agent endpoint, and auth middleware.
- Agent orchestration service (single persona) + RAG ingestion scripts.
- Initial database schema (users, module access, conversations, widgets placeholder tables).
- Developer docs: local setup, env vars, slice overview.

---

## Slice 2 · Multi-Agent Board Meetings

**Goal:** Elevate the experience to true “board meetings” with multiple executive personas providing sequential insights and shared transcripts.

**Scope Highlights**

- Add CFO and CMO personas with curated RAG domains.
- Meeting orchestrator that routes prompts to relevant agents and streams responses.
- Board meeting UI (avatars, thinking indicators, transcript panel, feedback buttons).
- Action item extraction and storage.
- Improved module connectors (expand to 8+ modules, add caching).
- Conversation quality telemetry (ratings, agent token usage).

**Deliverables**

- `c-suite/meeting` UI surface with stream handling.
- Orchestrator layer coordinating multi-agent exchanges.
- Persisted meeting transcripts and action-item records.
- Prompt templates + knowledge packs per persona.
- Cost dashboards and alerting for runaway token spend.

---

## Slice 3 · Agent-Guided Actions with Approval

**Goal:** Let agents recommend and execute module tools under user supervision, turning insights into concrete steps.

**Scope Highlights**

- Tool router mediating agent → MCP execution with permission checks.
- Proposal/approval UI (“CMO wants to schedule email campaign—approve?”).
- Execution logging, status tracking, undo/fail-safe paths.
- Idempotency + retries for module commands.
- Notification hooks (in-app toasts + email summary).

**Deliverables**

- Agent action queue + approval modal flow.
- Expanded service layer for executing module tools.
- Audit tables capturing executed actions and outcomes.
- Alerting on failed actions and module downtime.

---

## Slice 4 · Knowledge Customization & Packs

**Goal:** Allow users to tailor each persona’s expertise via document uploads, web sources, and curated knowledge packs.

**Scope Highlights**

- Knowledge management UI (upload, tag, assign to persona).
- Vector store integration (Qdrant/Pinecone) with metadata isolation per persona.
- Ingestion pipelines for PDFs, markdown, URLs (scraping + chunking).
- Knowledge pack marketplace stub (install/uninstall curated bundles).
- Quality safeguards (file size limits, content validation).

**Deliverables**

- `c-suite/knowledge` dashboard with status indicators.
- Background jobs for ingestion + embedding.
- Persona prompt augmentation pipeline pulling top-k relevant chunks.
- Documentation on recommended sources and moderation process.

---

## Slice 5 · Proactive Agents + Widget Marketplace

**Goal:** Transform Online C Suite into a proactive advisor while unlocking monetization loops.

**Scope Highlights**

- Trigger engine for proactive agent alerts (scheduled + anomaly-based).
- Notification center UI; ability to snooze/dismiss.
- Marketplace v1: browse, install, rate custom widgets; creator dashboard.
- Stripe subscriptions + Connect payouts.
- Widget builder hardening (validation, sandbox performance budgets).

**Deliverables**

- Proactive alert pipelines (cron + event-based) feeding the UI.
- Marketplace pages (listings, detail, publish workflow).
- Billing flows + webhook handling + payout ledger.
- Security scanning + moderation tooling for marketplace submissions.

---

## Slice 6 · Polish, Desktop Wrapper, and Integrations

**Goal:** Harden the platform for beta launch and explore premium accoutrements.

**Scope Highlights**

- Performance tuning, SLO dashboards, Sentry alerts.
- Tauri wrapper for Windows/macOS (auto-update + local file helpers).
- Voice/TTS optional layer, PWA enhancements, mobile responsiveness.
- Slack/Discord integration for agent interactions outside the app.
- Beta onboarding flows, product analytics, help center content.

**Deliverables**

- Production-grade monitoring + error budgets.
- Desktop build pipeline (Tauri) with update channel.
- Optional voice interface prototype with guardrails.
- Documentation + in-app tours for beta testers.

---

## Cross-Slice Foundations (Ongoing)

- **Testing:** Unit + integration suites per slice, sandbox smoke tests for generated widgets.
- **Observability:** Structured logging (Winston/Pino), metrics (Prometheus), tracing (OpenTelemetry).
- **Security:** Authz middleware, rate limiting, secrets rotation, compliance checklists.
- **Cost Controls:** Token usage dashboards, Claude client middleware enforcing quotas.
- **Collaboration:** Shared design system, prompt library, and coding standards.

Each slice deepens the experience without leaving partially finished surfaces behind, enabling rapid iteration while safeguarding cohesion and quality.
