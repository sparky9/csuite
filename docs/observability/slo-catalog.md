# Service Level Objectives

The following SLOs anchor operational readiness for the Online C-Suite platform. Metrics reference OTLP signals emitted by the API and worker processes after the Phase 7 observability integration.

## 1. Chat Response Latency
- **Service**: `ocsuite-api`
- **Objective**: 99% of `/c-suite/:persona/chat` requests complete in < 4 seconds measured over a 7-day rolling window.
- **Metric**: `http.server.duration` (p99) filtered by route label `c-suite.chat`.
- **Alert Trigger**: 4-hour burn rate ≥ 2 * budget (equivalent to p99 > 4s for two consecutive 5-minute windows).
- **Runbook**: `../runbooks/chat-latency.md`

## 2. API Error Rate
- **Service**: `ocsuite-api`
- **Objective**: Maintain < 1% 5xx responses over 1 hour.
- **Metric**: `http.server.request.duration` counts grouped by status.
- **Alert Trigger**: Rolling 15-minute window of 5xx / total > 0.01.
- **Runbook**: `../runbooks/api-error-budget.md`

## 3. Queue Processing Freshness
- **Service**: `ocsuite-api-workers`
- **Objective**: 95% of jobs in `execute-task`, `sync-connector`, and `trigger-runner` processed within 2 minutes of enqueue.
- **Metric**: Custom histogram `ocsuite.queue.job.duration` with attribute `queue`.
- **Alert Trigger**: 15-minute p95 job duration > 120000 ms for any queue label.
- **Runbook**: `../runbooks/queue-backlog.md`

## 4. Board Meeting Pipeline Availability
- **Service**: `ocsuite-api`
- **Objective**: 99.5% success rate for `POST /c-suite/board-meeting` over 24 hours.
- **Metric**: Express instrumentation spans tagged with route `board-meeting.create` success status.
- **Alert Trigger**: Error budget burn rate 2x target over 30 minutes OR failure rate > 2% for 10 minutes.
- **Runbook**: `../runbooks/board-pipeline.md`

## 5. Knowledge Sync Completeness
- **Service**: `ocsuite-api-workers`
- **Objective**: < 3% job failures for `sync-analytics` and `sync-connector` queues in 24 hours.
- **Metric**: Counter `ocsuite.queue.job.failure` grouped by queue.
- **Alert Trigger**: Failures > threshold (3%) in weighted rolling 1h.
- **Runbook**: `../runbooks/knowledge-sync.md`

Each SLO references a corresponding alert definition in `alerting-rules.md` and must be reviewed quarterly with the GTM and support teams.
