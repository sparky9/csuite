# Cross-LLM Adapter Blueprint

Design notes for exposing VPA Core to multiple language-model clients (Claude Desktop, Claude API, ChatGPT, Gemini, local Ollama) without duplicating business logic.

## High-Level Goals

- **Single orchestration brain** – VPA Core remains the only MCP/tool surface. Every client (voice, text, web, native) routes commands through the same APIs.
- **Modular transport adapters** – Swap/adapt LLM providers via thin shims that translate provider-specific formats into VPA’s unified tool contract.
- **User-owned credentials** – Allow users to bring their own Anthropic/OpenAI/Google keys or run locally with no cloud spend.
- **Graceful degradation** – When an adapter lacks a feature (e.g., function calling), fall back to prompt templates rather than breaking workflows.

## Core Components

```
Browser / Mobile UI ─┬─> VPA Bridge API ─┬─> Claude Desktop Adapter (MCP stdio)
                    │                  ├─> Unified Tool API (HTTP/JSON)
Claude Mobile ───────┘                  │    ├─> Claude API Adapter
                                         │    ├─> OpenAI Adapter (function calls)
                                         │    ├─> Gemini Adapter (extensions/webhooks)
                                         │    └─> Ollama Adapter (local CLI / REST)
```

### 1. VPA Bridge API

- Runs locally alongside Claude Desktop bridge or on the hosted platform when using cloud LLMs.
- Responsibilities:
  - Session creation and mapping (`session_id` → `conversation_id` → adapter instance).
  - Message relay (streaming SSE/WebSocket out to web/mobile clients).
  - Auth (JWT/API key per user), rate limiting, usage logging.
  - Fallback routing: if default adapter unavailable, roll to next configured option.

### 2. Unified Tool API (UTA)

- Internal HTTP+JSON surface used by all adapters.
- Endpoints:
  - `POST /uta/session` – initialize conversation, return `sessionToken`.
  - `POST /uta/message` – send user input, returns streamed response metadata (`toolCalls`, `finalMessage`).
  - `POST /uta/tool-result` – adapters post tool outputs back to VPA Core.
  - `GET /uta/heartbeat` – health check for supervision.
- Schema:
  - Messages standardized as `{ role: 'user' | 'assistant' | 'tool', content: string | object, voiceHint?: VoiceResponseShape }`.
  - Tool calls normalized to `{ name: string, arguments: any }` regardless of provider syntax.

### 3. Adapter Responsibilities

Common tasks:

- Authenticate with provider (API key, OAuth, local CLI).
- Convert provider-specific messages to/from UTA schema.
- Manage streaming (SSE → tokens, gRPC streams, short/long polling).
- Handle tool invocation semantics:
  - **Claude API** – native tool-call support via MCP HTTP (when released) or fn-call analog.
  - **OpenAI** – map `tool_calls`/`function_call` to UTA; respond via `tool` role.
  - **Gemini** – use the Functions API when available; fallback prompts describing tool schema.
  - **Ollama** – run local binary; use prompt templates plus JSON extraction, or integrate with function-calling models (e.g., `qwen:0.5b function` when accessible).

## Adapter Sketches

### Claude Desktop Adapter (existing)

- Stdio transport already implemented.
- Bridge app pipes Browser/mobile chat to Claude Desktop conversation.
- Add health pings + reconnection logic for long-lived sessions.

### Claude API Adapter

- Uses Anthropic Messages API.
- Tools: replicate MCP schema using `tools` array; handle streaming tokens, convert to SSE for clients.
- Rate limiting & cost metrics recorded in VPA usage table.

### OpenAI Adapter

- Uses GPT-4o/4.1 w/ function calling.
- Register VPA tools as OpenAI `functions`, include JSON schema.
- When OpenAI issues `tool_calls`, forward to UTA `/tool-result`.
- Provide fallback prompts for 3.5 or other models lacking tool calling.

### Gemini Adapter

- Leverage Gemini 1.5 Pro function-calling (beta) or implement prompt-based extraction.
- If functions unsupported, send prompt containing tool catalog + ask for JSON payload matching schema.
- Wrap HTTP streaming (chunked responses) into SSE.

### Ollama Adapter

- Runs on user’s machine; communicates via `http://127.0.0.1:11434` REST API (configurable via `OLLAMA_BASE_URL`).
- Defaults: model `llama3.1:8b-instruct`, streaming enabled, optional overrides through `OLLAMA_MODEL` and `OLLAMA_OPTIONS` (JSON string mapped to Ollama request options).
- Adapter flow: light-weight planner turn chooses between direct reply or VPA tool invocation; tool results summarized back to the user with speech-friendly phrasing.
- Emits SSE stream and tool status events matching the Claude/OpenAI adapters; falls back to local summary if JSON coercion fails.
- Optional offline speech-to-text and TTS hooks (e.g., Whisper.cpp, Piper) remain on the roadmap for a fully local stack.
- Emits invocation telemetry back into the bridge heartbeat so ops dashboards can monitor success/failure rates and latency per adapter.
- `npm run telemetry:stream` polls `/uta/heartbeat` and writes NDJSON for quick dashboards/observability ingestion.

## Session & State Flow

1. User opens web app → requests session via Bridge API.
2. Bridge selects adapter based on user preference / availability (Claude Desktop if running, else Claude API, etc.).
3. User message forwarded to adapter → provider → tool call(s) triggered.
4. Tool call forwarded to VPA Core (UTA), executed, result streamed back.
5. Adapter sends tool result to provider, completes turn; Bridge streams final message + voice summary back to UI.
6. Voice context cache stays inside VPA Core, independent of adapter.

## Security & Isolation

- Each adapter runs inside its own worker/process with scoped API keys.
- Sensitive env vars loaded per user/tenant; never persisted client-side.
- Tool payload logging anonymized; opt-in debugging toggle for users.
- For local-only mode (Ollama + Claude Desktop), adapter processes run on device, no cloud egress.

## Implementation Phases

1. [done] **UTA Skeleton** – `src/bridge/server.ts` now exposes `/uta/session`, `/uta/message`, `/uta/tool-result`, SSE streaming, and heartbeat.
2. [done] **Claude API Adapter** – Anthropic Messages streaming + tool routing live; forwards tool calls through UTA and streams assistant deltas.
3. [done] **OpenAI Adapter** – Chat Completions streaming + function-calling wired; mirrors Claude tooling via UTA.
4. [deferred] **Gemini Adapter** – deprioritized per current scope; revisit if demand resurfaces.
5. [done] **Ollama Adapter** – planner + summary pipeline hitting local Ollama REST; streams deltas, executes tools, and updates adapter health.
6. [done] **Adapter Telemetry** – bridge heartbeat now exposes per-adapter success/failure counts and average latency (see `AdapterTelemetry`).
7. [todo] **Installer Choice UX** – Prompt users for adapter priority; backed by `src/config/runtime.ts` + installer spec.
8. [todo] **Billing Hooks** – capture per-adapter spend/usage and persist to usage tables.
9. [todo] **Docs & SDK** – publish instructions + minimal client SDK for third-party integrations.

## Next Decisions

- Select preferred TTS/STT stack for web voice (impacts adapter packaging).
- Determine default adapter priority order (likely Desktop → Claude API → OpenAI → Gemini → Ollama).
- Define error-handling policy: when to auto-failover vs. surface to user.
- Plan hosted vs. self-hosted licensing (e.g., gating Claude API adapter behind premium tier).

With this blueprint we can parallelize adapter implementation while keeping VPA Core unchanged and ready for whichever LLM a solopreneur prefers or can afford.
