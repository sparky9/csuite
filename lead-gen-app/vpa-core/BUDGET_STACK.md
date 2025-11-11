# Budget Stack Playbook

How to run the VPA end-to-end with minimal or zero recurring spend, plus guidance for upgrading to the premium cloud stack when revenue allows.

## Cost-Optimized Defaults

| Component      | Budget Option                                | Monthly Cost | Notes                                                   |
| -------------- | -------------------------------------------- | ------------ | ------------------------------------------------------- |
| LLM            | Ollama (`gpt4all`, `llama3.1:8b`, `qwen2.5`) | $0           | Runs locally; expect slower responses vs. Claude/OpenAI |
| Speech-to-Text | Whisper.cpp (medium)                         | $0           | Use GPU build where possible                            |
| Text-to-Speech | Piper TTS                                    | $0           | Pair with lightweight voice skins                       |
| Database       | Local Postgres / SQLite                      | $0           | SQLite acceptable for single-user solopreneur           |
| Bridge         | `npm run bridge:dev`                         | $0           | Routes web/mobile chat into local models                |
| Email          | Gmail SMTP via EmailOrchestrator             | $0           | Rate limited; upgrade to SendGrid when scaling          |

## Local-Only Deployment Steps

1. **Provision database**
   - For single-user testing: set `DATABASE_URL=sqlite://./data/vpa.db` (SQLite support WIP).
   - For production-ready local stack: install Postgres (or `docker run postgres`).
2. **Install Ollama + models**
   ```powershell
   winget install Ollama.Ollama
   ollama pull llama3.1:8b
   ollama pull qwen2.5:7b
   ```
3. **Set runtime mode**
   ```env
   VPA_RUNTIME_MODE=ollama
   VPA_ADAPTER_PRIORITY=ollama,claude-desktop
   VPA_FAILOVER_ENABLED=false
   ```
4. **Start services**
   ```powershell
   npm run dev           # Starts VPA MCP server
   npm run bridge:dev    # Starts UTA bridge on port 4040
   ollama serve          # Serves local LLMs
   ```
5. **Connect clients**
   - Claude Desktop (optional): keep running to leverage MCP UI.
   - Web app / mobile bridge: point to `http://localhost:4040`.
   - Voice stack: wire Whisper.cpp + Piper into the client app; forward transcripts to bridge.
6. **Email delivery**
   - Use Gmail SMTP in `email-orchestrator/config/email-config.json` (less than 100 emails/day recommended).
   - Upgrade to SendGrid ($19/mo) when campaigns exceed Gmail limits.

## Upgrading to Premium Cloud Stack

| Component  | Premium Option                 | Reason                                          |
| ---------- | ------------------------------ | ----------------------------------------------- |
| LLM        | Claude API (Claude 3.5 Sonnet) | Fast, accurate tool-calling, mobile-ready voice |
| Failover   | OpenAI GPT-4.1                 | Backstop when Anthropic throttles               |
| Database   | Neon serverless Postgres       | Automatic scaling, backups                      |
| Voice      | AssemblyAI / ElevenLabs        | Commercial-grade speech quality                 |
| Email      | SendGrid / Mailgun             | Higher daily send limits                        |
| Monitoring | Logtail + Axiom                | Hosted logs and metrics                         |

**Configuration sample**:

```env
VPA_RUNTIME_MODE=claude-api
VPA_ADAPTER_PRIORITY=claude-api,openai,claude-desktop
VPA_FAILOVER_ENABLED=true
DATABASE_URL=postgresql://user:password@ep-neon.aws.neon.tech/neondb?sslmode=require
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=...
```

## Cost Comparison Snapshot

| Item       | Budget Stack | Premium Stack                           |
| ---------- | ------------ | --------------------------------------- |
| LLM usage  | $0           | ~$120/mo @ 30k tokens/day on Claude API |
| Database   | $0           | $19/mo (Neon Pro)                       |
| Voice      | $0           | $15/mo (ElevenLabs starter)             |
| Email      | $0           | $20/mo (SendGrid Pro)                   |
| Monitoring | $0           | $10/mo (Logtail)                        |
| **Total**  | **$0**       | **~$164/mo**                            |

## When to Upgrade

- Daily message volume consistently > 200 (local models lag).
- Need multi-agent concurrency or remote team access.
- Require enterprise compliance (SOC2, HIPAA, etc.).
- Desire premium voice quality for client-facing demos.

Until then, the budget stack keeps costs at zero while validating product-market fit for solopreneurs.
