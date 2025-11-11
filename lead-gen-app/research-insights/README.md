# Research Insights MCP Server

Standalone MCP server for competitive intelligence workflows. It wraps the research capture, summarization, and database utilities extracted from VPA Core so Claude Desktop can monitor sources, collect digests, and run on-demand scans.

## Quick Start

```bash
cp .env.example .env
npm install
npm run db:setup          # creates research_sources and research_snapshots tables
npm run dev               # start stdio server with hot reload
```

For production builds:

```bash
npm run build
npm start
```

## MCP Tools

- `research_add_source` – Add a URL to monitor. Validates scheme, optional category, notes, and frequency.
- `research_list_sources` – List all sources (optionally include last snapshot metadata).
- `research_remove_source` – Delete a monitored source and cascade snapshots.
- `research_run_monitor` – Capture sources, diff changes, and persist new snapshots.
- `research_get_digest` – Generate a digest headline, highlights, and narrative from recent captures.
- `research_on_demand` – Perform an ad-hoc scan for a topic using supplied URLs or existing sources.
- `research_update_source` – Refresh labels, URLs, notes, or monitoring cadence for a source.

All tools are exposed via stdio transport; point Claude Desktop at the server executable (`npm start`) to register them.

## Environment

Copy `.env.example` and set:

- `DATABASE_URL` – PostgreSQL connection string.
- `RESEARCH_USER_ID` – Default UUID tagged on records (override per deployment).
- `ANTHROPIC_API_KEY` – Required for intelligent summaries and digest narratives.
- `ANTHROPIC_MODEL` – Optional Claude model override.
- `RESEARCH_BROWSER` – Optional Playwright browser (`chromium`, `firefox`, `webkit`).
- `LOG_LEVEL` – Winston log verbosity (`info`, `debug`, etc.).

Playwright is an optional dependency; install it when you need rendered-page capture support.

## Scripts

- `npm run db:setup` – Apply the PostgreSQL schema (`src/db/schema.sql`).
- `npm run dev` – Run the MCP server in watch mode.
- `npm run lint` – TypeScript/ESLint diagnostics for `src/`.
