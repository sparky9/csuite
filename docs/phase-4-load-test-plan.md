# Phase 4 Load Test Plan · Action Approval Pipeline

This document outlines the performance and resilience exercise for the action approval queue and execution worker introduced in Slice 4.

## Objectives

1. Validate that the approval API handles burst submissions (≤ 200 requests/minute) without 5xx responses.
2. Confirm BullMQ action executor keeps latency under 2 minutes for high-volume approvals (≥ 500 pending).
3. Measure Redis and Postgres resource utilisation under sustained load.

## Test Harness

- **Tooling**: [k6](https://k6.io) + TypeScript script in `scripts/load/phase4-approvals.ts` (Sonnet to add alongside test harness).
- **Target**: `/actions/submit`, `/actions/pending`, `/actions/:id/approve` against staging environment.
- **Authentication**: Clerk test tokens seeded via environment variables (`PHASE4_APPROVER_TOKEN`, `PHASE4_REQUESTER_TOKEN`).
- **Data Seeding**: `pnpm seed:slice4` followed by `scripts/load/reset-approvals.ts` (drops existing approvals/tasks/notifications for target tenant).

## Scenario Overview

| Phase | Duration | Virtual Users | RPS Goal | Notes |
| ----- | -------- | ------------- | -------- | ----- |
| Warm-up | 2 min | 10 | ~5 | Submit + list approvals to prime caches. |
| Spike | 5 min | 50 | ~30 | Submit 150 approvals/minute while polling `/actions/pending`. |
| Steady | 10 min | 25 | ~10 | Approve 300 approvals total while worker drains queue. |
| Cool down | 3 min | 5 | ~2 | Monitor lingering jobs and API tail latency. |

## Metrics to Capture

- **API**: p95 latency, error rate (400/409 expected within 1%), throughput per endpoint.
- **Queue**: Waiting + active jobs, average processing time (`BullMQ` metrics + custom logs).
- **Worker**: `action-executor` completion/failure counters, skip counts, and duration (already exported via `metrics.js`).
- **Database**: Postgres CPU + connections; check for RLS-related slow queries (`pg_stat_statements`).
- **Redis**: Command latency and memory footprint (target < 150 MB during spike).

## Success Criteria

- No 5xx responses from `/actions/submit` or `/actions/:id/approve`.
- Action executor keeps backlog < 100 jobs during spike and clears within 5 minutes of spike completion.
- p95 approval time (submit → executed) < 180 seconds.
- Notifications table growth matches approval lifecycle (1 submission + decision + execution event per approval).

## Reporting Checklist

1. Attach k6 summary (`output-summary.json`) and HTML trend report.
2. Include BullMQ queue stats before/after test (`scripts/load/report-queues.ts`).
3. Capture Grafana snapshots (API latency, Redis ops/sec, worker job duration).
4. File any regressions in `TESTING.md` troubleshooting table.

## Remediation Playbook

| Issue | Action |
| ----- | ------ |
| Queue backlog > 500 | Increase `QUEUE_ACTION_EXECUTOR_CONCURRENCY`, scale worker replicas. |
| Redis latency spikes | Move to dedicated Redis tier or adjust `maxRetriesPerRequest`. |
| API 5xx under spike | Profile Prisma transaction hotspots; enable connection pooling metrics. |
| Notifications lag | Batch insert notifications or offload to worker. |

## Schedule

- Dry run on local docker-compose (reduced scale) once PR lands.
- Full staging test after Phase 4 merge, before production promotion.
- Re-run quarterly or after significant module capability changes.
