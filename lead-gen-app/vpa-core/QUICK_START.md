# VPA Core - Quick Start Guide

**Get VPA Core running in 5 minutes**

---

## Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] PostgreSQL database (Neon, AWS RDS, local)
- [ ] Anthropic API key
- [ ] Claude Desktop installed

---

## Step 1: Install Dependencies (30 seconds)

```bash
cd "D:\projects\Lead gen app\vpa-core"
npm install
```

**Expected output:** `added 163 packages` ✅

---

## Step 2: Configure Environment (2 minutes)

```bash
# Copy example file
cp .env.example .env

# Edit .env with your values
notepad .env
```

**Required values:**

```env
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
LICENSE_KEY=test-license-key-12345  # Use test key for now
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
LOG_LEVEL=info
NODE_ENV=development
```

**Where to get values:**

- **DATABASE_URL**: Your Neon/PostgreSQL connection string
- **LICENSE_KEY**: Use `test-license-key-12345` (created by setup script)
- **ANTHROPIC_API_KEY**: Get from https://console.anthropic.com/

### Optional: Multi-adapter settings

Add these when you want to enable cloud (Claude/OpenAI) or local (Ollama) adapters:

```env
VPA_RUNTIME_MODE=claude-desktop
VPA_ADAPTER_PRIORITY=claude-desktop,claude-api,openai,ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.1:8b-instruct
```

> Tip: run `npm run configure:adapters` for an interactive prompt that writes these to `.env`.

---

## Step 3: Setup Database (1 minute)

```bash
npm run db:setup
```

**Expected output:**

```
VPA Core Database Setup
======================

Testing database connection...
✓ Database connected at: 2025-10-20...

Reading schema file: ...
✓ Schema file loaded

Executing database schema...
✓ Schema executed successfully

Verifying tables...
Created tables:
  ✓ users
  ✓ user_subscriptions
  ✓ user_usage
  ✓ user_module_config

Test user created:
  Email: test@example.com
  License Key: test-license-key-12345

✓ Database setup completed successfully!
```

✅ **Success!** Your database is ready.

---

## Step 4: Build VPA Core (30 seconds)

```bash
npm run build
```

**Expected output:**

```
> @yourcompany/vpa-core@1.0.0 build
> tsc
```

✅ **No errors = success!**

Verify compiled files:

```bash
ls dist/src/
```

You should see: `index.js`, `orchestrator.js`, and all module folders.

---

## Step 5: Test Run (30 seconds)

```bash
npm run dev
```

**Expected output:**

```
[2025-10-20 ...] [info]: Initializing VPA Core...
[2025-10-20 ...] [info]: Database connected
[2025-10-20 ...] [info]: License validated
[2025-10-20 ...] [info]: VPA Core initialized successfully
[2025-10-20 ...] [info]: VPA Core MCP server started
```

✅ **If you see this, VPA Core is running!**

Press `Ctrl+C` to stop.

---

## Step 5b: Spin up the Bridge (streaming + adapters)

```bash
npm run bridge:dev
```

**What this does:** starts the local bridge server on port `4040`, registers Claude Desktop, Claude API, OpenAI, and Ollama adapters, and exposes streaming endpoints under `/uta/*`.

**Check health:**

```bash
curl http://127.0.0.1:4040/uta/heartbeat | jq
```

Look for:

- `adapters` – availability + status detail per adapter
- `telemetry` – rolling success/failure counts and average latency (populated after the first call)

---

## Step 6: Configure Claude Desktop (2 minutes)

### Option A: Manual Configuration

Edit `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "vpa-core": {
      "command": "node",
      "args": ["D:/projects/Lead gen app/vpa-core/dist/src/index.js"],
      "env": {
        "DATABASE_URL": "your-database-url-here",
        "LICENSE_KEY": "test-license-key-12345",
        "ANTHROPIC_API_KEY": "your-anthropic-key-here"
      }
    }
  }
}
```

**Important:** Use forward slashes `/` in paths, even on Windows!

### Option B: Quick Config Script (Coming Soon)

---

## Step 7: Restart Claude Desktop

1. **Quit Claude Desktop completely** (not just close window)
2. **Start Claude Desktop** again
3. VPA Core should now be available

---

## Step 8: Test VPA in Claude

Try these commands in Claude Desktop:

### Test 1: Check Status

