# Slice 1 · Core Shell + Single-Agent MVP

This slice delivers a fully functional MVP featuring authentication, a unified dashboard shell, foundational data plumbing, and a single executive persona (CEO) capable of answering questions using live module data. It establishes the baseline architecture for all subsequent slices.

---

## 1. Functional Objectives

- Users authenticate, land on the dashboard, and view top-level business metrics (even if some are placeholder values).
- A CEO agent answers user prompts using a curated knowledge base plus real data from leadtracker-pro, bookkeeping-assistant, and time-billing-agent.
- Conversations persist, and telemetry records cost/usage metrics.
- Engineering foundation: Next.js web app, Express API gateway, shared types, database schema, logging, and local developer tooling.

---

## 2. Repository Layout (Slice 1 Scope)

```text
online-c-suite/
├── apps/
│   ├── web/                 # Next.js frontend
│   └── api/                 # Express API gateway
├── packages/
│   ├── types/               # Shared TypeScript interfaces
│   └── ui/                  # Shadcn component wrappers (optional slice 1)
├── c-suite-agents/          # Agent orchestration service
├── module-connectors/       # MCP module proxy helpers
├── rag-knowledge-bases/     # Curated docs + ingestion scripts
├── scripts/                 # Dev utilities (db setup, lint)
└── docs/                    # Architecture + slice specs
```

> **Note:** For Slice 1, `packages/ui` may be a simple barrel export of generated Shadcn components; expand later if needed.

---

## 3. apps/web (Next.js Frontend)

### 3.1 Directory Structure

```text
apps/web/
├── app/
│   ├── layout.tsx
│   ├── globals.css
│   ├── page.tsx                 # Auth landing / marketing placeholder
│   └── (dashboard)/
│       ├── layout.tsx           # Shell with nav + chat sidebar
│       └── page.tsx             # Unified dashboard view
├── components/
│   ├── layout/
│   │   ├── SideNav.tsx
│   │   ├── TopBar.tsx
│   │   └── QuickActionsBar.tsx
│   ├── dashboard/
│   │   ├── HeroMetrics.tsx
│   │   └── ModuleMiniCard.tsx
│   ├── chat/
│   │   ├── ChatSidebar.tsx
│   │   ├── ChatInput.tsx
│   │   └── MessageBubble.tsx
│   ├── ui/                     # Generated via Shadcn (Button, Card, etc.)
│   └── feedback/TokenUsageChip.tsx
├── lib/
│   ├── api-client.ts           # Fetch wrapper using React Query
│   ├── auth.ts                 # Clerk/Auth helper
│   ├── modules.ts              # Metadata for hero metrics/cards
│   └── telemetry.ts            # Client-side logging hooks
├── hooks/
│   ├── useHeroMetrics.ts
│   ├── useModuleCards.ts
│   └── useChat.ts
├── store/
│   └── chat.store.ts           # Zustand store for conversation state
├── providers/
│   ├── query-provider.tsx
│   └── theme-provider.tsx
├── public/
│   └── icons/
├── styles/
│   └── tailwind.css (if separate)
├── middleware.ts               # Auth + CSP headers
├── next.config.mjs
├── tailwind.config.ts
├── postcss.config.cjs
└── package.json
```

### 3.2 Key Responsibilities

- **layout.tsx:** Loads Clerk/Auth provider, QueryProvider, ThemeProvider, and injects telemetry attributes.
- **(dashboard)/layout.tsx:** Renders shell layout with SideNav, TopBar, QuickActionsBar, and ChatSidebar.
- **(dashboard)/page.tsx:** Fetches hero metrics via server components, renders module mini-cards, and includes `WidgetPlaceholder` section for future slices.
- **ChatSidebar.tsx:** Streams conversation messages by consuming `/c-suite/ceo/chat` endpoint; shows token usage chip.
- **HeroMetrics.tsx:** Displays four key KPIs (placeholder values acceptable if data not ready, but provide fetch hook).

