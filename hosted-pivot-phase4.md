# Hosted Pivot · Slice 4 Build Brief (For Sonnet 4.5)

## Objective

Transform board recommendations into executable workflows with safety controls, approvals, and visibility, allowing tenants to trust automated actions while maintaining oversight.

## Scope Overview

- Build the action approval pipeline that validates, schedules, and executes recommended tasks via module capabilities.
- Provide users with contextual previews, risk scoring, and audit trails for every automated action.
- Introduce notification mechanisms (in-app and email) to keep stakeholders informed of pending approvals and execution results.

## Deliverables

### 1. Action Approval Service

- New Prisma model `ActionApproval` (id, tenantId, actionItemId?, source, payload, riskScore, status, createdBy, approvedBy, approvedAt, executedAt, auditLog JSON).
- API endpoints:
  - `POST /actions/submit` for modules/board to request execution (queues approval if needed).
  - `GET /actions/pending` with filters (risk, owner, module).
  - `POST /actions/:id/approve` and `POST /actions/:id/reject` handling multi-step approvals (owner + optional reviewer).
- Risk scoring utility (simple heuristics based on module, connectors touched, data sensitivity) stored with request.

### 2. Execution Router

- Worker (`apps/api/src/workers/action-executor.worker.ts`) that:
  - Pulls approved actions from queue
  - Resolves module capability via `@ocsuite/module-sdk`
  - Ensures idempotency (store hash of payload + capability; skip duplicates)
  - Streams execution progress to task SSE channel
- Add support for rollback/compensation stub:
  - Log `undoPayload` (if provided by module) so future slices can implement full rollback

### 3. Preview & Risk UI

- New dashboard section `apps/web/src/app/(dashboard)/actions/page.tsx` featuring:
  - Approval inbox (table with risk badge, module, requested by, created time)
  - Detail drawer with preview content (LLM-summarized change: e.g., "Send weekly update email to 120 leads")
  - Approve/Reject buttons with optional comment capture
  - Execution history tab showing status, duration, and audit trail
- Integrate CTA from board action items ("Request approval") -> pre-fills action submission form

### 4. Notifications

- Notification preference settings (`apps/web/src/app/(dashboard)/settings/notifications.tsx`) allowing users to choose in-app/email/slack (slack stub for future use)
- In-app toast + inbox badge when new approval assigned
- Email notification via nodemailer (or provider) with secure approval link (Clerk-protected)
- Store notifications in `Notification` table for retrieval (id, tenantId, userId, type, payload, readAt)

### 5. Audit & Compliance

- Append audit events to `ActionApproval.auditLog` (JSON array of events: submitted, approved, executed, failed)
- Expose admin endpoint `GET /actions/audit/:id` returning full log (secured to owner/admin roles)
- Ensure every execution writes to `Task` record linking `actionApprovalId`

### 6. Testing & Reliability

- Unit tests for risk scoring, approval transitions, execution router (mock modules)
- Integration tests for end-to-end approval -> execution (double-check RLS)
- Load test plan (document) ensuring queue handles peak approval volume

### 7. Documentation & DX

- Update `docs/phase-4-approvals.md` describing risk levels, approval workflow, and how modules submit actions
- Extend seed script (`pnpm seed:slice4`) to populate sample approvals in various states
- README updates covering notification setup and approval commands (e.g., `pnpm dev:notifications`)

## Acceptance Criteria

1. From a fresh seed (`pnpm seed:slice4`), a user can:
   - View pending approvals, inspect previews, and approve/reject actions
   - Trigger execution and watch task status update in real time
   - Receive notifications (in-app + email) for new approvals and execution results
2. Audit log displays full lifecycle of each action, including timestamps and actors
3. RLS enforced on approval + notification tables; tests cover cross-tenant isolation
4. Lint/typecheck/tests pass

## Risks & Open Questions

- Determining accurate risk scoring without full business context
- Email deliverability (may require provider setup)
- Handling partial approvals (multi-level workflows) — keep v1 simple but extensible

## Next Steps

1. Align with legal/compliance on minimum audit logging requirements
2. Finalize notification templates + tone with product/design
3. Secure email provider credentials for dev/staging
4. Kick off Sonnet implementation after Slice 3 merge