```
User: "Check VPA status"
```

**Expected:** Claude calls `vpa_status` and shows:

- Your enabled modules
- Subscription info
- Test user details

### Test 2: Test ProspectFinder (Stub)

```
User: "Find 10 HVAC companies in Dallas"
```

**Expected:** Claude calls `vpa_prospects` and returns stub response:

```json
{
  "success": true,
  "message": "ProspectFinder module stub - integration pending",
  ...
}
```

### Test 3: Test LeadTracker (Stub)

```
User: "Show my pipeline stats"
```

**Expected:** Claude calls `vpa_pipeline` and returns stub response.

### Test 4: Test Module Access

```
User: "Find companies" (while on CRM-only plan)
```

**Expected:** Error message about ProspectFinder not being enabled.

### Test 5: Verify bridge adapters end-to-end

With the bridge running, try the automated harness:

```bash
npm run test:adapters -- --adapter ollama --message "Summarize my pipeline health"
```

You’ll see the streamed events printed in the console (including tool calls and assistant replies). Swap `--adapter` to `claude-api` or `openai` when keys are configured.

Want to exercise every available adapter in one sweep?

```bash
npm run test:adapters:all -- --include-unavailable
```

The suite compares heartbeat availability against real tool runs and exits non-zero if any adapter fails.

---

## Verification Checklist

After following all steps:

- [x] `npm install` completed successfully
- [x] `.env` file created with all required values
- [x] `npm run db:setup` created tables successfully
- [x] `npm run build` compiled without errors
- [x] `npm run dev` starts server without errors
- [x] `claude_desktop_config.json` updated
- [x] Claude Desktop restarted
- [x] VPA tools visible in Claude Desktop
- [x] Test commands return stub responses

---

## Common Issues

### "DATABASE_URL environment variable not set"

**Fix:** Make sure `.env` file exists and contains `DATABASE_URL=...`

### "Invalid license key"

**Fix:** Use `test-license-key-12345` (created by setup script)

### "Module not found" errors

**Fix:** Run `npm run build` again

### VPA not appearing in Claude Desktop

**Fix:**

1. Check `claude_desktop_config.json` syntax (use https://jsonlint.com/)
2. Ensure paths use forward slashes `/`
3. Restart Claude Desktop **completely**

### "Database connection failed"

**Fix:**

1. Verify `DATABASE_URL` is correct
2. Test connection: `psql $DATABASE_URL`
3. Check firewall/network access

---

## Next Steps

Once VPA Core is running with stubs:

### For Testing

1. Try different commands
2. Check `vpa_status` output
3. Verify usage tracking in database
4. Watch adapter telemetry: `curl http://127.0.0.1:4040/uta/heartbeat | jq '.telemetry'`
5. Stream telemetry to disk for dashboards: `npm run telemetry:stream -- --output telemetry.ndjson --interval 30000`

### For Integration (Phase 2)

1. Wire up ProspectFinder tools (replace stubs)
2. Wire up LeadTracker tools (replace stubs)
3. Wire up EmailOrchestrator tools (replace stubs)
4. Test complete workflows

### For Production

1. Create real users via admin script
2. Set up Stripe webhooks
3. Deploy to production database
4. Configure monitoring
5. Capture adapter metrics: forward `/uta/heartbeat` to your observability stack

---

## Useful Commands

```bash
# Development
npm run dev              # Run VPA Core in dev mode
npm run build            # Compile TypeScript
npm run db:setup         # Initialize database
npm run bridge:dev       # Start the adapter bridge server
npm run configure:adapters  # Interactive adapter/env configuration
npm run test:adapters       # Exercise a specific adapter via bridge
npm run test:adapters:all   # Run the full harness across configured adapters
npm run telemetry:stream    # Continuously capture bridge heartbeat/telemetry

# Database
npm run db:create-user   # Create new user (coming soon)

# Logs
tail -f logs/vpa-combined.log  # Watch logs (production)

# Verify
node dist/src/index.js   # Run compiled server directly
```

---

## Getting Help

1. **Read README.md** - Comprehensive guide
2. **Read BUILD_SUMMARY.md** - What was built
3. **Check logs** - Console output or log files
4. **Test database** - `psql $DATABASE_URL`

---

**That's it! VPA Core should now be running.** 🎉

Next: Wire up actual module tools in Phase 2.
