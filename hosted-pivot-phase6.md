# Hosted Pivot · Slice 6 Build Brief (For Sonnet 4.5)

## Objective

Shift the platform from reactive guidance to proactive, always-on insights while laying groundwork for a future module marketplace and tiered monetization.

## Scope Overview

- Implement trigger engine that detects notable events, anomalies, or scheduled cadences and surfaces alerts.
- Provide a lightweight marketplace framework for registering optional widgets/add-ons (internal beta).
- Instrument billing and analytics to understand usage and support premium tiers.

## Deliverables

### 1. Trigger & Alert Engine

- Create `TriggerRule` model (tenantId, name, type, schedule|metric, threshold, severity, enabled, lastRunAt).
- Scheduler worker (`apps/api/src/workers/trigger-runner.worker.ts`) that:
  - Runs on configurable cadence (cron)
  - Evaluates rules against analytics snapshots, module insights, and knowledge signals
  - Emits `Alert` records (id, tenantId, ruleId, payload, acknowledgedAt, status)
- Support anomaly detection stub (z-score on time series) with ability to mark false positives
- Integrate alerts with notification system (Slice 4) and dashboard badges

### 2. Real-time Signal Aggregation

- Extend ingestion jobs to write summary metrics to `UsageSnapshot` (e.g., delta% vs previous period)
- Provide API `GET /alerts` and `POST /alerts/:id/acknowledge`
- Dashboard widget showing "Today’s Alerts" with severity filters

### 3. Marketplace Foundations

- Define `Widget` registration schema (`packages/module-sdk/widgets.ts`): slug, name, description, category, required capabilities
- Admin-only API `POST /marketplace/widgets` to register internal widgets (no public submission yet)
- Frontend marketplace gallery `apps/web/src/app/(dashboard)/marketplace/page.tsx` listing available widgets with install toggles
- Persist tenant widget installs in `TenantWidget` table (tenantId, widgetSlug, enabledAt, settings JSON)
- Widgets can contribute dashboard tiles (render components from config map) — load from registry when enabled

### 4. Billing Instrumentation

- Add `BillingUsage` table with daily aggregates (tenantId, tokensUsed, tasksExecuted, alertsTriggered, activeWidgets)
- Integrate Stripe/usage tracking stub:
  - Webhook listener capturing invoice events
  - API endpoint `GET /billing/usage` for dashboard display
- Dashboard billing tab showing usage charts and plan limits

### 5. Analytics & Product Telemetry

- Integrate PostHog (or similar) for feature usage events (board meeting run, action approved, knowledge uploaded)
- Document event taxonomy and ensure opt-out controls (tenant setting)
- Add quick insights chart (sparkline) on dashboard using aggregated usage data

### 6. Testing & Reliability

- Unit tests for trigger evaluation (mock datasets)
- Integration tests for alert acknowledgement and widget install flow
- Billing usage tests ensuring aggregates roll up correctly and RLS enforced
- Monitor load of trigger engine (document scaling approach)

### 7. Documentation & DX

- Write `docs/proactive-insights.md` outlining trigger configuration and marketplace usage
- Update onboarding to mention alerting + widget installation
- Seed script `pnpm seed:slice6` with sample triggers, alerts, billing usage entries

## Acceptance Criteria

1. Tenant can enable triggers, receive alerts, acknowledge them, and see notifications
2. Marketplace page shows internal widgets; enabling one adds a dashboard tile
3. Billing tab displays usage data from `BillingUsage` records
4. PostHog events fire for key interactions (behind environment flag)
5. Tests + lint/typecheck pass

## Risks & Open Questions

- Alert fatigue if trigger tuning is poor (need thresholds + snooze options)
- Marketplace security (only vetted widgets; ensure capability isolation)
- Billing accuracy; may need reconciliation before real charging

## Next Steps

1. Align with product on initial trigger catalog and alert severity definitions
2. Decide on billing provider integration depth (Stripe usage vs manual tracking)
3. Ensure privacy review for telemetry and event tracking
4. Sonnet to begin after Slice 5 stability review
