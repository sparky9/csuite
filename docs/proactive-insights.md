# Proactive Insights Guide

This guide explains how to use the Slice 6 proactive insights stack: trigger rules, alerting, marketplace widgets, and billing usage instrumentation.

## Overview

Slice 6 adds an always-on trigger engine that evaluates tenant rules and produces alerts, a widget marketplace for optional dashboard surfaces, and billing rollups that capture daily usage and alert activity. The pieces ship together to support proactive coaching and future premium tiers.

## Trigger Rules

Trigger rules define *when* an alert should be generated. Each rule belongs to a tenant and supports three strategies:

- `schedule` — run on a cron schedule (UTC). Good for weekly briefings.
- `metric_threshold` — fire when a metric crosses a configured threshold.
- `anomaly` — run a z-score anomaly check for the most recent value within a rolling window.

Common rule fields:

| Field | Description |
| --- | --- |
| `name` | Human friendly label that appears in the UI. |
| `type` | One of `schedule`, `metric_threshold`, or `anomaly`. |
| `schedule` | Cron expression (for schedule rules). |
| `metric` | Metric identifier used for threshold/anomaly rules (e.g. `analytics.mql.delta`). |
| `threshold` | Numeric threshold (greater-than) or anomaly z-score. |
| `windowDays` | Optional lookback window for anomaly analysis. |
| `severity` | `info`, `warning`, or `critical`. |
| `enabled` | Toggle to pause the rule. |

Rules are evaluated by the trigger engine service (`apps/api/src/services/trigger-engine.ts`). The engine enforces:

- **Idempotence** — open alerts prevent duplicate firings until resolved.
- **Telemetry** — each trigger emits `alert.triggered` events via PostHog (when configured).
- **Usage bookkeeping** — alerts increment `UsageSnapshot` and `BillingUsage` rows for the firing day.

### Scheduling cadence

The engine uses the cron expression parser to determine if a schedule rule should run. Cron expressions should be defined in UTC. Example weekly Monday at 13:00 UTC:`0 13 * * 1`.

### Metrics and anomalies

Metric-based rules look up scalar values or series via analytics/services (e.g. usage snapshots). The anomaly detector applies a simple z-score (default threshold `2.5`) with a minimum of five datapoints. You can override the z-score threshold per rule.

## Alerts

Alerts are persisted in the `Alert` table and support workflows:

- `status` — `pending`, `acknowledged`, `resolved`, `snoozed` (snooze support is stubbed for future work).
- `acknowledgedAt` — timestamp recorded when a tenant user acknowledges the alert.
- `payload` — JSON metadata describing why the alert was raised.

API endpoints:

- `GET /alerts` — list alerts (existing Slice 4 surface).
- `POST /alerts/:id/acknowledge` — mark alert as acknowledged.

The notification service (`apps/api/src/services/notifications.ts`) is invoked when an alert fires so that in-app notifications stay in sync with proactive insights.

## Marketplace Widgets

The marketplace allows curated widgets to be registered and installed per tenant.

- `POST /marketplace/widgets` — register or update a widget (admin only).
- `GET /marketplace/widgets` — list widgets and install status for the current tenant.
- `POST /marketplace/widgets/:slug/install` — install or re-enable a widget.
- `DELETE /marketplace/widgets/:slug/install` — uninstall a widget.

Widgets can declare dashboard tiles (`dashboard.tile`) and arbitrary metadata. Installed widgets are tracked in `TenantWidget` records and counted toward billing usage.

## Billing Usage

Billing aggregation captures daily totals for:

- `tokensUsed`
- `tasksExecuted`
- `alertsTriggered`
- `activeWidgets`

Key surfaces:

- `GET /billing/usage` — returns totals and day-level `BillingUsagePoint` records.
- `POST /billing/webhook` — records external billing events and usage deltas (Stripe-compatible payload).

The service in `apps/api/src/services/billing.ts` exposes helper utilities for normalizing dates, mapping records, and applying usage deltas. Alerts triggered by the engine automatically call `recordAlertImpact`, updating both `UsageSnapshot` and `BillingUsage` for the day.

## Seeding Demo Data

Run the seed script to populate a tenant with sample triggers, alerts, widget installs, and billing usage. This is useful for local demos or QA environments.

```powershell
pnpm --filter api seed:slice6 -- --tenant demo-tenant --tenant-name "Demo Tenant"
```

Flags:

- `--tenant` — Tenant ID to seed (default `tenant-slice6-demo`).
- `--tenant-name` — Friendly tenant name when creating a new tenant.
- `--tenant-slug` — Optional slug override if the default derived slug conflicts.

The script performs:

1. Ensures the tenant exists (creates a new one if needed).
2. Registers and installs the `revenue-radar` widget.
3. Seeds representative trigger rules and example alerts.
4. Upserts the last seven days of `BillingUsage` and `UsageSnapshot` rows.

## Operational Notes

- Trigger evaluation should run on a worker or cron (e.g., BullMQ job). Ensure the trigger runner is scheduled in production environments.
- Set `INTERNAL_ADMIN_API_KEY` and `STRIPE_WEBHOOK_SECRET` in production to lock down widget registration and billing webhooks.
- PostHog telemetry can be disabled per tenant via `config.telemetry.disabledTenants`.
- Review alert thresholds periodically to avoid fatigue; anomaly thresholds can be tuned per rule via the `threshold` field.
