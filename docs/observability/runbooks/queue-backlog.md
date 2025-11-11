# Queue Backlog Runbook

**Related Alert**: Queue Backlog (waiting jobs > 500 or p95 duration > 2m)

## 1. Immediate Actions
- Acknowledge the alert in Slack `#ops-runtime`.
- Determine which queue(s) breached thresholds via the `Queue Operations` Grafana dashboard.
- Notify product support if customer-facing SLAs are at risk.

## 2. Diagnostics
1. **Identify Offending Queue**
   - Note queue name(s), waiting count, active count, and failure rate.
2. **Worker Capacity**
   - Check worker autoscaling status; confirm number of active workers vs desired.
   - Inspect worker logs for repeated crashes or redeploy loops.
3. **Job Payload**
   - Sample a recent job payload via BullMQ UI or Redis CLI; ensure payload size or complexity has not regressed.
4. **Dependent Services**
   - Verify external API responses (rate limits, timeouts).
   - Check database CPU and disk IO for saturation.
5. **Recent Releases**
   - Review latest merges affecting the queue's processors.

## 3. Mitigation Steps
- **Scale Workers**: increase worker replicas (`pnpm --filter workers deploy -- --scale=<queue>=+2`).
- **Restart Stuck Workers**: recycle pods/PM2 processes handling the queue.
- **Purge Poison Jobs**: if specific job type causing repeated failure, temporarily pause queue, remove offending job IDs, then resume.
- **Apply Hotfix**: deploy emergency patch if logic bug identified.
- **Throttle Producers**: enable feature flag to reduce enqueue rate until backlog clears.

## 4. Validation
- Monitor `ocsuite_queue_jobs_waiting` to ensure the waiting count drops below 100 within 30 minutes.
- Confirm job duration p95 returns to baseline (< 45s typical).
- Remove throttles or extra capacity gradually after stabilization.

## 5. Post-Incident Tasks
- Document root cause and mitigation in queue operations log.
- Add automated test or validation to prevent similar payload issues.
- Evaluate need for permanent scaling adjustments or architectural changes.
