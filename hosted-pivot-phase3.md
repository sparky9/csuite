# Hosted Pivot · Slice 3 Build Brief (For Sonnet 4.5)

## Objective

Elevate the experience from single-agent chat to a collaborative, multi-persona "board meeting" that synthesizes insights across modules and delivers coordinated guidance with clear action items.

## Scope Overview

- Introduce orchestrated board sessions featuring CEO, CFO, CMO, and CTO personas with tailored prompts and shared context.
- Build the meeting runtime that fans out to multiple LLM calls, synthesizes results, and streams them to the UI.
- Capture action items, decisions, and follow-up tasks produced during meetings.
- Expand telemetry so we can measure meeting quality, token usage per persona, and downstream engagement.

## Deliverables

### 1. Persona Intelligence Layer

- Persona configuration file (`packages/module-sdk/personas.json`) defining tone, expertise, and required context inputs for CEO, CFO, CMO, and CTO.
- Prompt builder service (`apps/api/src/services/persona-prompts.ts`) that assembles persona prompts using:
  - Tenant business profile
  - Latest module insights (Growth Pulse + future modules)
  - Analytics snapshots + notable trends
- Persona response guardrails:
  - Enforce max tokens + streaming chunk size per persona
  - Content filter stub (e.g., regex/keyword blocklist) with logging to revisit later

### 2. Board Meeting Orchestrator

- New API entrypoint `POST /c-suite/board-meeting` (replacing placeholder) that:
  - Validates meeting agenda configuration (default agenda acceptable)
  - Fans out persona calls in serial/parallel depending on dependencies
  - Streams interim updates via SSE/WebSocket:
    - `agenda` events as sections progress
    - `persona-response` events for each persona
    - `summary` event with final synthesis
- Orchestrator worker (`apps/api/src/workers/board-meeting.worker.ts`) encapsulating LLM calls, retry policy, and cancellation handling.
- Meeting transcript persistence in new tables:
  - `BoardMeeting` (id, tenantId, startedAt, endedAt, agenda, outcomeSummary, tokenUsage)
  - `BoardPersonaTurn` (meetingId, persona, content, metrics, order)
  - `BoardActionItem` (meetingId, title, description, status, owner, dueDate)

### 3. Frontend Meeting Experience

- New route `apps/web/src/app/(dashboard)/board/page.tsx` with:
  - Agenda timeline showing in-progress persona updates (animated streaming slots)
  - Highlights column summarizing key wins, risks, and blockers
  - Action items list with owners + due dates; ability to mark as done or hand off to execution (placeholder button wires to tasks page)
- Add ability to replay past meetings:
  - Meeting history panel with filter by persona or timeframe
  - Detail drawer showing transcript and action items
- Integrate meeting CTA on dashboard + chat ("Prep board meeting" button) launching orchestrator

### 4. Action Item Lifecycle

- Extend `Task` model with relation to `BoardActionItem` (or store reference fields) to support later execution flow.
- Allow users to assign owners (search members) and set due dates via board UI; persist to DB.
- Expose API endpoints:
  - `GET /board/meetings` (paginated)
  - `GET /board/meetings/:id`
  - `PATCH /board/action-items/:id` for status/owner updates

### 5. Telemetry & Analytics

- Capture metrics per meeting:
  - Persona token usage (prompt/completion)
  - Meeting duration
  - Count of action items by severity
  - User feedback rating (simple 1-5 survey at end)
- Store aggregated metrics in `BoardMeeting` metadata JSON
- Add dashboard widgets for "Last board meeting" summary + rating

### 6. Testing & Reliability

- Unit tests for prompt builder and orchestrator planner (mock LLM responses)
- Integration tests verifying persona fan-out order and SSE payload structure
- RLS coverage for new tables
- Replay test fixtures to ensure transcripts render deterministically

### 7. Documentation & DX

- Document persona definition process and how to add new personas (`docs/persona-playbook.md`)
- Update README and Phase roadmap to mention meeting capabilities
- Provide seed script (`pnpm seed:slice3`) generating sample meetings + transcripts for demo tenants

## Acceptance Criteria

1. Running `pnpm seed:slice3 && pnpm dev` allows a dev to:
   - Launch a board meeting from the dashboard and watch personas stream insights
   - See action items generated and assign them to team members
   - View meeting history and replay transcripts
2. Meeting data respects tenant isolation (verified by tests attempting cross-tenant access)
3. Telemetry endpoints show token usage per persona and store ratings
4. Tests pass (`pnpm test`) and code meets lint/typecheck standards

## Risks & Open Questions

- Persona prompt collisions leading to repetitive recommendations
- Streaming complexity (multiple personas streaming simultaneously) — ensure front-end handles interleaving gracefully
- Action item ownership requires user directory; confirm Clerk metadata suffices or fetch from future org directory

## Next Steps

1. Align prompt styles with product leadership before coding
2. Secure Fireworks budget for multi-persona calls (estimate 3x token usage)
3. Define meeting agenda template (sections, data inputs) with stakeholders
4. Kick off Sonnet implementation once Phase 2 is merged and seeded
