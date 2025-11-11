# Knowledge Sync Runbook

**Related Alert**: Worker Failure Burst (`knowledge-retention` queue)

## 1. Immediate Actions
- Acknowledge alert in PagerDuty (medium-urgency) and notify `#oncall`.
- Identify tenant impact: check failure logs for organization IDs.
- Pause SLA-sensitive downstream jobs if necessary.

## 2. Diagnostics
1. **Worker Status**
   - Confirm `knowledge-retention.worker` processes are running; check pod/container status.
   - Review recent deploys to `apps/workers` for knowledge sync logic.
2. **Error Logs**
   - Aggregate the latest failure stack traces from centralized logging.
   - Determine if failures are deterministic (same error) or varied.
3. **External Systems**
   - Validate integration credentials (e.g., Notion, Google Drive) have not expired.
   - Check rate limit dashboards for the integrations used by affected tenants.
4. **Data Volume**
   - Inspect queue metrics for unusually large job payloads or long processing times.
5. **Database**
   - Ensure Postgres connections are healthy; no deadlocks or long-running transactions.

## 3. Mitigation Steps
- **Known Regressions**: roll back to previous worker image (`pnpm --filter workers deploy:rollback`).
- **Credential Issues**: refresh OAuth tokens via admin console; requeue failed jobs after update.
- **Rate Limits**: enable exponential backoff flag or throttle ingestion for affected tenant.
- **Data Skew**: split oversized jobs into batched tasks using `scripts/requeue-knowledge-sync.ts`.
- **Infrastructure**: restart worker pods to clear stale connections.

## 4. Validation
- Watch `ocsuite.queue.job.failure{queue="knowledge-retention"}` to ensure failure rate drops < 1/min within 15 minutes.
- Confirm successful job completions resume and backlog decreases.
- Notify stakeholders once processing normalizes.

## 5. Post-Incident Tasks
- File incident summary with root cause and tenant impact.
- Add regression tests or feature flags to prevent recurrence.
- Coordinate with integrations team if external provider issue identified.
