# Hosted Pivot · Slice 7 Build Brief (For Sonnet 4.5)

## Objective

Harden the platform for commercial launch by strengthening observability, compliance, security posture, and performance while delivering polished user experience touches.

## Scope Overview

- Implement production-grade monitoring (metrics, traces, logs) with SLO dashboards and alerting.
- Finalize security controls: encryption key rotation, incident response, access reviews.
- Optimize performance (latency, throughput) and reliability under load.
- Deliver UI polish and usability improvements based on beta feedback.

## Deliverables

### 1. Observability Stack

- Deploy OpenTelemetry collectors + exporters (basic config) forwarding to chosen APM (e.g., New Relic/Datadog).
- Instrument:
  - API routes (latency, error rate)
  - Workers (queue wait time, job duration, failure counts)
  - LLM calls (token usage, success/error ratios)
- Create Grafana (or equivalent) dashboards for:
  - Service health (p95 latency, error rate)
  - Queue health and DLQ volume
  - Tenant-level usage trends
- Define SLOs (e.g., 99% chat latency < 4s) and configure alerting rules

### 2. Security & Compliance

- Implement encryption key rotation for tenant keys (`@ocsuite/crypto`):
  - Key versioning scheme stored in DB
  - Rotation job that re-encrypts secrets and updates metadata
- Add access logging for admin actions + sensitive endpoints
- Conduct threat modeling session (document outcomes in `docs/security-review.md`)
- Draft incident response runbook (roles, escalation paths, communication templates)
- Integrate automated dependency scanning (GitHub Dependabot or similar)

### 3. Performance & Scale

- Load testing scripts (k6 or artillery) covering chat, board meetings, task execution, knowledge uploads
- Optimize hotspots identified (e.g., add indexes, cache persona prompts)
- Implement autoscaling hooks (documented) for workers and API (e.g., horizontal pod autoscaler configuration references)
- Introduce backpressure safeguards (rate limiters, queue depth alarms)

### 4. UX Polish & Accessibility

- Apply design refinements across dashboard (consistent spacing, typography, iconography)
- Accessibility audit: ensure WCAG AA for key flows (keyboard nav, contrast, aria labels)
- Add global search (Ctrl+K) for quick navigation between conversations, tasks, and docs
- Provide rich onboarding checklist with progress tracking
- Localize core UI strings (English default, structure ready for translations)

### 5. Compliance & Readiness

- Prepare data retention/export policy documentation
- Implement privacy settings per tenant (toggle telemetry, data residency preferences)
- Add legal pages (Terms, Privacy) accessible from app footer (placeholders acceptable if legal text pending)

### 6. Testing & Verification

- Regression test suite covering all critical flows; integrate with CI for weekly full runs
- Security tests (lint for secrets, OWASP ZAP scan script)
- Performance baseline report summarizing target metrics vs actual (stored in repo)

### 7. Documentation & Launch Prep

- Update master README + marketing docs to reflect production readiness
- Compile "Go-Live" checklist (in `docs/launch-checklist.md`) covering infra, monitoring, support, comms
- Provide runbooks for on-call rotation (incident handling, alert triage)
- Final Loom/demo script for the polished experience

## Acceptance Criteria

1. Observability dashboards live with defined SLO alerting and sample alerts tested
2. Key rotation executes successfully in staging without downtime
3. Load tests meet or exceed target performance metrics
4. Accessibility checks pass (document issues + fixes)
5. All documentation updated; launch checklist reviewed with stakeholders

## Risks & Open Questions

- Balancing effort between polish and deep security work — prioritize compliance must-haves
- Ensuring key rotation is safe and reversible
- Tooling costs for observability/APM vendors

## Next Steps

1. Select observability tooling stack and finalize budget
2. Align with security/legal on compliance deliverables and review schedule
3. Plan performance testing windows to avoid impacting shared resources
4. Kick off Sonnet implementation after Slice 6 stabilization
