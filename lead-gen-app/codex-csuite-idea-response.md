good morning Codex, I would like you to read web-app-spec.md, than give me a complete build list, include all sub folders, all files with their specs (not code, just what that particular file needs to do). If you can give me any ideas you have for improving the web app please give them too. If you feel that anything particularly important to meet the stated goals please give that too.  
One clarification (or change to this project that I didnt list), I was talking over my project with my friend, and she had a great idea on a name AND the hook of this business. Online C Suite the URL is available, and I think the idea is very solid. Basically I would have a virtual set of C suite characters each with their own knowledge (that can be in the RAG) their knowledge can be derived from sources on the net no doubt. Say we have a CTO, so we could search for knowledge, strategies, information on being a CTO, put that in the RAG, and the CTO can access that RAG whenever he has a question from the user (or me) These C suite characters would ideally be an AI agent (claude as I know how to create agents there) So that these C suite characters will be both very smart as well as upgardeable with the RAG memory. The user should be able to hold to hold board meetings with the entire C suite or meetings with one or more C suite characters as needed, to get advice, or to give instructions on what needs to be done. What would be amazing is if the C suite characters could actually use the modules themselves! Do you think that this all is possible? If any of my ideas here are not easily possible, is there a work around? a strategy we could use that would make it close to my original idea here? Any other ideas you have that could make this C suite idea even more amazing?

Read web-app-spec.md

Build Plan

README.md – onboarding guide covering vision, setup, env vars, deploy playbooks.

package.json – workspaces config (frontend apps/web, backend apps/api, shared packages); scripts for lint/test/build.

pnpm-workspace.yaml (or npm equivalent) – register workspaces.

turbo.json – pipeline caching for lint/test/build.

tsconfig.base.json – shared TS compiler options.

eslint.config.js – monorepo lint rules; enforces security checks on AI-generated code.

prettier.config.cjs – formatting rules.

env.example – required env vars (Claude, Stripe, DB URLs, MCP endpoints).

apps/web/ (Next.js 14)

app/
layout.tsx – root layout, fonts, metadata, theme provider.
globals.css – Tailwind + CSS variables.
(auth)/signin/page.tsx, (auth)/callback/route.ts – Clerk/Auth0 flows.
(dashboard)/layout.tsx – shell with nav, chat sidebar, websocket provider.
(dashboard)/page.tsx – unified dashboard loader; fetch hero metrics, module cards, custom widgets.
(dashboard)/widgets/[id]/page.tsx – single widget preview.
(dashboard)/modules/[module]/page.tsx – module-specific dashboards (renders per-module components).
(dashboard)/marketplace/page.tsx – widget marketplace index (filters, search).
(dashboard)/marketplace/[listingId]/page.tsx – listing detail (preview sandbox, purchase CTA).
(dashboard)/tools/page.tsx – AI-generated tools library with run panel.
api/ routes:
widgets/route.ts – CRUD for custom widgets (auth + ownership checks).
widget-preview/[id]/route.ts – returns compiled widget bundle for iframe sandbox.
ai/widget-intents/route.ts – calls backend intent parser.
ai/widget-generate/route.ts – posts generation job, streams status.
chat/route.ts – SSE/WS bridge to AI assistant.
marketplace/purchase/route.ts – proxy to Stripe Checkout.
marketplace/install/route.ts – clones widget into user space.
components/
layout/SideNav.tsx, TopBar.tsx, QuickActionsBar.tsx – reusable layout pieces.
charts/HeroMetricCard.tsx, charts/ModuleCard.tsx – typed visual components.
widgets/WidgetCanvas.tsx, WidgetCard.tsx, WidgetSkeleton.tsx – render sandboxed widgets.
ai/ChatSidebar.tsx, ChatMessage.tsx, ActionSuggestion.tsx – assistant UI.
builder/ (AI widget builder UI) – PromptPanel.tsx, GenerationProgress.tsx, IntentSummary.tsx.
marketplace/ListingCard.tsx, ListingGallery.tsx, CreatorBadge.tsx.
tool-runner/ToolForm.tsx, ToolResultPanel.tsx.
forms/ – shared form controls integrated with React Hook Form + Zod.
icons/, ui/ – generated via shadcn.
lib/
api-client.ts – TanStack Query fetcher for VPA API gateway.
auth.ts – token helpers for Clerk/Auth0; attaches JWT to API calls.
socket.ts – websocket manager for live updates.
mcp-modules.ts – metadata for 14 modules (name, icon, data endpoints).
widget-sandbox.ts – helper to load widget iframes with CSP and postMessage.
intents.ts – client-side schema for AI intent responses.
providers/
query-provider.tsx – React Query.
theme-provider.tsx.
socket-provider.tsx.
hooks/
useHeroMetrics, useModuleMetrics, useWidgetBuilder, useMarketplace, useAiAssistant, useDashboardLayout.
store/
dashboardLayout.store.ts – Zustand state for drag-and-drop.
chat.store.ts.
widgets/compiled/ (ignored from git) – runtime storage for compiled widget bundles in dev.
public/ – static assets, favicons, marketing images.
styles/ – Tailwind config, theme tokens.
middleware.ts – auth and CSP headers; ensure iframe sandbox policy.
next.config.mjs – instrumentation (analyze bundle, experimental RSC toggles).
postcss.config.js, tailwind.config.ts.
apps/api/ (Express + GraphQL)

