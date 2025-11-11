# VPA Core - Virtual Personal Assistant

**Intelligent MCP orchestrator for unified business automation**

VPA Core is the orchestration layer that unifies ProspectFinder, LeadTracker Pro, and EmailOrchestrator into a single conversational AI assistant. Instead of managing three separate MCP tools, users interact with one intelligent VPA that routes commands to the appropriate modules.

---

## What is VPA Core?

VPA (Virtual Personal Assistant) is an MCP server that provides:

- **7 Unified Tools**: `vpa_prospects`, `vpa_pipeline`, `vpa_tasks`, `vpa_email`, `vpa_status`, `vpa_configure`, `vpa_modules`
- **Intelligent Routing**: Hybrid intent parsing (keyword-first, LLM fallback)
- **Multi-Tenant**: Secure user isolation with subscription-based module access
- **Usage Tracking**: Complete analytics and billing-ready usage logs
- **Extensible Architecture**: Adding new modules is trivial

### The Problem VPA Solves

**Before VPA:**

```
User → Claude Desktop → ProspectFinder MCP (5 tools)
User → Claude Desktop → LeadTracker MCP (deprecated compatibility wrapper over LeadTracker Pro)
User → Claude Desktop → EmailOrchestrator MCP (9 tools)

Problem: User must know which MCP to use for each task
```

**After VPA:**

```
User → Claude Desktop → VPA Core MCP
                           ↓
            ┌──────────────┼──────────────┐
            ↓              ↓              ↓
  ProspectFinder   LeadTracker (deprecated)   EmailOrchestrator
       Module          Module          Module

VPA intelligently routes commands to appropriate modules
```

---

## Architecture

### Core Components

1. **MCP Server** (`src/index.ts`)

   - Main entry point

- Exposes 7 VPA tools to Claude (prospects, pipeline, tasks, email, research, modules, status)
- License validation on startup

2. **Orchestrator** (`src/orchestrator.ts`)

   - Routes commands to modules
   - Manages tool execution
   - Returns unified responses

3. **Intent Parser** (`src/intent-parser/`)

   - Keyword Parser: Fast pattern matching (80% of commands)
   - LLM Parser: Claude API fallback (20% complex queries)
   - Cost: ~$0.20/month for 1000 commands

4. **Modules** (`src/modules/`)

- ProspectFinder wrapper
- LeadTracker wrapper
- Task & Project Manager wrapper
- EmailOrchestrator wrapper
- Access control + usage tracking built-in

5. **Auth & Access Control** (`src/auth/`)

   - License key validation
   - Subscription-based module access
   - User context management

6. **Database** (`src/db/`)
   - Multi-tenant schema
   - Usage tracking
   - Subscription management

---

## Installation

### Prerequisites

- Node.js 18+
- PostgreSQL database (Neon, AWS RDS, etc.)
- Claude Desktop or Claude Mobile
- VPA license key (obtained after purchase)

### Step 1: Clone and Install

```bash
cd "D:\projects\Lead gen app\vpa-core"
npm install
```

### Step 2: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your values
# - DATABASE_URL: Your PostgreSQL connection string
# - LICENSE_KEY: Your VPA license key
# - ANTHROPIC_API_KEY: Your Anthropic API key
```

### Step 3: Setup Database

```bash
# Run database schema setup
npm run db:setup

# This will:
# - Create VPA tables (users, subscriptions, usage, config)
# - Add user_id columns to existing module tables
# - Create test user with license key
```

#### Task Manager Module Setup

The `vpa_tasks` tool is powered by the companion `task-project-manager` package. From that directory:

```bash
cd "D:/projects/Lead gen app/task-project-manager"
npm install
npm run db:setup
npx tsx scripts/test-task-tools.ts  # optional smoke test
```

The smoke script walks through add/update/focus/recommend/complete flows and cleans up the temporary task.

### Step 4: Build and Test

```bash
# Compile TypeScript
npm run build

# Test run
npm run dev
```

### Step 5: Configure Claude Desktop

Add VPA to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "vpa-core": {
      "command": "node",
      "args": ["D:/projects/Lead gen app/vpa-core/dist/index.js"],
      "env": {
        "DATABASE_URL": "your-database-url",
        "LICENSE_KEY": "your-license-key",
        "ANTHROPIC_API_KEY": "your-anthropic-key"
      }
    }
  }
}
```

Restart Claude Desktop and VPA Core will be available!

