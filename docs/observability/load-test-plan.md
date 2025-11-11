# Phase 7 Load Test Plan

Combine synthetic load with the new telemetry dashboards to validate autoscaling assumptions and alert thresholds.

## Tooling
- **Script**: `pnpm --filter api loadtest:chat`
- **Inputs**:
  - `--base-url` (required) – fully qualified API URL (e.g., `https://staging.api.example.com`).
  - `--bearer` – service token for authenticated chat requests.
  - `--tenant-id` – optional header when targeting a specific tenant.
  - `--iterations` – total chat requests to send (default 50).
  - `--concurrency` – parallel workers issuing requests (default 5).

## Execution Steps
1. **Warm-up** – Run `pnpm --filter api telemetry:smoke` to ensure the environment is ready.
2. **Baseline** – Execute `pnpm --filter api loadtest:chat -- --base-url=<url> --bearer=<token> --iterations=100 --concurrency=10`.
3. **Observe** – During the run, keep `dashboards/api-service.json` and `dashboards/queue-operations.json` open in Grafana.
4. **Record Metrics** – Capture p95/p99 latencies from:
   - Script output
   - `ocsuite_http_request_duration` histogram (API dashboard)
   - `ocsuite_queue_job_duration` histogram (Queue dashboard)
5. **Scale Evaluation** – Adjust worker/API replica counts and repeat the test to inspect improvements.
6. **Alert Verification** – Confirm `API Latency Burn` and `Queue Backlog` alerts stay below thresholds; document any tuning.

## Deliverables
- Load test summary including success/failure counts and latency percentiles.
- Screenshots of Grafana panels during peak load.
- Updated alert thresholds or autoscaling policies if required.