index.ts – entrypoint; sets up Express, Apollo Server, REST routes, auth middleware, health checks.
src/config/ – config loader, env validation.
src/middleware/
auth.ts – JWT verification, workspace scoping.
rate-limit.ts, error-handler.ts, request-logger.ts.
src/routes/
auth.router.ts – sign-in webhooks, Clerk webhooks.
modules.router.ts – REST endpoints to query MCP modules (proxy to orchestrator).
widgets.router.ts – AI widget CRUD, compile, validation queue.
builder.router.ts – intents parsing, code generation triggers.
marketplace.router.ts – listing CRUD, installs, reviews.
stripe.router.ts – checkout sessions, webhooks, payouts.
assistant.router.ts – chat message pipeline, conversation storage.
src/graphql/
schema.ts – GraphQL schema for dashboards.
resolvers/ – module metrics resolvers, widget queries.
context.ts – attaches user + module tokens.
src/mcp/
client.ts – orchestrator for 14 modules (calls VPA core or direct MCP).
metrics-service.ts – fetch hero metrics with caching.
tool-executor.ts – executes module tools for AI assistant.
src/services/
widget.service.ts – creation, compilation, security checks.
marketplace.service.ts – publishing flow, analytics rollups.
assistant.service.ts – conversation manager, action dispatcher.
stripe.service.ts – Connect accounts, payouts, subscriptions.
ai.service.ts – wraps Claude API (intent parse, component generation, tool code generation) with prompts + safety.
notification.service.ts – email/push hooks (future).
src/queues/ – BullMQ jobs for widget compilation, marketplace approval, payouts.
src/validators/ – Zod schemas for all request payloads.
src/security/
widget-validator.ts – static analysis, AST checks, complexity scoring.
sandbox.ts – VM2 execution harness for test renders.
src/db/
prisma/
schema.prisma – tables from spec + extras (conversations, AI logs).
migrations/.
seed.ts – development seeds (demo widgets, sample listings).
src/utils/ – logger (Winston), metrics (Prometheus), feature flags.
tests/ – integration tests (supertest), GraphQL tests, security tests.
package.json, tsconfig.json, jest.config.ts (or vitest), .env.example.
packages/ui/ – shared React UI primitives (if needed).

packages/types/ – shared TypeScript types (widget schemas, marketplace).

packages/config/ – shared ESLint/Tailwind configs.

scripts/

