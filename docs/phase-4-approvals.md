# Phase 4 · Action Approvals & Execution Governance

Phase 4 introduces the automation guardrails that let tenants review, approve, and monitor AI-initiated workflows before they touch production systems.

## Capabilities Added

- **Action Approval Service** – Prisma model (`ActionApproval`) and REST endpoints to submit, review, approve, reject, and audit recommended actions.
- **Execution Router Worker** – BullMQ worker that dequeues approved actions, resolves module capabilities via `@ocsuite/module-sdk`, enforces idempotency, and writes audit + task results.
- **Preview & Risk UI** – `/actions` dashboard inbox with risk badges, payload preview, audit timeline, and approval controls wired to the API.
- **Notifications** – Persistent `Notification` table, in-app feed, email preference toggles, and toast/badge hooks triggered on submission, decisions, and execution outcomes.
- **Audit & Compliance Hooks** – Owner/Admin audit endpoint, `ActionApproval.auditLog` lifecycle events, and `Task.actionApprovalId` linkage for downstream observability.

## Approval Workflow

1. **Submit** – Modules (or the board UI) call `POST /actions/submit` with a structured payload. The API:
   - Calculates risk heuristics (module, capability, impact, connectors, flags).
   - Persists the pending approval and seeds audit history.
   - Notifies tenant owners/admins (respecting notification preferences).
2. **Review** – Approvers open the `/actions` inbox in the web app:
   - Risk badges and reasons explain the score.
   - Preview drawer shows the structured payload and audit timeline.
   - Optional comment captured for both approve and reject.
3. **Decision**
   - `POST /actions/:id/approve` validates state, records audit entry, creates or refreshes an `action-execution` task, and enqueues the worker job (idempotent by payload hash).
   - `POST /actions/:id/reject` marks the record rejected and notifies the requester.
4. **Execute** – `action-executor.worker.ts` pulls the job, resolves the module capability, streams progress to the task SSE channel, and records completion or failure in both the audit log and `tasks` table. Undo payload (if supplied) is stored for future rollback work.
5. **Audit & Notifications** – Owners/admins can inspect `GET /actions/audit/:id` for full lifecycle detail. Requesters receive in-app/email alerts on approval and execution results.

## Risk Scoring Reference

| Signal | Effect | Reason Code |
| ------ | ------ | ----------- |
| Module slug contains `finance`/`billing` | +20 | `module finance-heavy` |
| Capability includes `delete`/`sync` | +15 | `capability modifies data` |
| Impact/Scope mentions `mass`, `global`, `all tenants` | +25 / +15 | `high described impact`, `broad scope` |
| Connectors array length | up to +20 | `multiple connectors affected` |
| Explicit `risk` tag (`high`/`medium`) | +25 / +10 | `module flagged high risk`, `module flagged medium risk` |
| Flags referencing PII/PHI/financial | +20 | `touches sensitive data` |
| Source includes `automated` | +10 | `automated source` |

Scores clamp to `0–100` and map to levels: `≤33` low, `34–66` medium, `≥67` high.

## API Surface

| Endpoint | Description |
| -------- | ----------- |
| `POST /actions/submit` | Create pending approval; returns approval + risk assessment. |
| `GET /actions/pending` | List approvals (default `status=pending`; supports risk filters). |
| `POST /actions/:id/approve` | Approve and enqueue execution; returns approval, task, job metadata. |
| `POST /actions/:id/reject` | Reject with optional comment. |
| `GET /actions/:id/audit` | Owner/Admin-only detailed audit trail. |

Notifications API (`/notifications`) gained stats, pagination, mark-read, and preference endpoints used by the dashboard badge and settings screen.

## Seed & Demo Data

Run `pnpm seed:slice4` to load the demo tenant:

- Two pending approvals (high + medium risk).
- Executing and executed examples wired to demo tasks.
- Notifications for founder/ops users with email & Slack (stub) preferences.

## Testing

New coverage added in Phase 4:

- `apps/api/tests/unit/utils/risk-scoring.test.ts` – Risk heuristics.
- `apps/api/tests/unit/services/action-approvals.test.ts` – Submit/approve/reject flows, filtering, queue + notification hooks.
- `apps/api/tests/unit/workers/action-executor.worker.test.ts` – Execution success, idempotency, and failure handling with mocked module capability.
- `apps/api/tests/integration/actions.test.ts` – REST endpoints with RLS enforcement, audit access control.

## Load Testing Plan (Summary)

See `docs/phase-4-load-test-plan.md` for the scripted k6 scenario that stresses the approval queue (500 pending approvals, sustained 5 QPS) and monitors worker throughput + Redis latency.

## Troubleshooting

| Symptom | Likely Cause | Mitigation |
| ------- | ------------ | ---------- |
| `409 invalid_state` when approving | Approval already decided. | Refresh inbox, ensure idempotent client handling. |
| Execution worker immediately fails | Module capability missing or threw. | Check approval payload for `moduleSlug`/`capability`. Inspect audit log failure metadata. |
| Requester never notified | Notification preference disabled or no `userId` match. | Ensure submitter Clerk ID is enrolled as a tenant member; check notification preferences. |
| Audit endpoint returns 403 | Caller must be `owner` or `admin`. | Elevate role via tenant membership or use owner token. |

## Next Steps

- Implement rollback execution using stored `undoPayload`.
- Wire Slack channel delivery once OAuth connector launches.
- Extend approvals to support multi-step reviewer chains (metadata already prepared). |
