# Observability Stack

Phase 7 introduces a production-ready observability foundation that instruments the API and worker runtime with OpenTelemetry and streams data to your chosen APM. This folder documents the configuration surface, dashboards, and alerting strategy required for go-live.

## Components

- **OpenTelemetry Node SDK** – Auto-instruments Express, HTTP, Postgres, and BullMQ (Redis) to emit traces and metrics.
- **OTLP Export** – Traces and metrics are pushed to the endpoint defined by `OTEL_EXPORTER_OTLP_ENDPOINT`.
- **BullMQ Metrics** – Custom gauges export queue depth and processing throughput for each queue/DLQ.
- **Worker Metrics** – Job success/failure counters and duration histograms per queue.
- **SLO Catalogue** – See `slo-catalog.md` for target objectives and alert thresholds.
- **Grafana Dashboards** – JSON definitions to import into your observability platform (Datadog, Grafana, New Relic, etc.).

## Environment Variables

| Variable | Description |
| --- | --- |
| `OBSERVABILITY_ENABLED` | Set to `true` to start the OpenTelemetry SDK. |
| `OBSERVABILITY_SERVICE_NAME` | Optional service name override (defaults to `ocsuite-api`). |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Base URL for OTLP ingestion (e.g. `https://otlp-gateway.example.com`). |
| `OTEL_EXPORTER_OTLP_HEADERS` | Comma-separated key=value headers for OTLP auth. |
| `OBSERVABILITY_METRIC_INTERVAL_MS` | Metric export interval (default `15000`). |
| `OTEL_LOG_LEVEL` | Override OpenTelemetry diagnostic logging (default `warn`). |

These variables are consumed by `apps/api/src/observability/telemetry.ts`. The worker process reuses the same configuration and tags its service name with the `-workers` suffix for easier filtering.

## Deployment Steps

1. Provision an OTLP ingest endpoint (e.g. Datadog, New Relic, Lightstep, Grafana Agent).
2. Configure environment variables in your infrastructure secret manager.
3. Import the Grafana dashboards in `dashboards/` (update the data source UID after import).
4. Enable alert rules listed in `alerting-rules.md` within your monitoring platform.
5. Run the validation checklist below to confirm telemetry reaches the backend before go-live.

## Validation Checklist

Use this sequence each time observability is enabled in a new environment.

1. **Smoke requests** – run `pnpm --filter api telemetry:smoke -- --base-url=https://staging.api.example.com` to exercise health, chat, and queue endpoints (see script in `apps/api/scripts/telemetry-smoke.ts`).
2. **Trace delivery** – confirm new traces appear in the APM for route `/c-suite/ceo/chat` with the staging release tag.
3. **Metric export** – in Grafana, load `dashboards/api-service.json` and `dashboards/queue-operations.json`; verify panels populate within one export interval (`OBSERVABILITY_METRIC_INTERVAL_MS`).
4. **Alert dry run** – temporarily lower the backlog threshold to trigger `Queue Backlog` alert, verify notification routing, then revert.
5. **Documentation** – capture screenshots of the two dashboards and attach them to the incident runbook for future reference.

## Related Artifacts

- `slo-catalog.md` – SLO definitions, thresholds, and owner assignments.
- `alerting-rules.md` – Alert policy blueprint with runbook links and example Prometheus queries.
- `deployment-checklist.md` – Step-by-step guide for enabling telemetry in a new environment.
- `load-test-plan.md` – Repeatable playbook for exercising chat workloads under load.
- `runbooks/` – Incident playbooks for each critical alert (chat latency, API error budget, queue backlog, knowledge sync, board pipeline).
- `dashboards/api-service.json` – Grafana dashboard focusing on API latency, error rate, and resource usage.
- `dashboards/queue-operations.json` – Queue health overview (depth, failures, job duration).

After import, update the dashboard data source references to match your Grafana instance and create alert rules from the provided templates.
