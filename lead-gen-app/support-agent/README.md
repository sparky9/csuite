# Support Agent

Autonomous support assistant that combines a local SQLite RAG store with Anthropic Claude for grounded ticket resolutions. The package now ships with an MCP stdio server so Claude Desktop can call the agent directly.

## Quick Start

```bash
cp .env.example .env
npm install
npm run db:setup       # creates ./data/rag-store.sqlite if missing
npm run dev            # starts the MCP server with hot reload
```

Build for production and run the stdio server:

```bash
npm run build
npm start
```

## MCP Tools

- `support_agent` – Resolve a ticket end-to-end. Provide `ticket_id`, `subject`, `body`, and optional metadata. The agent runs RAG search, drafts a reply, asks follow-up questions, or escalates with rationale.
- `support_rag_query` – Search the knowledge base directly by question, optionally tuning `top_k`, `min_score`, or `source_filter` to inspect retrieved chunks.

Both tools are exposed via stdio transport and are discoverable from Claude Desktop once the server is running.

## Scripts

- `npm run db:setup` – Initialize the local SQLite database used by the vector store.
- `npm run smoke:test` – Execute a mock ticket to verify the pipeline without LLM calls (forces `mockMode`).
- `npm run dev` – Start the MCP server through `tsx watch` for rapid iteration.

## Environment

Key variables (see `.env.example`):

- `ANTHROPIC_API_KEY` – Required for live resolutions. Leave blank and enable `MOCK_SUPPORT_AGENT=1` for offline testing.
- `RAG_DB_PATH` – Location of the SQLite knowledge store (defaults to `./data/rag-store.sqlite`).
- `RAG_EMBEDDING_MODEL` – Xenova embedding model name.
- `LOG_LEVEL` – Logger verbosity (default `info`).

Ingest documentation into the RAG store with your preferred ingestion scripts, then restart the server so new chunks are available to the agent.