### 3.3 Client Data Flow

- React Query hooks (`useHeroMetrics`, `useModuleCards`) call API gateway endpoints with JWT attached.
- Chat store manages optimistic UI updates and error fallback messages.
- Token usage indicator updates based on metadata embedded in SSE/chat responses.

---

## 4. apps/api (Express Gateway)

### 4.1 Directory Structure

```text
apps/api/
├── src/
│   ├── index.ts               # Server bootstrap
│   ├── config/
│   │   └── env.ts             # Zod-based env validation
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── rate-limit.ts
│   │   ├── error-handler.ts
│   │   └── request-logger.ts
│   ├── routes/
│   │   ├── auth.router.ts
│   │   ├── modules.router.ts  # Proxy to MCP modules
│   │   └── c-suite.router.ts  # CEO agent chat endpoint
│   ├── services/
│   │   ├── agent.service.ts
│   │   ├── module.service.ts
│   │   ├── telemetry.service.ts
│   │   └── metrics.service.ts
│   ├── db/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   └── client.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── cost-tracker.ts
│   │   └── response.ts
│   └── types/index.ts
├── prisma/
│   └── schema.prisma (sym-link or shared)
├── package.json
└── tsconfig.json
```

### 4.2 Endpoints (Slice 1)

- `POST /auth/token` – exchange Clerk/Auth token for internal session (optional if using Clerk middleware).
- `GET /dashboard/hero-metrics` – aggregated metrics from MCP modules (even stubbed).
- `GET /dashboard/module-cards` – returns array of card data (status, trends).
- `POST /c-suite/ceo/chat` – accepts `{ message, contextId }`, returns streaming response (SSE or chunked fetch).
- `POST /modules/:module/:tool` – internal helper endpoint used by services (not public API) to call MCP modules.

### 4.3 Services

- **agent.service.ts:** Wraps Claude API calls, injects RAG context, tracks token cost, and formats messages for frontend.
- **module.service.ts:** Provides typed wrappers for leadtracker/bookkeeping/time-billing MCP calls, with retry + metrics.
- **metrics.service.ts:** Composes hero metrics by calling module service; caches short-lived results.
- **telemetry.service.ts:** Logs conversations, token usage, and API timings to database.

### 4.4 Database Schema (prisma)

```prisma
model User {
  id                String   @id @default(cuid())
  email             String   @unique
  name              String?
  avatarUrl         String?
  subscriptionTier  String   @default("alpha")
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  conversations     Conversation[]
  moduleAccess      UserModuleAccess[]
}

model Conversation {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  title         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  messages      Message[]
  tokenUsage    TokenUsage?
}

model Message {
  id               String   @id @default(cuid())
  conversationId   String
  conversation     Conversation @relation(fields: [conversationId], references: [id])
  role             String   // 'user' | 'assistant'
  content          String   @db.Text
  createdAt        DateTime @default(now())
}

model TokenUsage {
  id               String   @id @default(cuid())
  conversationId   String   @unique
  promptTokens     Int
  completionTokens Int
  costUsd          Decimal  @db.Decimal(10,4)
  updatedAt        DateTime @updatedAt
}

model UserModuleAccess {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  moduleName String
  enabled    Boolean  @default(true)
  createdAt  DateTime @default(now())
}
```

---

## 5. c-suite-agents (CEO Persona)

### 5.1 Directory Structure

```text
c-suite-agents/
├── src/
│   ├── index.ts               # Export orchestrator
│   ├── agents/
│   │   └── ceo-agent.ts       # System prompt + personality config
│   ├── orchestrator/
│   │   └── single-agent.ts    # Handles request lifecycle
│   ├── rag/
│   │   ├── retrieval.ts       # Vector search helper
│   │   └── embeddings.ts
│   ├── prompts/
│   │   └── ceo.prompt.md
│   ├── clients/
│   │   ├── claude-client.ts
│   │   └── telemetry-client.ts
│   └── types.ts
├── package.json
└── tsconfig.json
```

