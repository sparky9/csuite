# Task & Project Manager Agent

AI-powered MCP agent that keeps solopreneurs on top of every commitment. It captures tasks from anywhere, prioritizes what matters, forecasts deadlines, and summarizes progress so nothing slips through the cracks.

## Capabilities

- **To-do intelligence** – normalizes tasks, assigns smart priority scores, and groups into Now/Next/Later focus lists
- **Deadline tracking** – monitors upcoming due dates, flags risk, and surfaces blockers
- **Priority recommendations** – ranks tasks with a transparent scoring model that blends urgency, impact, and effort
- **Progress reports** – generates daily/weekly summaries with velocity metrics, completed highlights, and overdue follow-ups
- **Project awareness** – rolls tasks up to projects so status meetings take minutes instead of hours

## Getting Started

```bash
cd "D:/projects/Lead gen app/task-project-manager"
npm install
cp .env.example .env
# fill in DATABASE_URL and optional LOG_LEVEL
npm run db:setup
npm run dev
```

The MCP server exposes tools for adding tasks, updating status, requesting prioritized focus lists, and generating progress reports. See `src/tools` for the full schema.

## Smoke Test

Verify database access and service wiring end-to-end:

```bash
npm run db:setup
npx tsx scripts/test-task-tools.ts
```

The script creates a temporary user, exercises add/update/focus/recommend/report flows, and cleans up the test task before closing the pool.

## Database Schema

`npm run db:setup` creates two tables:

- `task_projects` – project records with owner, status, and cadence metadata
- `task_items` – individual task entries with priority signals, effort estimates, and completion timestamps

All queries are scoped by `user_id` so the agent can safely serve multiple tenants.

## Integration with VPA Core

VPA imports the shared service from this package to expose a unified `vpa_tasks` tool. Run `npm install` in `vpa-core` after building this package so the local dependency is linked.

## Roadmap

- Calendar sync to auto-pull deadlines
- Notion/Trello importers
- Smart recurring task rules
- Momentum scoring (streaks + focus time)

Pull requests welcome!
