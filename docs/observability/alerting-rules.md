# Alerting Blueprint

Use the following alert policies as templates in your observability platform. They align with the SLO catalogue and reference the telemetry emitted by the API + worker services.

## API Latency Burn Alert
- **Metric**: `ocsuite_http_request_duration`
- **Query**: `histogram_quantile(0.99, sum(rate(ocsuite_http_request_duration_bucket{route="/c-suite/ceo/chat"}[5m])) by (le))`
- **Condition**: 5-minute windows over 30 minutes. Trigger when burn rate ≥ 2x error budget (latency > 4s).
- **Severity**: Critical
- **Notification**: Slack `#oncall`, PagerDuty high-urgency.
- **Runbook**: `../runbooks/chat-latency.md`

## API Error Rate Alert
- **Metric**: `ocsuite_http_requests_total`
- **Query**: `sum(rate(ocsuite_http_requests_total{status=~"5.."}[5m])) / sum(rate(ocsuite_http_requests_total[5m]))`
- **Condition**: 15-minute rolling aggregate, failure ratio > 0.01
- **Severity**: High
- **Notification**: Slack `#oncall`
- **Runbook**: `../runbooks/api-error-budget.md`

## Queue Backlog Alert
- **Metric**: `ocsuite_queue_jobs_waiting`
- **Query**: `max_over_time(ocsuite_queue_jobs_waiting[15m]) > 500 OR histogram_quantile(0.95, sum(rate(ocsuite_queue_job_duration_bucket[5m])) by (le, queue)) > 120000`
- **Condition**: Any queue exceeds 500 waiting jobs for 15 minutes _or_ p95 `ocsuite.queue.job.duration` > 2 minutes
- **Severity**: High
- **Notification**: Slack `#ops-runtime`
- **Runbook**: `../runbooks/queue-backlog.md`

## Worker Failure Burst
- **Metric**: `ocsuite_queue_job_failure_total`
- **Query**: `sum by (queue) (rate(ocsuite_queue_job_failure_total[10m])) > 5`
- **Condition**: Failures > 5 per minute for the same queue in any 10-minute period
- **Severity**: High
- **Notification**: PagerDuty medium-urgency
- **Runbook**: `../runbooks/knowledge-sync.md`

## Board Meeting Pipeline Degradation
- **Metric**: Success ratio for `POST /c-suite/board-meeting`
- **Condition**: Success ratio < 98% over 15 minutes
- **Severity**: High
- **Notification**: Slack `#board-pipeline`
- **Runbook**: `../runbooks/board-pipeline.md`

Document the alert IDs and integration endpoints in your internal on-call wiki once provisioned.