### 5.2 Responsibilities

- `ceo-agent.ts`: Defines persona metadata (name, expertise, tone) and constructs final prompt with user input + retrieved context.
- `single-agent.ts`: Accepts chat request, fetches relevant knowledge snippets, calls Claude with streaming, returns structured messages and token usage.
- `retrieval.ts`: Queries vector store (local JSON or Chroma for slice 1) with fallback to static context if embeddings unavailable.
- `telemetry-client.ts`: Sends usage stats to API gateway for persistence.

---

## 6. module-connectors (Read-Only Wrappers)

### 6.1 Directory Structure

```text
module-connectors/
├── src/
│   ├── index.ts
│   ├── leadtracker.ts
│   ├── bookkeeping.ts
│   └── time-billing.ts
├── package.json
└── tsconfig.json
```

### 6.2 Responsibilities

- Provide typed functions, e.g., `getPipelineSummary`, `getRevenueSnapshot`, `getUnbilledHours`.
- Handle MCP transport (HTTP/gRPC) configuration via env.
- Normalize responses into shared DTOs usable by metrics service.

---

## 7. rag-knowledge-bases (Curated CEO Knowledge)

### 7.1 Directory Structure

```text
rag-knowledge-bases/
├── ceo/
│   ├── README.md              # Guidance on updating
│   ├── sources/
│   │   ├── business-strategy.md
│   │   ├── okr-framework.md
│   │   └── leadership-principles.md
│   └── embeddings/
│       └── ceo-default.json   # Slice 1: simple local vector store
├── scripts/
│   ├── ingest.ts              # Converts markdown -> embeddings
│   └── update-embeddings.ts
├── package.json
└── tsconfig.json
```

### 7.2 Slice 1 Approach

- Use a lightweight embedding pipeline (e.g., OpenAI Embeddings or local all-MiniLM) to generate JSON vector store.
- Hardcode knowledge pack updates via scripts; full UI comes in Slice 4.

---

## 8. Shared Packages

### packages/types

- `src/index.ts` exporting shared interfaces (HeroMetric, ModuleCard, ChatMessage, AgentResponseMetadata, ModuleSummary).
- Provide Zod schemas for API validation reuse (importable by web + api).

### packages/ui (Optional Slice 1)

- Export generated Shadcn components after running `npx shadcn-ui init`.
- Encouraged if multiple apps need consistent UI tokens.

---

## 9. Tooling & Infrastructure

- **Env Management:** Root `.env.example` covering Clerk keys, Claude API, module endpoints, database, Redis (optional).
- **Monorepo Tooling:** `pnpm` workspace (or npm/yarn), `turbo.json` for pipelines (`build`, `lint`, `test`).
- **Testing:** Minimal jest/vitest setup for services (agent prompt assembly, module connector mocks).
- **Logging:** Winston/Pino configured with JSON output; integrate with transports later.
- **Cost Tracking:** Middleware intercepts Claude responses and records token usage.

---

## 10. Documentation (docs/)

- `docs/slice-1-detailed-spec.md` (this file).
- `docs/setup-guide.md` – local dev instructions (pnpm install, env config, database migration, running apps).
- `docs/architecture-overview.md` – system diagram, flows, component ownership.
- `docs/claude-prompts.md` – versioned copy of CEO system prompt + rationale.

---

## 11. Acceptance Criteria

- User can log in, open dashboard, and see hero cards populated (even if using stubbed data with fallback).
- Chatting with the CEO returns relevant, formatted responses referencing module data (where available) and knowledge base.
- Conversations persist; token usage recorded per conversation.
- Error states handled gracefully (module offline → friendly message).
- Codebase linted, tested, and running via `pnpm dev` (web + api concurrently).

Meeting these criteria establishes the backbone for multi-agent expansion and higher-level functionality in subsequent slices.