#### Optional: VS Code Terminal Shell Integration (Windows)

If you want the integrated terminal to show command decorations and allow quick command re-runs, enable VS Code's shell integration for Windows PowerShell:

1. Set the execution policy once for your user so VS Code can load its helper script:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

2. Add the snippet below to `C:\Users\<you>\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1` if VS Code hasn't already done it:

```powershell
if ($env:TERM_PROGRAM -eq "vscode") { . "$(code --locate-shell-integration-path pwsh)" }
```

This keeps strict policies in place for downloaded scripts while letting VS Code light up command tracking inside the terminal.

---

## Usage

### VPA Tools

#### 1. `vpa_prospects` - Prospect Finding

Find, scrape, and enrich B2B prospects.

```typescript
// Search for companies
{
  action: "search",
  parameters: {
    industry: "hvac",
    location: "Dallas, TX",
    max_results: 50
  }
}

// Find decision makers
{
  action: "find_contacts",
  parameters: {
    company_id: "abc-123"
  }
}

// Enrich company data
{
  action: "enrich",
  parameters: {
    company_id: "abc-123"
  }
}

// Export prospects
{
  action: "export",
  parameters: {
    format: "csv"
  }
}

// Get scraping stats
{
  action: "stats",
  parameters: {}
}
```

#### 2. `vpa_pipeline` - CRM Pipeline

Manage sales pipeline and activities.

```typescript
// Add prospect to pipeline
{
  action: "add",
  parameters: {
    company_name: "Acme Corp",
    status: "new"
  }
}

// Update prospect status
{
  action: "update",
  parameters: {
    prospect_id: "xyz-789",
    status: "qualified"
  }
}

// Log activity
{
  action: "log_activity",
  parameters: {
    prospect_id: "xyz-789",
    activity_type: "call",
    notes: "Discussed pricing"
  }
}

// Get follow-ups
{
  action: "follow_ups",
  parameters: {}
}

// Pipeline stats
{
  action: "stats",
  parameters: {}
}

// Next best actions
{
  action: "next_actions",
  parameters: {
    limit: 5
  }
}

// Win/loss analysis
{
  action: "win_loss_report",
  parameters: {
    timeframe: "quarter"
  }
}

// Next best actions
{
  action: "next_actions",
  parameters: {
    limit: 5
  }
}

// Win/loss analysis
{
  action: "win_loss_report",
  parameters: {
    timeframe: "quarter"
  }
}

// Import prospects from search
{
  action: "import",
  parameters: {
    companies: [...] // From vpa_prospects search
  }
}
```

#### 3. `vpa_tasks` - Task & Project Manager

Plan work, rebalance priorities, and generate progress insights.

```typescript
// Add a new task
{
  action: "add_task",
  parameters: {
    title: "Draft weekly status update",
    project: "Client A",
    priority: "high",
    due_date: "2024-05-03"
  }
}

// Update task status and notes
{
  action: "update_task",
  parameters: {
    task_id: "tsk_123",
    status: "in_progress",
    notes: "Waiting on budget approval"
  }
}

// Build a focus view for today
{
  action: "focus_view",
  parameters: {
    focus_mode: "today"
  }
}

// Generate a progress report per project
{
  action: "progress_report",
  parameters: {
    timeframe: "this_week"
  }
}

// Get next recommended task
{
  action: "recommend_next",
  parameters: {}
}

// Complete and archive a task
{
  action: "complete_task",
  parameters: {
    task_id: "tsk_123"
  }
}
```

#### 4. `vpa_email` - Email Campaigns

Create and manage email campaigns.

```typescript
// Create campaign
{
  action: "create_campaign",
  parameters: {
    name: "Q4 Outreach",
    subject: "..."
  }
}

// Add sequence
{
  action: "add_sequence",
  parameters: {
    campaign_id: "...",
    emails: [...]
  }
}

// Start campaign
{
  action: "start",
  parameters: {
    campaign_id: "..."
  }
}

// Get stats
{
  action: "stats",
  parameters: {
    campaign_id: "..."
  }
}
```

#### 5. `vpa_status` - System Status

Check enabled modules, usage, subscription.

```typescript
// Get enabled modules
{
  report_type: "modules";
}

// Get usage statistics
{
  report_type: "usage";
}

// Get subscription info
{
  report_type: "subscription";
}

// System health check
{
  report_type: "health";
}

// Voice-friendly daily brief
{
  report_type: "daily_brief";
}
```

