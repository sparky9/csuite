# Go-Live Readiness Checklist

This checklist must be reviewed and signed off before promoting a new environment to production. It captures the operational hardening deliverables from Phase 7.

## 1. Infrastructure & Config
- [ ] Production environment variables populated (API, workers, collectors, queues)
- [ ] Prisma migrations applied, including `20251107090000_add_access_logs`
- [ ] Redis and PostgreSQL backups enabled with documented retention
- [ ] Feature flags reflect launch scope; undeployed modules disabled

## 2. Observability
- [ ] `OBSERVABILITY_ENABLED=true` with valid OTLP endpoint and headers
- [ ] Dashboards imported (`docs/observability/dashboards/*.json`) and data source mapped
- [ ] Alert rules from `docs/observability/alerting-rules.md` configured and tested
- [ ] Telemetry smoke (`pnpm --filter api telemetry:smoke`) executed; traces visible in APM
- [ ] Load test (`pnpm --filter api loadtest:chat`) executed with results archived in `docs/testing/performance-baseline.md`

## 3. Security
- [ ] Access log migration applied; `access_logs` table receiving entries in staging
- [ ] `ACCESS_LOG_RETENTION_DAYS` set and `access-log:prune` scheduled
- [ ] Key rotation dry run completed (`pnpm --filter api encryption:rotate -- --dry-run`)
- [ ] Threat model (`docs/security/threat-model.md`) reviewed and updated
- [ ] Incident response playbook (`docs/security/incident-response.md`) circulated to on-call team
- [ ] Dependabot alerts reviewed; security scanners (OWASP ZAP, secret scan) executed per `docs/security/security-scanning.md`

## 4. Compliance & Privacy
- [ ] Data retention and export policy signed off (`docs/compliance/data-retention-policy.md`)
- [ ] Legal pages (Terms, Privacy) linked in production footer
- [ ] Tenant privacy settings toggles verified (telemetry opt-out, residency notes)
- [ ] Access log export procedure documented for incident handling

## 5. Product & UX
- [ ] Onboarding checklist verified with production sample tenant
- [ ] Accessibility spot check performed; issues logged
- [ ] Global search shortcuts tested on target browsers
- [ ] Localization scaffolding validated (strings extracted, ready for translations)

## 6. Support & Operations
- [ ] On-call rotation assigned; contact list current in company wiki
- [ ] Support macros prepared for launch FAQs
- [ ] Status page updated with new service components
- [ ] Demo script / Loom recording stored in shared drive and linked from `docs/README.md`

## 7. Sign Off
- [ ] Engineering Lead:
- [ ] Product Lead:
- [ ] Support Lead:
- [ ] Security Lead:
- [ ] Date:

Archive the completed checklist alongside the release notes for auditing purposes.
