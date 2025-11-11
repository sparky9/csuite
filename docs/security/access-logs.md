# Access Log Policy

Phase 7 introduces persistent access logging for sensitive API operations. Logs capture tenant, user, route, method, status code, IP, user agent, and a redacted snapshot of the request payload metadata. Records are written to the `access_logs` table and should be retained according to compliance requirements.

## Retention Configuration
- Environment variable: `ACCESS_LOG_RETENTION_DAYS` (default **90** days)
- Defined in `.env.example` and `apps/api/.env.example`
- Apply changes via infrastructure secrets manager before deployment

## Maintenance Script
Use the bundled cleanup script to prune historical records:

```powershell
# Preview rows that would be removed without deleting them
docker compose exec api pnpm --filter api access-log:prune -- --dry-run

# Delete access logs older than the retention threshold
docker compose exec api pnpm --filter api access-log:prune
```

The script processes logs in batches of 1000 to avoid long-lived transactions and reports progress via the standard API logger.

## Database Migration
The Phase 7 migration `20251107090000_add_access_logs` ships with the repo. Apply pending migrations before deploying:

```powershell
pnpm --filter db migrate deploy
```

If you rely on `prisma db push` for lower environments, re-run it after pulling the latest schema to sync the new table.

## Operational Checklist
- Schedule the cleanup script via cron or your orchestration platform (e.g., weekly run).
- Export access logs to your SIEM before pruning if longer retention is required.
- Update `docs/security/incident-response.md` with links to your log archive location.
- Review `access_logs` during security reviews or incident investigations.

## Data Model
Refer to `packages/db/prisma/schema.prisma` for the complete model definition. Each record is keyed by `id` (cuid) and maintains optional relationships to `Tenant` and `User` for auditing scope.