#### 6. `vpa_configure` - Settings

Configure VPA preferences.

```typescript
{
  setting: "default_timezone",
  value: "America/New_York"
}
```

#### 7. `vpa_modules` - Module Discovery

Browse enabled modules, locked upgrades, and quick actions.

```typescript
{
  action: "list";
}
```

Returns module catalog with voice-ready quick actions and upgrade hints.

---

## User Workflows

### Complete Lead Generation Workflow

**Step 1: Find Prospects**

```
User: "Find 50 HVAC companies in Dallas"
Claude calls: vpa_prospects { action: "search", ... }
Result: 50 companies found
```

**Step 2: Import to Pipeline**

```
User: "Add those to my pipeline"
 Claude calls: vpa_pipeline { action: "import", companies: [...] }
 Result: Legacy LeadTracker wrapper routes request to LeadTracker Pro and imports 50 prospects with status "new"
```

**Step 3: Create Email Campaign**

```
User: "Create an email campaign for these prospects"
Claude calls: vpa_email { action: "create_campaign", ... }
Result: Campaign created
```

**Step 4: Track Progress**

```
User: "Log call with John at Acme Corp - interested, follow up Friday"
Claude calls: vpa_pipeline { action: "log_activity", ... }
Result: Activity logged with follow-up scheduled
```

### Unified Bridge (Web & Mobile Clients)

Run the bridge server to funnel web or mobile chat into the VPA runtime (Claude Desktop by default, with failover to cloud adapters).

```bash
npm run bridge:dev
```

Endpoints:

- `POST /uta/session` – create session and receive `sessionId`, `sessionToken`
- `POST /uta/message` – send user text; orchestrator routes the request
- `GET /uta/session/:id/stream` – subscribe via Server-Sent Events
- `POST /uta/tool-result` – adapters post tool payloads back to the VPA
- `GET /uta/heartbeat` – inspect active sessions and runtime config

Environment flags control adapter order and failover:

```env
VPA_RUNTIME_MODE=claude-desktop
VPA_ADAPTER_PRIORITY=claude-desktop,claude-api,openai,gemini,ollama
VPA_FAILOVER_ENABLED=true
CLAUDE_API_MODEL=claude-3-5-sonnet-20241022  # optional override when Anthropic adapter active
OPENAI_API_KEY=sk-...                       # enables OpenAI adapter as another fallback
OPENAI_ROUTER_MODEL=gpt-4o-mini             # optional override for routing prompts
```

When `ANTHROPIC_API_KEY` is present, the bridge automatically enables the Claude API adapter and will fall back to it if the local Claude Desktop bridge is offline. `CLAUDE_API_MODEL` lets you switch Anthropic models without code changes.
When `OPENAI_API_KEY` is configured, the OpenAI adapter slots into the failover chain so conversations keep running even if Claude services are unavailable.

These settings feed the cross-LLM adapter layer described in `CROSS_LLM_ADAPTERS.md`.

---

## Adding New Modules

VPA Core is designed for EASY module addition. Follow these steps:

### 1. Add Module to Registry

Edit `src/modules/registry.ts`:

```typescript
export const MODULE_REGISTRY: Record<string, ModuleDefinition> = {
  // ... existing modules

  "new-module": {
    id: "new-module",
    name: "New Module",
    description: "What this module does",
    version: "1.0.0",
    tools: ["tool1", "tool2"],
    pricingTier: "premium",
    required: false,
  },
};
```

### 2. Create Module Wrapper

Create `src/modules/new-module.module.ts`:

```typescript
import { requireModuleAccess } from "../auth/module-access.js";
import { trackUsage, createUsageRecord } from "../db/usage.js";

const MODULE_ID = "new-module";

export class NewModule {
  async tool1(params: any, userId: string): Promise<any> {
    await requireModuleAccess(userId, MODULE_ID);
    // ... your logic
    await trackUsage(createUsageRecord(userId, MODULE_ID, "tool1"));
    return result;
  }
}
```

### 3. Add Routing

Edit `src/orchestrator.ts`:

```typescript
import { NewModule } from './modules/new-module.module.js';

const newModule = new NewModule();

// Add case to executeVPATool
case 'vpa_newmodule':
  return await routeToNewModule(action, parameters, userId);
```

### 4. Update Pricing (if needed)

Edit `src/config/pricing.ts` to include the module in plans.

That's it! No database migrations needed. The module is immediately available to users with the right subscription.

