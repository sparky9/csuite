# Performance Baseline Report Template

Use this template to capture load test evidence before each major release. Store completed copies alongside release notes.

## Environment
- Deployment: `staging` / `pre-prod` / `prod`
- API commit SHA:
- Worker commit SHA:
- Database version:
- Date:

## Test Inputs
| Parameter | Value |
| --- | --- |
| Base URL | |
| Auth token | |
| Tenant | |
| Iterations | |
| Concurrency | |
| Prompt | |

Command executed:
```
pnpm --filter api loadtest:chat -- --base-url=https://... --iterations= --concurrency= --bearer=*** --tenant-id=
```

## Results
| Metric | Value |
| --- | --- |
| Success count | |
| Failure count | |
| Average latency | |
| p95 latency | |
| p99 latency | |
| Error rate | |

### Grafana Observations
- API latency panel screenshot link:
- Queue operations panel screenshot link:
- Alert status (attach export if triggered):

## Findings & Actions
- Bottlenecks observed:
- Mitigations applied / planned:
- Autoscaling adjustments:
- Alert threshold updates:

## Approval
- Performance Engineer:
- Operations Lead:
- Date:
