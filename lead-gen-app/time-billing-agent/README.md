# Time & Billing Agent

Solopreneur-focused MCP server that tracks billable hours, manages rate cards, generates invoices, and handles payment reminders so nothing slips through the cracks.

## Quick Start

```bash
cp .env.example .env
npm install
npm run db:setup
npm run dev
```

- `npm run dev` starts the MCP stdio server with hot reload.
- `npm run build && npm start` produces a production build.
- `npm run lint` runs ESLint; `npm test` executes the Vitest suite.
- `npm run db:setup` replays `src/db/schema.sql` against the configured database (defaults to in-memory).

## Available Tools

The server exposes MCP tools for:

- Time tracking (`time_track_entry`, `time_get_entries`)
- Rate cards (`billing_set_rate_card`, `billing_get_rate_cards`)
- Invoice lifecycle (`billing_generate_invoice`, `billing_send_invoice`, `billing_track_invoice_status`)
- Payments & reminders (`billing_record_payment`, `billing_generate_payment_reminder`)
- Profitability analytics (`billing_get_profitability_report`)

Every tool accepts JSON input validated with Zod; see `src/tools/` for schemas and returned payloads.
Usage-ready JSON examples for each tool live in `docs/tool-reference.md`.

## Environment Configuration

Copy `.env.example` and adjust as needed:

- `DATABASE_URL` – optional PostgreSQL connection string; leave unset for pg-mem.
- `TIME_BILLING_DEFAULT_USER_ID` – fallback user id when tool inputs omit one.
- `BILLING_DEFAULT_CURRENCY`, `BILLING_DEFAULT_NET_TERMS`, `TIME_BILLING_DEFAULT_RATE` – optional defaults.
- `LOG_LEVEL` – logging verbosity (defaults to `info`).

## Architecture Notes

- `src/index.ts` wires the MCP server, handles tool dispatch, and manages graceful shutdown.
- `src/db/` contains the PostgreSQL schema and connection helper with optional in-memory mode.
- Services under `src/services/` encapsulate business logic for time entries, rate cards, invoices, payments, and reports.
- Zod-powered tool wrappers live in `src/tools/`, returning MCP-compatible responses via shared helpers.
- Utility modules in `src/utils/` cover config resolution, logging, and currency helpers.