---

## Development

### Project Structure

```
vpa-core/
├── src/
│   ├── index.ts                 # MCP server entry point
│   ├── orchestrator.ts          # Routing logic
│   ├── modules/
│   │   ├── registry.ts          # Module definitions
│   │   ├── prospect-finder.module.ts
│   │   ├── lead-tracker.module.ts
│   │   └── email-orchestrator.module.ts
│   ├── intent-parser/
│   │   ├── keyword-parser.ts    # Fast pattern matching
│   │   └── llm-parser.ts        # Claude API fallback
│   ├── auth/
│   │   ├── license.ts           # License validation
│   │   └── module-access.ts     # Access control
│   ├── db/
│   │   ├── client.ts            # Database connection
│   │   ├── schema.sql           # Database schema
│   │   └── usage.ts             # Usage tracking
│   ├── config/
│   │   └── pricing.ts           # Pricing plans (easily changeable!)
│   └── utils/
│       ├── logger.ts            # Winston logging
│       └── errors.ts            # Custom error classes
├── scripts/
│   └── setup-database.ts        # Database initialization
├── package.json
├── tsconfig.json
└── README.md
```

### Running Tests

```bash
# Run tests (once implemented)
npm test
```

### Building

```bash
# Compile TypeScript
npm run build

# Output in dist/
```

### Development Mode

```bash
# Run with auto-reload
npm run dev
```

---

## Database Schema

VPA Core uses PostgreSQL with multi-tenant architecture:

### Core Tables

- **users**: User accounts and license keys
- **user_subscriptions**: Subscription plans and module access
- **user_usage**: Tool execution tracking for analytics
- **user_module_config**: Per-user module settings

### Existing Tables (Modified)

VPA adds `user_id` column to:

- **companies** (ProspectFinder)
- **prospects** (LeadTracker)
- **contacts** (LeadTracker)
- **activities** (LeadTracker)
- **campaigns** (EmailOrchestrator)

This ensures data isolation between users.

---

## Pricing & Subscriptions

VPA uses subscription-based access control. Pricing is centralized in `src/config/pricing.ts` for easy changes.

### Current Plans

1. **CRM Starter** - $30/month

   - VPA Core + LeadTracker

2. **Growth Plan** - $80/month

   - Core + LeadTracker + ProspectFinder

3. **Outreach Plan** - $55/month

   - Core + LeadTracker + EmailOrchestrator

4. **Complete Bundle** - $99/month (saves $25.50)
   - All modules included

### Changing Pricing

Simply edit `src/config/pricing.ts` - no other code changes needed!

---

## Troubleshooting

### Common Issues

**"Invalid license key"**

- Check LICENSE_KEY in .env matches your subscription
- Verify subscription is active in database

**"Module not enabled"**

- Your subscription doesn't include this module
- Upgrade plan to access

**Database connection failed**

- Verify DATABASE_URL is correct
- Check network connectivity to database
- Ensure SSL mode matches (sslmode=require for Neon)

**MCP server not appearing in Claude**

- Verify claude_desktop_config.json syntax
- Check file path is absolute
- Restart Claude Desktop completely

### Logs

Logs are written to console (development) or files (production):

- `logs/vpa-error.log` - Errors only
- `logs/vpa-combined.log` - All logs

Set `LOG_LEVEL=debug` in .env for verbose logging.

---

## Contributing

VPA Core is designed for Mike's consultancy. Contributions should align with business goals:

1. Elegant, production-ready code
2. Comprehensive error handling
3. Clear documentation
4. Business value explained

---

## License

Proprietary - Mike's AI-runnable business project

---

## Support

For issues or questions:

1. Check this README
2. Review logs for errors
3. Contact Mike

---

## Roadmap

### Phase 1: MVP (Current)

- ✅ VPA Core orchestration
- ✅ 3 module integrations (stubs)
- ✅ Multi-tenant database
- ✅ License validation
- ⏳ Wire up actual module tools

### Phase 2: Integration (Weeks 2-5)

- Wire ProspectFinder tools
- Wire LeadTracker tools
- Wire EmailOrchestrator tools
- End-to-end testing

### Phase 3: Polish (Week 6)

- Billing webhook integration
- Usage-based limits
- Admin dashboard
- Documentation videos

### Phase 4: Launch (Week 7)

- NPM package publish
- Customer onboarding
- Beta customer support

---

**Built with elegance by Forge for Mike's vision** 🚀
