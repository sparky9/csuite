# Proposal & Contract Agent MCP

AI-powered proposal generation and contract workflows for solopreneurs. This MCP server lets Claude draft proposals from templates, convert them to contracts, send e-signature links, and chase unsigned documents automatically.

## Features

- **Template Library** – Store reusable proposal and contract templates with tokenized sections.
- **Proposal Builder** – Merge templates with client data, pricing tables, and optional clauses.
- **Contract Composer** – Convert accepted proposals into legally binding contracts with renewals.
- **Signature Tracking** – Record sends, opens, signatures, and reminders for every contract.
- **Follow-up Automation** – Generate reminders for unsigned docs and schedule nudges in the CRM/task queue.

## Prerequisites

- Node.js 18+
- PostgreSQL (Neon free tier recommended)
- Claude Desktop with MCP support
- `.env` file containing `DATABASE_URL`

## Quick Start

```bash
cd proposal-contract-agent
npm install
npm run db:setup
npm run dev
```

Add the server to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "proposal-contract-agent": {
      "command": "node",
      "args": [
        "D:/projects/Lead gen app/proposal-contract-agent/dist/index.js"
      ],
      "env": {
        "DATABASE_URL": "your-neon-database-url"
      }
    }
  }
}
```

Restart Claude Desktop and run the smoke test to validate the toolchain:

```bash
npm run test:smoke
```

Remove the smoke test records afterwards (optional):

```bash
npm run db:cleanup
```

## MCP Tools

| Tool                | Description                                         |
| ------------------- | --------------------------------------------------- |
| `template_list`     | List available templates with required tokens       |
| `template_save`     | Create or update a template                         |
| `proposal_generate` | Merge a template with client data and pricing       |
| `proposal_send`     | Mark a proposal as sent and log the event           |
| `proposal_status`   | Retrieve proposal details and history               |
| `contract_generate` | Convert a proposal into a contract                  |
| `contract_send`     | Send a contract (records signature link + deadline) |
| `contract_status`   | Inspect signature status and timeline               |
| `signature_remind`  | Generate reminder memo for outstanding signatures   |

See `scripts/test-proposal-tools.ts` for an end-to-end smoke test that exercises the full workflow.
