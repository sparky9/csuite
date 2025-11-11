# Chat Latency Runbook

**Related Alert**: API Latency Burn (P99 > 4s)

## 1. Immediate Actions
- Acknowledge the alert in PagerDuty/Slack.
- Confirm the time window and impacted tenants via the dashboard `API > Chat Latency`.
- Post a status notice in `#oncall` with current status and assigned engineer.

## 2. Diagnostics
1. **Check Recent Deployments**
   - Review the latest release notes in `apps/web` and `apps/api`.
   - If a deploy happened within the past hour, consider triggering canary rollback.
2. **Inspect API Traces**
   - Filter OpenTelemetry traces for `POST /c-suite/chat`.
   - Identify spans with unusually long duration; note external dependencies (LLMs, Redis, Postgres).
3. **Review Dependency Health**
   - Redis: verify latency in `redis_latency` panel; ensure connection pool saturation < 80%.
   - Postgres: check `pg_stat_activity` for blocking queries; confirm CPU utilization < 70%.
   - LLM Provider: check provider status page; validate API quota usage.
4. **Worker Metrics**
   - Ensure `sync-connector` and `execute-task` queues are within normal backlog. Excess backlog can increase API response times due to synchronous waits.

## 3. Mitigation Steps
- **If recent deploy**: trigger rollback via `pnpm --filter web deploy:rollback` (or relevant pipeline command).
- **If Redis saturation**: scale Redis tier or flush ephemeral caches; consider temporarily routing read-heavy operations to stale-safe mode.
- **If Postgres contention**: kill offending long-running query; escalate to DB on-call for index tuning.
- **If LLM degradation**: switch to secondary model (`AZURE_OPENAI_FALLBACK`) via feature flag.
- **If workers blocked**: add temporary worker replica (`pnpm --filter workers deploy -- --scale=+1`).

## 4. Validation
- Monitor the latency panel to ensure P99 recovers below 2s for 10 consecutive minutes.
- Confirm error rate remains <1% during recovery.
- Update PagerDuty/Slack with recovery confirmation.

## 5. Post-Incident Tasks
- Open a retro ticket in Linear (`type: Incident`).
- Attach trace IDs, Grafana screenshots, and root cause notes.
- Schedule follow-up for any infrastructure changes (e.g., add Redis shard, refactor slow query).
