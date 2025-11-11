# Retention & Renewal Agent

The Retention & Renewal Agent protects recurring revenue by monitoring contract end dates, usage signals, and customer sentiment. It orchestrates proactive renewal playbooks, generates win-back sequences for at-risk accounts, and keeps customer-success teams aligned on next actions.

## Capabilities

- Track renewal horizons across CRMs and billing tools, triggering tasks and reminders before contracts lapse.
- Consolidate health signals (product usage, support tickets, NPS/CSAT) to surface expansion or risk categories.
- Draft renewal proposals, price-adjustment recommendations, and win-back nurture sequences using ICP-aligned templates.
- Maintain a renewal pipeline dashboard with stages, forecast, blockers, and assigned ownership.
- Sync renewal activity back to foundational systems (CRM, helpdesk, CSM notes) through MCP tools.
- Detect at-risk accounts in real time, log lifecycle events, and trigger Slack alerts.
- Generate renewal playbooks with recommended actions and task assignments.

## Project Structure

```text
retention-renewal-agent/
  docs/                    Project briefs, specs, process docs
  scripts/                 Database setup, smoke data, operational scripts
  src/
    db/                    Database client and schema migration helpers
    services/              Business domain services (signals, playbooks, orchestration)
    tools/                 MCP-exposed tools for Claude/Forge workflows
    types/                 Shared TypeScript types and zod schemas
    utils/                 Cross-cutting utilities (logging, config, notifications)
  README.md                You are here
  package.json             Project metadata and dependencies
  tsconfig.json            TypeScript configuration
```

## Getting Started

```bash
cp .env.example .env
npm install
npm run db:setup
npm run db:seed # optional sample data for local testing
npm run dev
```

### Sample Data

- `npm run db:seed` loads three example accounts plus health snapshots for quick smoke testing.
- Health scores are derived by averaging usage/support/NPS inputs with weighted heuristics.

## Roadmap Milestones

1. **Foundational schema + services**: contract horizon tables, signal ingestion, renewal playbook models.
2. **Health scoring engine**: rule-based scoring with thresholds, watchlists, and alert triggers.
3. **Renewal playbooks**: template engine for renewal decks, pricing adjustments, and win-back sequences.
4. **MCP tool suite**: Claude-callable tools for renewal status, task creation, proposal drafting.
5. **Automation layer**: scheduled jobs for upcoming renewals and risk escalations, plus Slack/email notifications.

## Status

- ✅ Repository scaffolding, schema, and sample data scripts in place
- ✅ Renewal query, health ingestion, alerts, and MCP tools for upcoming renewals & risk watchlists
- ✅ Renewal playbook generation with task creation and event logging
- ⏳ Notification channel integrations beyond Slack + additional MCP surfaces
- 🧪 Test harness to be added alongside next implementation slice
