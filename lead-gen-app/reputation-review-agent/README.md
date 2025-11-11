# Reputation & Review Agent

Solopreneur-focused MCP server that automates the testimonial, review, and case study workflow. It supports requesting testimonials, tracking public reviews, triaging negative feedback, and surfacing reputation analytics.

## Quick Start

```bash
cp .env.example .env
npm install
npm run db:setup
npm run dev
```

- `npm run dev` starts the MCP stdio server with hot reload.
- `npm run build && npm start` produces a production build.

## Development Workflow

- Install dependencies with `npm install` after pulling changes so linting and tests stay in sync.
- Apply the schema via `npm run db:setup`; when `DATABASE_URL` is absent, the server transparently uses pg-mem for quick iteration.
- Before committing, run `npm run lint`, `npm run build`, and `npm test` to keep CI green.
- Use `npm run dev` for local stdio development with hot reload.

## MCP Tools

| Tool                                  | Purpose                                                     |
| ------------------------------------- | ----------------------------------------------------------- |
| `reputation_request_testimonial`      | Create a testimonial request after a project wraps.         |
| `reputation_record_testimonial`       | Log received testimonials with rating and permissions.      |
| `reputation_funnel_to_review_site`    | Generate platform-specific review follow-up messaging.      |
| `reputation_track_review_status`      | Track completion of public review requests.                 |
| `reputation_triage_negative_feedback` | Capture and triage negative feedback before it goes public. |
| `reputation_generate_case_study`      | Turn testimonials into formatted case studies.              |
| `reputation_get_stats`                | Summarize reputation metrics for dashboards.                |
| `reputation_list_testimonials`        | Filter and list stored testimonials.                        |

Detailed input/output schemas are defined via Zod inside `src/tools/`.

## Scripts

- `npm run db:setup` — apply the PostgreSQL schema in `src/db/schema.sql`.
- `npm run dev` — watch-mode server for local development.
- `npm run lint` — run ESLint across the TypeScript sources.
- `npm run build` — emit the production bundle to `dist/`.
- `npm test` — execute Vitest smoke tests under `tests/`.

## Environment

Copy `.env.example` and update the following variables:

- `DATABASE_URL` — PostgreSQL connection string. If omitted, the server falls back to an in-memory database (data resets on restart).
- `ANTHROPIC_API_KEY` — Optional if using LLM-enabled case studies (future). Currently unused but reserved.
- `LOG_LEVEL` — Winston log level (`info`, `debug`, etc.).
- `REPUTATION_DEFAULT_USER_ID` — Default UUID used when a userId is not passed explicitly.

## Testing

Vitest-based smoke coverage lives in `tests/`. Run `npm test` (or `npx vitest run`) to execute the suite, and add new scenarios by creating additional `*.test.ts` files in that directory.

## Architecture

- `src/index.ts` — MCP server entry point with stdio transport.
- `src/tools/` — Tool definitions with Zod validation.
- `src/services/` — Business logic separated from MCP transport concerns.
- `src/db/` — Database client, repositories, and schema.
- `src/utils/` — Logging, telemetry, validation helpers.
- `src/types/` — Shared TypeScript interfaces and enums.

All tools log structured entries, validate inputs, and encapsulate database mutations via transaction helpers.
