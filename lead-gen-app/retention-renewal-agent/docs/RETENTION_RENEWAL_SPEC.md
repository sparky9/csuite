# Retention & Renewal Agent Technical Specification

## Goal

Deliver an MCP server that continuously monitors customer accounts for renewal risk and opportunity, generates proactive playbooks, and syncs recommendations into the go-to-market workflow.

## Core Domains

- **Contract Intelligence**: Pull renewal dates, contract values, and terms from CRM/billing.
- **Health Signals**: Ingest product usage metrics, support interactions, and sentiment scores.
- **Playbooks**: Curate recommended actions (renew, expand, win-back) with templated collateral.
- **Pipeline Operations**: Track status, owners, and forecast for upcoming renewals.
- **Notifications**: Surface alerts to Slack/email when thresholds trigger.

## High-Level Architecture

```text
src/
  index.ts                MCP server bootstrap
  db/
    client.ts             Database pool + lifecycle helpers
    schema.sql            Base schema for retention domain
  services/
    renewal-service.ts    Renewal horizon queries and summaries
    health-service.ts     Signal ingestion + scoring engine
    playbook-service.ts   Generates renewal/win-back assets
    notification-service.ts Sends alerts to channels
  tools/
    retention-tools.ts    Claude-facing tool definitions
  utils/
    config.ts             Environment variable parsing (zod)
    logger.ts             Winston logger configuration
```

### Data Flow

1. Scheduled job calls `health-service.ingestSignals()` to update activity snapshots.
2. `health-service` derives health scores, logs audit events, and flags accounts that cross thresholds.
3. `renewal-service` powers MCP queries such as `retention.getUpcomingRenewals` and `retention.getAtRiskAccounts`.
4. `notification-service` pushes alerts (Slack webhook supported) when accounts escalate to at-risk or critical.
5. `playbook-service` assembles recommended actions, persists tasks, and logs lifecycle events.

## Database Notes

- Primary tables: `renewal_accounts`, `renewal_health_snapshots`, `renewal_playbooks`, `renewal_tasks`.
- Use JSONB columns for unstructured signal metadata.
- Store scoring breakdowns for explainability.

## External Integrations

- CRM (HubSpot/Salesforce) via webhooks or polling.
- Billing (Stripe/Chargebee) for contract end dates.
- Support tools (Intercom/Zendesk) for ticket sentiment.
- Product analytics (Mixpanel/PostHog) via exported usage metrics.

## MCP Tool Candidates

| Tool ID                               | Description                                           |
| ------------------------------------- | ----------------------------------------------------- |
| `retention_get_upcoming_renewals`     | Returns accounts with renewals in the next N days.    |
| `retention_get_at_risk_accounts`      | Lists accounts below health threshold with rationale. |
| `retention_generate_renewal_playbook` | Produces and persists a renewal playbook with tasks.  |
| `retention_schedule_playbook_task`    | Creates follow-up tasks for CSM/sales.                |
| `retention_log_renewal_outcome`       | Records renewal/win-back results for analytics.       |

## Open Questions

- Which data sources are available in initial deployment (CSV imports vs live APIs)?
- Will renewal collateral be generated as PDFs or linked to templates in proposal system?
- How should alerts be throttled to avoid notification fatigue?
