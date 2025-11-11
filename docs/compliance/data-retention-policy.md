# Data Retention & Export Policy

This policy defines how Online C-Suite stores, retains, and exports customer data in preparation for commercial launch.

## 1. Scope
- Applies to all tenant-scoped content persisted by the platform (knowledge base, conversations, action approvals, analytics snapshots, access logs).
- Covers production, staging, and disaster-recovery environments.

## 2. Retention Windows
| Data Category | Default Retention | Storage Location | Notes |
| --- | --- | --- | --- |
| Knowledge entries | Until tenant deletion or manual purge | PostgreSQL (`knowledge_entries`) / External S3 | Tenants may request record-level purge via support ticket. |
| Conversations & messages | 365 days rolling | PostgreSQL (`conversations`, `messages`) | Export available via `/conversations/:id/export`. |
| Action approvals & tasks | 730 days rolling | PostgreSQL | Provides audit history for compliance reviews. |
| Access logs | 90 days (configurable via `ACCESS_LOG_RETENTION_DAYS`) | PostgreSQL (`access_logs`) | Cleanup automated with `pnpm --filter api access-log:prune`. |
| Usage analytics | 365 days rolling | PostgreSQL (`usage_snapshots`, `analytics_snapshots`) | Aggregated metrics only; no PII stored. |
| Backups | 35 days rolling | Encrypted object storage | Weekly full, daily incremental snapshots. |

## 3. Export Procedures
- **Self-Service**: Tenants can trigger knowledge exports via admin UI (`/knowledge/export`) or API (`GET /knowledge/sources/:id/export`).
- **Compliance Requests**: Support escalates to Operations to run `pnpm --filter api scripts/export-tenant-data.ts -- --tenant <id>` (script documented in `docs/security/incident-response.md`). Outputs encrypted ZIP posted to secure bucket.
- **Incident Response**: During investigations, pull relevant rows from `access_logs` and attach to incident timeline.

## 4. Deletion
1. Tenant submits written request (support ticket).
2. Operations runs `pnpm --filter api scripts/delete-tenant.ts -- --tenant <id>`.
3. Verify RLS prevents orphan data; confirm deletion via SQL audit queries.
4. Trigger manual purge of backups older than 7 days containing the tenant (coordinate with infra team).

## 5. Configuration Management
- Retention constants trackable in `.env` and IaC modules; changes require security sign-off.
- Update this policy whenever a service introduces new persistent storage.
- Keep changelog entries referencing retention adjustments in `docs/compliance/CHANGELOG.md` (create if missing).

## 6. Responsibilities
- **Security Lead**: Ensures policy review each quarter.
- **Operations Lead**: Maintains automation jobs (access log pruning, backup lifecycle).
- **Support Lead**: Owns customer communication templates and SLAs for export/deletion requests.

## 7. References
- `docs/security/access-logs.md`
- `docs/security/incident-response.md`
- `docs/observability/README.md`
- `docs/launch-checklist.md`
