# Autoscaling Reference (Phase 7)

This guide outlines recommended Horizontal Pod Autoscaler (HPA) settings for the API and worker deployments once telemetry is live.

## API Deployment
- **Metric Source**: Prometheus Adapter scraping OTLP-exported metrics (`http.server.duration`, CPU utilisation).
- **Targets**:
  - CPU: 70%
  - Request latency: p95 < 4s (informational, tie to alerting rather than scaling to avoid thrash).
- **HPA Example**:
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Pods
      pods:
        metric:
          name: http_server_duration_p95
        target:
          type: AverageValue
          averageValue: 4000m # 4 seconds in milliseconds
```
> Use external metrics if your Prometheus adapter exposes latency. Otherwise rely on CPU + queue depth.

## Worker Deployment
- **Metric Source**: Custom queue depth gauges (`ocsuite.queue.depth`) exported to Prometheus.
- **Targets**:
  - Maintain queue depth < 100 for `execute-task`.
  - Scale up when average job duration exceeds 60 seconds.
- **HPA Example**:
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: workers
  minReplicas: 2
  maxReplicas: 15
  metrics:
    - type: Pods
      pods:
        metric:
          name: ocsuite_queue_depth_execute_task
        target:
          type: AverageValue
          averageValue: 50
```

## Backpressure Safeguards
- Configure API rate limiter (`express-rate-limit`) with deployment-specific thresholds (see `apps/api/src/middleware/rate-limit.ts`).
- Add SQS/SNS or PagerDuty alert when queue depth sustained > 500 for 10 minutes.

## Change Management
- Store manifests in infrastructure repo.
- Test scaling in staging using the load test script (`pnpm --filter api loadtest:chat`).
- Document results in `docs/testing/performance-baseline.md` and update alert thresholds as needed.
