# Board Meeting Pipeline Runbook

**Related Alert**: Board Meeting Pipeline Degradation (success ratio < 98%)

## 1. Immediate Actions
- Acknowledge alert in Slack `#board-pipeline`.
- Verify whether the degradation affects scheduled executive briefings; notify customer success if exec deliveries are at risk.
- Suspend non-critical batch jobs that compete for the same resources.

## 2. Diagnostics
1. **Route & Worker Overview**
   - Dashboard `Board Meeting Pipeline` to determine which stage (API route vs worker) is failing.
   - Review recent deployments to `apps/api` (board meeting endpoints) and `apps/workers` (`board-meeting.worker`).
2. **Trace Analysis**
   - Filter traces for `POST /c-suite/board-meeting`; inspect span errors and latency.
3. **Queue Health**
   - Confirm `board-meeting` queue backlog, failure counts, and job duration metrics.
4. **External Dependencies**
   - Check slides generator (Canva/Google Slides) API status.
   - Validate access to CRM/OKR data sources used in the pipeline.
5. **Data Integrity**
   - Inspect recent payloads for schema changes or missing fields introduced upstream.

## 3. Mitigation Steps
- **Regression from release**: roll back board meeting service changes.
- **External provider outage**: enable cached summary mode by toggling `BOARD_MEETING_FALLBACK` feature flag.
- **Data schema drift**: coordinate with source team; hotfix transformation to handle new fields.
- **Worker saturation**: scale worker replicas handling board meeting queue.
- **Job retries**: requeue failed jobs after mitigation using `scripts/requeue-board-meeting.ts`.

## 4. Validation
- Confirm success ratio > 99% for 30 minutes.
- Ensure dashboards show backlog cleared and latency within baseline.
- Update `#board-pipeline` channel with recovery timeline.

## 5. Post-Incident Tasks
- Record incident in Linear with attached traces and metrics.
- Schedule postmortem if executive communications were impacted.
- Review automation coverage and consider chaos testing for pipeline dependencies.
