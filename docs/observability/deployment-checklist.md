# Phase 7 Observability Deployment Checklist

Use this checklist when enabling telemetry in a new environment (staging, pre-prod, production).

## Pre-Deployment
- [ ] Confirm OTLP endpoint credentials (URL, API key) are available in the secret manager.
- [ ] Validate Redis and Postgres endpoints are reachable from the API and worker pods.
- [ ] Ensure `OBSERVABILITY_ENABLED=true` and `OBSERVABILITY_SERVICE_NAME` overrides (if any) are staged in infrastructure code.
- [ ] Provision Grafana (or target APM) workspace with required data source permissions.

## Deployment Steps
- [ ] Roll out configuration changes (Helm/Kubernetes/Terraform) with the new environment variables.
- [ ] Restart API and worker workloads to load the OpenTelemetry SDK.
- [ ] Import dashboards located in `docs/observability/dashboards/` and replace the datasource UID token.
- [ ] Import alert rules in `docs/observability/alerting-rules.md` into the monitoring platform.

## Post-Deployment Validation
- [ ] Run `pnpm --filter api telemetry:smoke -- --base-url=<env-url> --bearer=<token>` to generate sample traces.
- [ ] Confirm `ocsuite_http_requests_total` increases in the metrics backend for the staging release tag.
- [ ] Verify `Queue Operations` dashboard panels populate for each active queue.
- [ ] Trigger a soft alert test by lowering the backlog threshold and confirm Slack/PagerDuty wiring.
- [ ] Capture screenshots of the dashboards and attach them to the relevant runbooks.

## Handover
- [ ] Update `docs/observability/runbooks/*.md` with any environment-specific notes.
- [ ] Record alert IDs and escalation paths in the on-call wiki.
- [ ] Schedule quarterly review of SLO thresholds with product and reliability owners.
