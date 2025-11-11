# Hosted Pivot · Slice 1 Build Brief (For Sonnet 4.5)

## Objective
Ship the hosted SaaS shell with mocked module responses so the platform runs end-to-end:
- Multi-tenant onboarding
- Chat/board shell (single-agent CEO for now)
- Connector OAuth flow scaffolding
- Queue + worker plumbing with stub processors
- CI/CD + environment baseline

## Deliverables
1. **Next.js App (apps/web)**
   - Tenant-aware layout (dashboard, chat, connector settings) using Clerk auth.
   - Onboarding wizard: create tenant, collect business profile, prompt to connect first integration (placeholder allowed).
   - Chat UI wired to SSE endpoint; render mocked CEO responses.
   - Connector management screen displaying status fetched from API (mock data acceptable).
2. **Module Contract SDK**
   - Create `packages/module-sdk` exporting TypeScript interfaces/Zod schemas (e.g., `ModuleCapability`, `MetricSnapshot`, `TaskExecutionRequest`, `TaskExecutionResult`).
   - Provide validation helpers used by both the API gateway and hosted workers.
   - Document versioning strategy (capability name + semver) to keep contracts stable.
3. **Express API (apps/api)**
   - Clerk JWT validation; tenant resolution middleware ensuring user membership.
   - Endpoints:
     - `POST /c-suite/ceo/chat` → streams mocked response, records conversation in DB.
     - `POST /c-suite/board-meeting` → returns static placeholder (used later by real implementation).
     - `GET /connectors` & `POST /connectors/:provider/authorize|callback` (Google demo provider) storing encrypted tokens.
     - `POST /tasks/execute` → validates tenant limits, enqueues stub job.
   - Rate limiting + structured logging (pino) enabled.
4. **Database & Prisma**
   - Multi-tenant schema: `Tenant`, `User`, `TenantMember`, `Conversation`, `Message`, `Connector`, `Task`, `UsageSnapshot`.
   - Enable pgvector extension and create placeholder tables for `tenant_embeddings` and `company_embeddings` (even if unused yet).
   - Prisma middleware enforcing tenant scoping + audit timestamps.
   - Postgres Row-Level Security policies enabled for every tenant-scoped table; add tests verifying cross-tenant queries are denied.
   - Migration committed.
5. **Queue & Worker Scaffold**
   - BullMQ + Redis setup with `sync-connector` and `execute-task` stub jobs plus dedicated dead-letter queues (`sync-connector-dlq`, `execute-task-dlq`).
   - Worker process per queue logging tenant/job payload, returning mock data.
6. **Realtime Channel**
   - Implement WebSocket (preferred) or SSE channel for task status updates. Emit mock progress events tied to job IDs.
7. **Encryption & Key Management**
   - Implement helper in new `@ocsuite/crypto` for deriving per-tenant keys using HKDF/HMAC(masterKey, tenantId).
   - Store only encrypted tokens/secrets; decrypt in-memory per request. No plaintext caching in Redis or logs.
8. **Infrastructure Baseline**
   - `.env.example` updated for hosted stack (Clerk, Fireworks, Redis, Postgres connection strings, encryption keys).
   - `docker-compose.dev.yml` with Postgres + Redis for local dev.
   - GitHub Actions workflow running lint/test/build and deploying to staging (can be stub referencing TODO). Documentation on manual deploy path acceptable.
9. **Documentation**
   - Update `README.md` or new `docs/hosted-quickstart.md` covering local setup, env var config, seeding demo data, queue/worker commands.
   - Document RLS policies, module contract usage, and key-derivation approach. Remind to avoid caching decrypted tokens (AWS secret or in-memory only).

## Constraints & Assumptions
- Use Qwen3 endpoints only for mock responses (can be replaced with deterministic strings while we finalize module refactors).
- Connector tokens must be encrypted at rest using tenant-derived keys (libsodium or Node crypto). Do **not** cache decrypted tokens in Redis.
- Postgres RLS must be enabled and enforced in this slice; middleware alone is insufficient.
- Board meeting endpoint returns placeholder; UI should handle gracefully.

## Acceptance Criteria
- Sign up with Clerk dev account → onboarding wizard → dashboard renders with mocked metrics and chat available.
- Chat sends message, receives streamed placeholder (simulate SSE) and persists conversation rows tied to tenant.
- `Connect Google` button walks through OAuth demo (state saved in Redis, tokens stored encrypted in `Connector`).
- Triggering `POST /tasks/execute` enqueues job and worker logs execution with tenant id.
- All TypeScript builds + lint pass; tests cover tenant middleware and connector storage.
- Documentation enables fresh developer to run entire stack locally with Docker compose.

## Testing Notes
- Add Jest/Vitest tests for tenant middleware (reject non-members), conversation persistence, connector encryption/decryption, and RLS enforcement (attempt cross-tenant query should throw).
- Add smoke test script hitting chat endpoint and verifying SSE stream structure.

## Open Questions for Sonnet to Flag
- Preferred encryption library (`crypto.subtle` vs `node:crypto` vs libsodium)?
- Where to host staging initially (Railway/Fly/Vercel)? Document recommendation.
- Any blockers encountered with Clerk multi-tenant pattern.

Complete this slice first; later slices will swap mocks for real module workers.