dev.sh, build.sh, lint.sh – orchestrate workspaces.
generate-widget-template.ts – CLI to scaffold safe widget skeletons.
.github/workflows/ – CI for lint/test/build, security scans on AI generated output.

docker/ – Dockerfiles for web/api, docker-compose for local stack (Postgres, Redis).

Key Implementation Notes

Establish strict security pipeline for generated widgets (AST scan, dependency whitelist, complexity thresholds).
AI assistant requires strong action routing: define canonical actions per module with guardrails (e.g., requires confirmation before sending emails or invoices).
Real-time board: use websockets for hero metrics updates; degrade gracefully using polling.
Stripe Connect integration for marketplace payouts; maintain ledger for sales vs payouts.
Provide multi-tenant data separation across modules; ensure API gateway scopes queries by user.
Dashboard layout persistence per user via dashboard_layouts table; integrate drag-and-drop.
Enhancement Opportunities

Add “Widget QA Sandbox” that auto-tests generated widgets against sample datasets before publishing.
Provide community “playbooks” (bundled dashboards + widgets) for quick onboarding.
Incorporate AI-driven recommendations on marketplace listing pricing based on demand.
Offer “analytics snapshots” email digests summarizing key changes and spotlighting useful marketplace widgets.
Build performance budget tooling: track widget render times, warn creators if heavy.
Critical To Hit Goals

Reliable module connectors: without accurate data from all 14 MCP modules, the unified dashboard and AI builders cannot deliver value. Prioritize stable MCP proxy and caching.
Secure, resilient AI code generation: ensure sandboxing + validation so marketplace doesn’t expose users to malicious code.
Marketplace moderation workflow: automated checks plus human review path; critical for trust and revenue.
Scalable data model for custom widgets and tools (versioning, dependencies, rollback). Without this, upgrades become risky.
Online C Suite Concept

Feasibility: highly plausible by modelling each C-level role as an Anthropic agent with role-specific system prompts, augmented with RAG collections curated per discipline (e.g., CTO knowledge base from trusted web sources, operations playbooks).
Knowledge ingestion: crawl authoritative blogs, books, frameworks, company case studies; embed into RAG by persona. Use nightly refresh to keep current.
Board meetings: implement “multi-agent session” where facilitator orchestrates each persona’s response (Claude tool calling multiple prompts). Present summarised transcript to user with follow-up actions.
Modules usage: design agent-to-module permissions. Agents can call MCP tools via orchestrator with guardrails (e.g., CFO can run billing_get_profitability_report). Log each action and require user confirmation for high-impact tasks.
If direct module control is complex, fallback: agents propose action cards; user clicks to execute tool. Later, hybrid approach enabling auto-run with approval workflows.
Hooks: unify across web app by presenting “Board Meeting” mode – choose personas, topics, timeframe. Provide saved decisions, tasks auto-created in Task Manager module.
Additional ideas: persona customization sliders (risk tolerance, innovation focus), speak using voice clones during meetings, integrate calendar scheduling for periodic board syncs, provide one-click export of meeting minutes with assigned tasks and KPIs.
Workarounds/Strategies

If full agent module control is risky, implement “planner-executor” pattern: persona drafts plan, user approves, background agent executes.
For RAG freshness, use scheduled vector store enrichment plus manual curation. Provide “persona training dashboard” to upload PDFs/links.
Use “hierarchical prompting” so board meeting orchestrator ensures personas don’t conflict; optionally add “Moderator AI” to synthesize conclusions.
Extra Enhancements For C Suite

Persona marketplace: allow community to share/trade custom C-suite personalities (aligns with widget marketplace).
Simulation mode: run “what-if” scenarios (e.g., CFO + COO simulate cashflow impact of hiring).
Decision audit trail: each board meeting logs decisions, assigned owner, due dates; integrate with Time & Billing or Task Manager.
All elements above keep the core vision intact while making the experience richer and grounded in achievable implementation steps.
