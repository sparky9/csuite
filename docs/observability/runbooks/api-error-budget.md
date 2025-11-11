# API Error Budget Runbook

**Related Alert**: API Error Rate (5xx > 1%)

## 1. Immediate Actions
- Acknowledge alert in Slack `#oncall`.
- Capture the incident start time and affected environment (prod vs staging).
- Pause automated deploys if within the release window.

## 2. Diagnostics
1. **Dashboard Review**
   - Open the `API Reliability` Grafana dashboard.
   - Identify which routes exhibit elevated 5xx counts.
2. **Trace Inspection**
   - Filter OpenTelemetry traces by status `error` and route(s) identified above.
   - Note the exception type and stack traces.
3. **Error Logs**
   - Check centralized logs (e.g., Datadog, Loki) for matching request IDs.
   - Verify whether errors correlate with specific tenants or feature flags.
4. **Dependency Check**
   - Redis/Postgres health metrics for increased latency or saturation.
   - Downstream service status (LLM providers, integrations).
5. **Recent Changes**
   - Review the CI/CD pipeline for deployments or configuration changes within the past hour.

## 3. Mitigation Steps
- **Regression from deployment**: roll back to the previous stable release (`pnpm --filter api deploy:rollback`).
- **Configuration or secret drift**: restore from last known-good secret version; validate `OTEL_EXPORTER_OTLP_*` endpoints are reachable.
- **Third-party outage**: activate degraded mode flag to bypass affected feature; communicate downtime to customer success.
- **Database errors**: run migration rollback if new schema causing errors; consider failover to read replica for read-heavy workloads.
- **Rate limiting**: raise concurrency limits temporarily or queue requests using circuit-breaker config.

## 4. Validation
- Ensure 5xx error ratio drops below 0.2% over the next 15 minutes.
- Confirm no new error spikes in logs.
- Remove any temporary mitigations once stability confirmed.

## 5. Post-Incident Tasks
- Document root cause, impact, and resolution in incident tracker.
- Add regression/unit tests that reproduce the failure scenario.
- Schedule design review if systemic issue exposed (e.g., missing retries, poor backoff handling).
