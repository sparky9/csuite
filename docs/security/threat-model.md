# Phase 7 Threat Model

## Overview
The OC-Suite platform consists of a multi-tenant Node.js API, BullMQ workers, PostgreSQL, Redis, and third-party SaaS integrations. Authentication is provided by Clerk, and encryption for tenant secrets relies on the `@ocsuite/crypto` package with versioned master keys.

## Assets
- Tenant configuration: connector tokens, knowledge entries, analytics data.
- LLM interactions: prompts, generated insights, token usage.
- Admin functions: conversation exports, module insights, marketplace installs.
- Infrastructure credentials: database, Redis, OTLP exporter secrets.

## Roles & Trust Boundaries
- **End Users** – Authenticated through Clerk; access constrained by tenant context.
- **Operations/Admins** – Elevated privileges via admin routes; must be audited.
- **Background Workers** – Execute jobs using service accounts; trusted network boundary.
- **Third Parties** – External APIs (LLM, analytics) accessed via egress network.

Network boundaries:
1. External clients → API (TLS termination at load balancer).
2. API ↔ PostgreSQL/Redis (private VPC).
3. API/workers ↔ third-party APIs (outbound over HTTPS).
4. API/workers ↔ OTLP collector (private or authenticated endpoint).

## Threat Scenarios & Mitigations

| Threat | Vector | Impact | Mitigation |
| --- | --- | --- | --- |
| Credential reuse | Compromised connector refresh token | Tenant data breach | Secrets encrypted with versioned keys; rotation script (`apps/api/scripts/rotate-encryption-keys.ts`); monitor access logs. |
| Tenant breakout | Missing tenant filters on queries | Cross-tenant data leakage | Prisma multi-tenant clients, RLS policies (`packages/db/SECURITY.md`), knowledge ingestion/export validation scripts. |
| Privilege abuse | Admin exporting knowledge without audit | Compliance violation | Persistent access logs (`access_logs` table), runbooks for incident response, Clerk role checks. |
| Queue overload | Poison messages or backlog | Degraded SLA | Queue metrics/alerts + runbook (`docs/observability/runbooks/queue-backlog.md`), backpressure controls. |
| LLM prompt injection | Malicious tenant content influences insights | Incorrect decisions | Sanitize inputs, maintain audit events of generated actions, human approval via `ActionApproval` workflow. |
| Supply chain (npm) | Malicious dependency update | Remote Code Execution | Lockfile pinning, CI `pnpm audit --audit-level=moderate`, Renovate/Dependabot review. |
| OTLP exfiltration | Telemetry sending PII in clear text | Data leakage | Limit attributes (route templates, tenant IDs), allowlist tokens, TLS to collector. |
| Lost keys | Master key exposure | All tenant secrets compromised | ENV isolation per environment, key rotation procedure, minimal surface area (no logging of secrets). |
| Incident response gap | Slow breach handling | Regulatory fines | Incident runbook (this phase), on-call escalation matrix. |
| Misconfigured access | Public endpoints lacking auth | Unauthorized operations | `requireAuth` middleware, per-route guards, automated smoke tests for secure endpoints. |

## Recommended Enhancements
1. Automate access log retention pruning and reporting cadences (`pnpm --filter api access-log:prune`).
2. Automate quarterly key rotation via scheduled job.
3. Implement anomaly detection for queue failure spikes (extend Prometheus rules).
4. Expand dependency scanning to include Snyk or GitHub Advanced Security if budget allows.
5. Validate OTLP payloads in staging to ensure no sensitive content is emitted.

Appendix references:
- Architecture runbook: `docs/observability/README.md`
- Security procedures: `docs/security/encryption-key-rotation.md`
- Incident response playbook: `docs/security/incident-response.md`
