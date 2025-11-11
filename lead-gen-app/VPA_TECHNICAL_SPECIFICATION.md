# VPA (Virtual Personal Assistant) - Technical Specification

**Version:** 1.0
**Date:** October 20, 2025
**Architect:** Forge
**Owner:** Mike

---

## EXECUTIVE SUMMARY

**What We're Building:**
A Model Context Protocol (MCP) orchestrator that unifies ProspectFinder, LeadTracker Pro, and EmailOrchestrator into a single conversational AI assistant for solopreneurs.

> **Deprecation Notice:** The legacy LeadTracker MCP is now deprecated and maintained only as a compatibility wrapper that delegates 100% of CRM operations to LeadTracker Pro. All new integrations should target LeadTracker Pro directly.

**Business Model:**

- Phase 1: MCP-based (Claude Desktop/Mobile) - $99/month all-inclusive
- Phase 2: Web app for non-technical users - $129/month (includes Claude API costs)

**Timeline:** 6-7 weeks to MVP
**Target Market:** Technical solopreneurs who use Claude Desktop/Mobile
**Moat:** First-to-market AI-native business OS via MCP

---

## ARCHITECTURE OVERVIEW

### Current State (3 Standalone MCPs)

```
User → Claude Desktop → ProspectFinder MCP (5 tools)
User → Claude Desktop → LeadTracker MCP (deprecated compatibility wrapper, 8 tools)
User → Claude Desktop → EmailOrchestrator MCP (9 tools)

Problem: User must know which MCP to use for each task
```

### Future State (Unified VPA)

```
User → Claude Desktop/Mobile → VPA Core MCP
                                   ↓
                    ┌──────────────┼──────────────┐
                    ↓              ↓              ↓
            ProspectFinder   LeadTracker (deprecated)   EmailOrchestrator
               Module          Module          Module

VPA intelligently routes commands to appropriate modules
```

---

## CORE DESIGN DECISIONS

### 1. Interface Strategy: **Multiple Module-Specific Tools**

VPA exposes these tools to Claude:

```typescript
1. vpa_prospects    // ProspectFinder operations
2. vpa_pipeline     // LeadTracker (legacy wrapper over LeadTracker Pro) CRM operations
3. vpa_email        // EmailOrchestrator campaigns
4. vpa_status       // System status, usage, enabled modules
5. vpa_configure    // User preferences
```

**Why module-specific tools:**

- Clear separation of concerns
- Less ambiguity in routing
- Easier debugging
- Claude can intelligently choose correct tool

**User Experience:**

```
User: "Find 50 HVAC companies in Dallas"
Claude: [calls vpa_prospects tool]
VPA: [routes to ProspectFinder module]

User: "Add those to my pipeline"
Claude: [calls vpa_pipeline tool]
VPA: [routes to LeadTracker module (deprecated wrapper) with context from previous result]
```

### 2. Intent Parsing: **Hybrid Approach**

```typescript
// Step 1: Try keyword matching (fast, free)
const quickMatch = keywordParser(command);
if (quickMatch.confidence > 0.9) {
  return quickMatch;
}

// Step 2: Fall back to LLM parsing (robust, small cost)
return await claudeParser(command);
```

**Cost Analysis:**

- 80% of commands: keyword matched (~0ms, $0)
- 20% complex: Claude API (~200ms, $0.001)
- At 1000 commands/month: **~$0.20 total**

### 3. Billing: **Manual → Stripe Migration**

**Phase 1 (First 50 customers):** Manual subscription management

- Admin creates user records in database
- Admin assigns modules via SQL
- Stripe checkout for payment (webhook creates user)
- Good enough for validation

**Phase 2 (Scale):** Full Stripe integration

- Webhook automation
- Self-service plan changes
- Usage-based billing (future)

### 4. Deployment: **MCP Server (Claude Desktop/Mobile)**

**User Setup Flow:**

```bash
# 1. Install VPA globally
npm install -g @yourcompany/vpa-core

# 2. Initialize with license key
vpa-init --license YOUR_LICENSE_KEY

# 3. Auto-configures claude_desktop_config.json
# User restarts Claude Desktop

# 4. Ready to use!
```

**What this means:**

- VPA runs locally on user's machine (MCP server)
- Connects to shared Neon database (multi-tenant)
- User talks through Claude Desktop or Claude Mobile
- Zero API costs (user's Claude subscription)

---

## DATABASE SCHEMA

### New Tables (VPA Multi-Tenancy)

```sql
-- User Management
CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  license_key VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'active', -- active, suspended, cancelled
  metadata JSONB -- Store preferences, settings
);

-- Subscription Management
CREATE TABLE user_subscriptions (
  subscription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  plan_name VARCHAR(100) NOT NULL, -- 'starter', 'professional', 'bundle'
  modules TEXT[] NOT NULL, -- ['vpa-core', 'prospect-finder', 'lead-tracker', 'email-orchestrator']
  price_monthly INTEGER NOT NULL, -- in cents: 9900 = $99.00
  status VARCHAR(50) DEFAULT 'active', -- active, past_due, cancelled, trialing
  trial_end TIMESTAMP,
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Usage Tracking
CREATE TABLE user_usage (
  usage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  module_id VARCHAR(100) NOT NULL, -- 'prospect-finder', 'lead-tracker', etc.
  tool_name VARCHAR(100) NOT NULL, -- 'search_companies', 'add_prospect', etc.
  command_text TEXT, -- Original user command (for analytics)
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  execution_time_ms INTEGER,
  timestamp TIMESTAMP DEFAULT NOW(),
  metadata JSONB -- Results count, parameters, etc.
);

CREATE INDEX idx_user_usage_user_module ON user_usage(user_id, module_id, timestamp DESC);
CREATE INDEX idx_user_usage_timestamp ON user_usage(timestamp DESC);

-- Module Configurations (per-user settings)
CREATE TABLE user_module_config (
  config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  module_id VARCHAR(100) NOT NULL,
  config_key VARCHAR(100) NOT NULL,
  config_value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, module_id, config_key)
);
```

### Existing Tables (Add user_id for multi-tenancy)

```sql
-- Add user_id to existing tables
ALTER TABLE companies ADD COLUMN user_id UUID REFERENCES users(user_id);
ALTER TABLE prospects ADD COLUMN user_id UUID REFERENCES users(user_id);
ALTER TABLE campaigns ADD COLUMN user_id UUID REFERENCES users(user_id);

-- Add indexes
CREATE INDEX idx_companies_user ON companies(user_id);
CREATE INDEX idx_prospects_user ON prospects(user_id);
CREATE INDEX idx_campaigns_user ON campaigns(user_id);

-- Row-level security (future enhancement)
-- Ensures users can only see their own data
```

---

## MODULE REGISTRY

### Static Module Definitions

```typescript
// vpa-core/src/modules/registry.ts

export interface ModuleDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  tools: string[];
  pricingTier: "core" | "standard" | "premium";
  required: boolean; // Is this module required for VPA Core to function?
}

export const MODULE_REGISTRY: Record<string, ModuleDefinition> = {
  "vpa-core": {
    id: "vpa-core",
    name: "VPA Core",
    description: "Core orchestration and user management",
    version: "1.0.0",
    tools: ["vpa_status", "vpa_configure"],
    pricingTier: "core",
    required: true,
  },

  "lead-tracker": {
    id: "lead-tracker",
    name: "LeadTracker Pro",
    description: "CRM pipeline management and activity tracking",
    version: "1.0.0",
    tools: [
      "add_prospect",
      "add_contact",
      "update_prospect_status",
      "log_activity",
      "search_prospects",
      "get_follow_ups",
      "get_pipeline_stats",
      "import_prospects",
    ],
    pricingTier: "core", // Included in base VPA
    required: true,
  },

  "prospect-finder": {
    id: "prospect-finder",
    name: "ProspectFinder",
    description: "B2B prospect scraping and enrichment",
    version: "1.0.0",
    tools: [
      "search_companies",
      "find_decision_makers",
      "enrich_company",
      "export_prospects",
      "get_scraping_stats",
    ],
    pricingTier: "premium",
    required: false,
  },

  "email-orchestrator": {
    id: "email-orchestrator",
    name: "EmailOrchestrator",
    description: "Email campaigns and automation",
    version: "1.0.0",
    tools: [
      "create_campaign",
      "add_email_sequence",
      "start_campaign",
      "create_template",
      "send_email",
      "get_campaign_stats",
      "pause_resume_campaign",
      "get_email_history",
      "manage_unsubscribes",
    ],
    pricingTier: "premium",
    required: false,
  },
};
```

### Pricing Configuration (Changeable as Requested)

```typescript
// vpa-core/src/config/pricing.ts

export interface PricingPlan {
  id: string;
  name: string;
  priceMonthly: number; // in cents
  modules: string[];
  limits?: {
    monthlyProspects?: number;
    monthlyCampaigns?: number;
    monthlyEmails?: number;
  };
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "vpa-core-only",
    name: "VPA Core (CRM Only)",
    priceMonthly: 3000, // $30.00
    modules: ["vpa-core", "lead-tracker"],
  },

  {
    id: "vpa-plus-prospects",
    name: "VPA + ProspectFinder",
    priceMonthly: 8000, // $80.00
    modules: ["vpa-core", "lead-tracker", "prospect-finder"],
  },

  {
    id: "vpa-plus-email",
    name: "VPA + Email",
    priceMonthly: 5500, // $55.00
    modules: ["vpa-core", "lead-tracker", "email-orchestrator"],
  },

  {
    id: "vpa-bundle",
    name: "VPA Complete Bundle",
    priceMonthly: 9900, // $99.00 (save $25.50)
    modules: [
      "vpa-core",
      "lead-tracker",
      "prospect-finder",
      "email-orchestrator",
    ],
  },
];

// Easy to update pricing - just change values here
// Can also load from database for dynamic pricing
```

---

## VPA CORE TOOLS

### Tool 1: `vpa_prospects`

**Purpose:** Route prospect-finding commands to ProspectFinder module

```typescript
{
  name: 'vpa_prospects',
  description: 'Find, scrape, and enrich B2B prospects. Search companies by industry/location, find decision makers, enrich data.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['search', 'find_contacts', 'enrich', 'export', 'stats'],
        description: 'What to do with prospects'
      },
      parameters: {
        type: 'object',
        description: 'Action-specific parameters (varies by action)'
      }
    },
    required: ['action']
  }
}
```

**Example Usage:**

```typescript
// User: "Find 50 HVAC companies in Dallas"
vpa_prospects({
  action: "search",
  parameters: {
    industry: "hvac",
    location: "Dallas, TX",
    max_results: 50,
  },
});

// User: "Find decision makers at that company"
vpa_prospects({
  action: "find_contacts",
  parameters: {
    company_id: "abc-123",
  },
});
```

### Tool 2: `vpa_pipeline`

**Purpose:** Route CRM operations to LeadTracker module (deprecated wrapper over LeadTracker Pro)

```typescript
{
  name: 'vpa_pipeline',
  description: 'Manage sales pipeline, track prospects, log activities, schedule follow-ups.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['add', 'update', 'search', 'log_activity', 'follow_ups', 'stats', 'import'],
        description: 'Pipeline action to perform'
      },
      parameters: {
        type: 'object',
        description: 'Action-specific parameters'
      }
    },
    required: ['action']
  }
}
```

**Example Usage:**

```typescript
// User: "Add those companies to my pipeline"
vpa_pipeline({
  action: 'import',
  parameters: {
    companies: [...], // From previous vpa_prospects result
    status: 'new',
    tags: ['hvac', 'dallas', 'q4-2024']
  }
})

// User: "Log a call - talked to John, interested, follow up Friday"
vpa_pipeline({
  action: 'log_activity',
  parameters: {
    prospect_id: 'xyz-789',
    activity_type: 'call',
    outcome: 'answered',
    notes: 'Talked to John, interested in our services',
    follow_up_date: '2024-10-25'
  }
})
```

### Tool 3: `vpa_email`

**Purpose:** Route email operations to EmailOrchestrator module

```typescript
{
  name: 'vpa_email',
  description: 'Create campaigns, send emails, track performance.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['create_campaign', 'add_sequence', 'start', 'send_one', 'stats', 'pause', 'history'],
        description: 'Email action to perform'
      },
      parameters: {
        type: 'object',
        description: 'Action-specific parameters'
      }
    },
    required: ['action']
  }
}
```

### Tool 4: `vpa_status`

**Purpose:** Show user's enabled modules, usage stats, system health

```typescript
{
  name: 'vpa_status',
  description: 'Check VPA status, enabled modules, usage statistics.',
  inputSchema: {
    type: 'object',
    properties: {
      report_type: {
        type: 'string',
        enum: ['modules', 'usage', 'subscription', 'health'],
        description: 'Type of status report'
      }
    }
  }
}
```

**Example Response:**

```json
{
  "user": {
    "email": "mike@example.com",
    "plan": "VPA Complete Bundle",
    "status": "active"
  },
  "modules": {
    "vpa-core": { "enabled": true, "version": "1.0.0" },
    "lead-tracker": { "enabled": true, "version": "1.0.0" },
    "prospect-finder": { "enabled": true, "version": "1.0.0" },
    "email-orchestrator": { "enabled": true, "version": "1.0.0" }
  },
  "usage_this_month": {
    "prospects_found": 1247,
    "pipeline_activities": 89,
    "emails_sent": 342
  },
  "subscription": {
    "current_period_end": "2024-11-20",
    "days_remaining": 10
  }
}
```

### Tool 5: `vpa_configure`

**Purpose:** User preferences and module settings

```typescript
{
  name: 'vpa_configure',
  description: 'Configure VPA preferences and module settings.',
  inputSchema: {
    type: 'object',
    properties: {
      setting: {
        type: 'string',
        description: 'Setting to configure (e.g., "default_timezone", "email_signature")'
      },
      value: {
        description: 'New value for setting'
      }
    },
    required: ['setting', 'value']
  }
}
```

---

## INTENT PARSING (HYBRID APPROACH)

### Keyword Parser (Fast Path)

```typescript
// vpa-core/src/intent-parser/keyword-parser.ts

interface ParsedIntent {
  tool: string; // 'vpa_prospects', 'vpa_pipeline', etc.
  action: string;
  parameters: Record<string, any>;
  confidence: number; // 0.0 - 1.0
}

export function keywordParser(command: string): ParsedIntent | null {
  const lower = command.toLowerCase();

  // Prospect finding patterns
  if (
    lower.includes("find") &&
    (lower.includes("companies") || lower.includes("prospects"))
  ) {
    return {
      tool: "vpa_prospects",
      action: "search",
      parameters: extractSearchParams(command),
      confidence: 0.95,
    };
  }

  // Pipeline patterns
  if (lower.includes("add to pipeline") || lower.includes("add to crm")) {
    return {
      tool: "vpa_pipeline",
      action: "import",
      parameters: {},
      confidence: 0.9,
    };
  }

  if (lower.includes("log") && lower.includes("call")) {
    return {
      tool: "vpa_pipeline",
      action: "log_activity",
      parameters: { activity_type: "call" },
      confidence: 0.92,
    };
  }

  // Email patterns
  if (lower.includes("send email") || lower.includes("create campaign")) {
    return {
      tool: "vpa_email",
      action: lower.includes("campaign") ? "create_campaign" : "send_one",
      parameters: {},
      confidence: 0.88,
    };
  }

  // Not confident enough - return null to trigger LLM parsing
  return null;
}

function extractSearchParams(command: string): Record<string, any> {
  const params: Record<string, any> = {};

  // Extract industry
  const industries = ["hvac", "plumbing", "electrical", "roofing"];
  for (const ind of industries) {
    if (command.toLowerCase().includes(ind)) {
      params.industry = ind;
      break;
    }
  }

  // Extract location (simple pattern matching)
  const locationMatch = command.match(/in ([A-Z][a-z]+(?:,?\s+[A-Z]{2})?)/);
  if (locationMatch) {
    params.location = locationMatch[1];
  }

  // Extract number
  const numberMatch = command.match(/(\d+)/);
  if (numberMatch) {
    params.max_results = parseInt(numberMatch[1]);
  }

  return params;
}
```

### LLM Parser (Smart Path)

```typescript
// vpa-core/src/intent-parser/llm-parser.ts

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function llmParser(
  command: string,
  userId: string
): Promise<ParsedIntent> {
  const prompt = `You are an intent parser for a VPA (Virtual Personal Assistant) system.

Parse this user command into a structured intent:
"${command}"

Available tools:
- vpa_prospects: Finding/enriching B2B prospects
- vpa_pipeline: Managing CRM pipeline and activities
- vpa_email: Email campaigns and sending
- vpa_status: Check system status
- vpa_configure: Change settings

Respond with JSON only:
{
  "tool": "vpa_prospects",
  "action": "search",
  "parameters": { "industry": "hvac", "location": "Dallas, TX", "max_results": 50 }
}`;

  const response = await anthropic.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  const parsed = JSON.parse(content.text);

  return {
    ...parsed,
    confidence: 1.0, // LLM parsing is always confident
  };
}
```

### Orchestrator (Combines Both)

```typescript
// vpa-core/src/orchestrator.ts

export async function parseAndRoute(
  command: string,
  userId: string
): Promise<ParsedIntent> {
  // Try keyword parsing first (fast, free)
  const quickParse = keywordParser(command);

  if (quickParse && quickParse.confidence > 0.85) {
    logger.info("Intent parsed via keywords", { command, intent: quickParse });
    return quickParse;
  }

  // Fall back to LLM parsing (robust, small cost)
  logger.info("Intent parsing via LLM", { command });
  const llmParse = await llmParser(command, userId);

  return llmParse;
}
```

---

## MODULE ACCESS CONTROL

### Checking User's Enabled Modules

```typescript
// vpa-core/src/auth/module-access.ts

export class ModuleAccessError extends Error {
  constructor(
    public moduleName: string,
    public upgradeUrl: string = "https://yourapp.com/pricing"
  ) {
    super(`${moduleName} module not enabled. Please upgrade your plan.`);
    this.name = "ModuleAccessError";
  }
}

export async function checkModuleAccess(
  userId: string,
  moduleId: string
): Promise<boolean> {
  // Get user's subscription
  const subscription = await db.query(
    `SELECT modules, status
     FROM user_subscriptions
     WHERE user_id = $1
     AND status = 'active'
     AND current_period_end > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );

  if (subscription.rows.length === 0) {
    throw new Error("No active subscription found");
  }

  const { modules, status } = subscription.rows[0];

  // Check if module is in user's plan
  return modules.includes(moduleId);
}

export async function requireModuleAccess(
  userId: string,
  moduleId: string
): Promise<void> {
  const hasAccess = await checkModuleAccess(userId, moduleId);

  if (!hasAccess) {
    const moduleName = MODULE_REGISTRY[moduleId]?.name || moduleId;
    throw new ModuleAccessError(moduleName);
  }
}
```

### Usage in Module Functions

```typescript
// Example: ProspectFinder module

export async function searchCompanies(args: any, userId: string) {
  // Check access first
  await requireModuleAccess(userId, "prospect-finder");

  // Track usage
  await trackUsage(userId, "prospect-finder", "search_companies", args);

  // Execute existing logic
  const results = await searchCompaniesTool(args, true);

  return results;
}
```

---

## MIGRATION PATH FROM EXISTING MCPs

### Phase 1: Add User ID to Existing Tools

**Before (standalone MCP):**

```typescript
// prospect-finder-mcp/src/tools/search-companies.tool.ts

export async function searchCompaniesTool(args, dbConnected) {
  const results = await scrapeYellowPages(args);
  return { content: [{ type: "text", text: JSON.stringify(results) }] };
}
```

**After (VPA-compatible):**

```typescript
export async function searchCompaniesTool(
  args,
  dbConnected,
  userId?: string // ← NEW: Optional user ID
) {
  // NEW: Multi-tenant data filtering
  if (userId) {
    args.userId = userId; // Pass to scraper
  }

  const results = await scrapeYellowPages(args);

  // NEW: Store results with user_id
  if (userId && results.length > 0) {
    await saveCompanies(results, userId);
  }

  return { content: [{ type: "text", text: JSON.stringify(results) }] };
}
```

**Backwards Compatible:** Existing standalone MCP still works (userId is optional)

### Phase 2: Create Module Wrappers

```typescript
// vpa-core/src/modules/prospect-finder.module.ts

import { searchCompaniesTool } from "../../../prospect-finder-mcp/src/tools/search-companies.tool.js";
import { requireModuleAccess, trackUsage } from "../auth/module-access.js";

export class ProspectFinderModule {
  async searchCompanies(args: any, userId: string) {
    // Check access
    await requireModuleAccess(userId, "prospect-finder");

    // Track usage
    await trackUsage(userId, "prospect-finder", "search_companies", args);

    // Call existing tool with userId
    return await searchCompaniesTool(args, true, userId);
  }

  async findDecisionMakers(args: any, userId: string) {
    await requireModuleAccess(userId, "prospect-finder");
    await trackUsage(userId, "prospect-finder", "find_decision_makers", args);
    return await findDecisionMakersTool(args, true, userId);
  }

  // ... repeat for all tools
}
```

### Phase 3: VPA Routes to Modules

```typescript
// vpa-core/src/orchestrator.ts

import { ProspectFinderModule } from "./modules/prospect-finder.module.js";
import { LeadTrackerModule } from "./modules/lead-tracker.module.js";
import { EmailOrchestratorModule } from "./modules/email-orchestrator.module.js";

const prospectFinder = new ProspectFinderModule();
const leadTracker = new LeadTrackerModule();
const emailOrchestrator = new EmailOrchestratorModule();

export async function executeVPATool(
  tool: string,
  action: string,
  parameters: any,
  userId: string
) {
  switch (tool) {
    case "vpa_prospects":
      return await routeToProspectFinder(action, parameters, userId);

    case "vpa_pipeline":
      return await routeToLeadTracker(action, parameters, userId);

    case "vpa_email":
      return await routeToEmailOrchestrator(action, parameters, userId);

    default:
      throw new Error(`Unknown VPA tool: ${tool}`);
  }
}

async function routeToProspectFinder(
  action: string,
  params: any,
  userId: string
) {
  switch (action) {
    case "search":
      return await prospectFinder.searchCompanies(params, userId);
    case "find_contacts":
      return await prospectFinder.findDecisionMakers(params, userId);
    case "enrich":
      return await prospectFinder.enrichCompany(params, userId);
    // ... etc
  }
}
```

---

## FOLDER STRUCTURE

```
Lead gen app/
├─ vpa-core/                           # NEW - VPA orchestrator
│  ├─ src/
│  │  ├─ index.ts                      # MCP server entry point
│  │  ├─ orchestrator.ts               # Main routing logic
│  │  ├─ intent-parser/
│  │  │  ├─ keyword-parser.ts          # Fast keyword matching
│  │  │  └─ llm-parser.ts              # Claude API fallback
│  │  ├─ modules/
│  │  │  ├─ registry.ts                # Module definitions
│  │  │  ├─ prospect-finder.module.ts  # ProspectFinder wrapper
│  │  │  ├─ lead-tracker.module.ts     # LeadTracker wrapper
│  │  │  └─ email-orchestrator.module.ts
│  │  ├─ auth/
│  │  │  ├─ license.ts                 # License key validation
│  │  │  ├─ module-access.ts           # Module access control
│  │  │  └─ user-context.ts            # User session management
│  │  ├─ db/
│  │  │  ├─ client.ts                  # Database connection
│  │  │  ├─ users.ts                   # User queries
│  │  │  ├─ subscriptions.ts           # Subscription queries
│  │  │  └─ usage.ts                   # Usage tracking
│  │  ├─ config/
│  │  │  ├─ pricing.ts                 # Pricing plans (changeable)
│  │  │  └─ modules.ts                 # Module config
│  │  └─ utils/
│  │     ├─ logger.ts                  # Winston logging
│  │     └─ errors.ts                  # Custom error types
│  ├─ scripts/
│  │  ├─ setup-database.ts             # VPA schema setup
│  │  ├─ create-user.ts                # Admin: create user
│  │  └─ grant-modules.ts              # Admin: grant modules to user
│  ├─ package.json
│  ├─ tsconfig.json
│  └─ README.md
│
├─ prospect-finder-mcp/                # EXISTING - Minor changes
│  └─ src/
│     └─ tools/
│        └─ *.tool.ts                  # Add optional userId param
│
├─ leadtracker-pro/                    # EXISTING - Minor changes
│  └─ src/
│     └─ tools/
│        └─ *.tool.ts                  # Add optional userId param
│
├─ email-orchestrator/                 # EXISTING - Minor changes
│  └─ src/
│     └─ tools/
│        └─ *.tool.ts                  # Add optional userId param
│
└─ shared/                             # NEW - Shared TypeScript types
   ├─ types/
   │  ├─ user.types.ts
   │  ├─ subscription.types.ts
   │  └─ module.types.ts
   └─ utils/
      └─ validation.ts
```

---

## USER ONBOARDING FLOW

### Step 1: User Signs Up on Website

```
1. User visits yourapp.com/pricing
2. Selects plan (e.g., "VPA Complete Bundle - $99/month")
3. Stripe checkout → Payment collected
4. Stripe webhook creates user record in database
5. System generates license key
6. User receives email:
   - License key
   - Installation instructions
   - Link to setup guide
```

### Step 2: User Installs VPA

**Option A: NPM Global Install (Easiest)**

```bash
npm install -g @yourcompany/vpa-core
vpa-init --license YOUR_LICENSE_KEY_HERE
```

**Option B: Manual Setup**

```bash
# 1. Clone or download VPA
git clone https://github.com/yourcompany/vpa-core.git
cd vpa-core
npm install
npm run build

# 2. Configure Claude Desktop
# Auto-configuration script
npm run configure-claude -- --license YOUR_LICENSE_KEY
```

**What `vpa-init` does:**

1. Validates license key against database
2. Fetches user's enabled modules
3. Configures `claude_desktop_config.json` automatically
4. Tests connection to database
5. Prints success message

### Step 3: User Restarts Claude Desktop

```
1. Quit Claude Desktop completely
2. Relaunch Claude Desktop
3. VPA tools now available
```

### Step 4: User Verifies Setup

In Claude Desktop:

```
User: "Check VPA status"
Claude: [calls vpa_status tool]
VPA: Returns enabled modules, subscription info
```

**Total setup time: ~5 minutes**

---

## AUTHENTICATION FLOW

### License Key Validation

```typescript
// vpa-core/src/auth/license.ts

export async function validateLicenseKey(licenseKey: string): Promise<User> {
  const result = await db.query(
    `SELECT u.user_id, u.email, u.name, u.status, s.modules
     FROM users u
     JOIN user_subscriptions s ON u.user_id = s.user_id
     WHERE u.license_key = $1
     AND u.status = 'active'
     AND s.status = 'active'
     AND s.current_period_end > NOW()`,
    [licenseKey]
  );

  if (result.rows.length === 0) {
    throw new Error("Invalid or expired license key");
  }

  return result.rows[0];
}
```

### Session Management

```typescript
// VPA server maintains user context per MCP connection

class VPAServer {
  private userContext: Map<string, User> = new Map();

  async initialize(licenseKey: string) {
    const user = await validateLicenseKey(licenseKey);
    this.userContext.set("current", user);
  }

  getCurrentUser(): User {
    const user = this.userContext.get("current");
    if (!user) {
      throw new Error("VPA not initialized. Run vpa-init with license key.");
    }
    return user;
  }
}
```

---

## USAGE TRACKING

### Track Every Command

```typescript
// vpa-core/src/db/usage.ts

export async function trackUsage(
  userId: string,
  moduleId: string,
  toolName: string,
  parameters: any,
  success: boolean = true,
  errorMessage?: string,
  executionTimeMs?: number
) {
  await db.query(
    `INSERT INTO user_usage
     (user_id, module_id, tool_name, command_text, success, error_message, execution_time_ms, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      userId,
      moduleId,
      toolName,
      JSON.stringify(parameters), // Store for analytics
      success,
      errorMessage || null,
      executionTimeMs || null,
      { parameters }, // Store full params as JSONB
    ]
  );
}
```

### Usage Analytics (For Admin Dashboard)

```sql
-- Most used modules
SELECT module_id, COUNT(*) as usage_count
FROM user_usage
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY module_id
ORDER BY usage_count DESC;

-- Active users
SELECT COUNT(DISTINCT user_id) as active_users
FROM user_usage
WHERE timestamp > NOW() - INTERVAL '7 days';

-- Error rate
SELECT
  module_id,
  COUNT(*) FILTER (WHERE success = false) * 100.0 / COUNT(*) as error_rate
FROM user_usage
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY module_id;
```

---

## ERROR HANDLING

### User-Friendly Error Messages

```typescript
// vpa-core/src/utils/errors.ts

export class VPAError extends Error {
  constructor(
    message: string,
    public userMessage: string, // What user sees
    public errorCode: string,
    public upgradeUrl?: string
  ) {
    super(message);
    this.name = "VPAError";
  }
}

export class ModuleNotEnabledError extends VPAError {
  constructor(moduleName: string) {
    super(
      `User attempted to access disabled module: ${moduleName}`,
      `${moduleName} is not included in your current plan. Upgrade to access this feature.`,
      "MODULE_NOT_ENABLED",
      "https://yourapp.com/pricing"
    );
  }
}

export class LicenseExpiredError extends VPAError {
  constructor() {
    super(
      "User license has expired",
      "Your subscription has expired. Please renew to continue using VPA.",
      "LICENSE_EXPIRED",
      "https://yourapp.com/billing"
    );
  }
}

export class QuotaExceededError extends VPAError {
  constructor(quotaType: string) {
    super(
      `User exceeded quota: ${quotaType}`,
      `You've reached your monthly ${quotaType} limit. Upgrade for higher limits.`,
      "QUOTA_EXCEEDED",
      "https://yourapp.com/pricing"
    );
  }
}
```

### Graceful Error Responses to Claude

```typescript
// In MCP tool handler

try {
  const result = await executeVPATool(tool, action, params, userId);
  return {
    content: [{ type: "text", text: JSON.stringify(result) }],
  };
} catch (error) {
  if (error instanceof VPAError) {
    // User-friendly error
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: error.userMessage,
            upgrade_url: error.upgradeUrl,
          }),
        },
      ],
      isError: true,
    };
  }

  // System error - log and return generic message
  logger.error("VPA tool execution failed", { error, tool, userId });
  return {
    content: [
      {
        type: "text",
        text: "An unexpected error occurred. Please try again or contact support.",
      },
    ],
    isError: true,
  };
}
```

---

## TESTING STRATEGY

### Unit Tests (Module-Level)

```typescript
// vpa-core/tests/modules/prospect-finder.test.ts

describe("ProspectFinderModule", () => {
  it("should require module access", async () => {
    const userId = "test-user-without-module";
    await expect(prospectFinder.searchCompanies({}, userId)).rejects.toThrow(
      ModuleNotEnabledError
    );
  });

  it("should track usage on successful search", async () => {
    const userId = "test-user-with-module";
    await prospectFinder.searchCompanies({ industry: "hvac" }, userId);

    const usage = await db.query(
      "SELECT * FROM user_usage WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 1",
      [userId]
    );

    expect(usage.rows[0].module_id).toBe("prospect-finder");
    expect(usage.rows[0].tool_name).toBe("search_companies");
  });
});
```

### Integration Tests (End-to-End)

```typescript
// vpa-core/tests/integration/vpa-flow.test.ts

describe("VPA End-to-End Flow", () => {
  it("should execute multi-module workflow", async () => {
    // 1. Find prospects
    const searchResult = await vpa.execute(
      {
        tool: "vpa_prospects",
        action: "search",
        parameters: { industry: "hvac", location: "Dallas, TX" },
      },
      testUserId
    );

    expect(searchResult.companies).toHaveLength(50);

    // 2. Import to pipeline
    const importResult = await vpa.execute(
      {
        tool: "vpa_pipeline",
        action: "import",
        parameters: { companies: searchResult.companies },
      },
      testUserId
    );

    expect(importResult.imported_count).toBe(50);
  });
});
```

---

## DEPLOYMENT

### Phase 1: Local Development (Weeks 1-6)

```bash
# Developer setup
git clone https://github.com/yourcompany/vpa-core.git
cd vpa-core
npm install
cp .env.example .env
# Edit .env with Neon database credentials
npm run db:setup
npm run dev
```

### Phase 2: NPM Package (Week 7)

```bash
# Publish to NPM
npm run build
npm publish --access public

# Users install globally
npm install -g @yourcompany/vpa-core
vpa-init --license LICENSE_KEY
```

### Phase 3: Auto-Updates (Week 8+)

```bash
# Check for updates on VPA startup
vpa-update --check
vpa-update --install
```

---

## FUTURE: WEB APP PHASE (Months 7-12)

**When:** After 100+ MCP users, if demand for easier onboarding

**Architecture:**

```
Web App Frontend (React/Next.js)
      ↓
Backend API (Express/FastAPI)
      ↓
VPA Core Logic (reused!)
      ↓
Claude API ($10-30/month per user)
```

**Pricing:**

- MCP Version: $99/month (user provides Claude)
- Web App Version: $129/month (we provide Claude API)

**Why Later:**

- Validate product-market fit with MCP first
- MCP users are early adopters (evangelists)
- Web app adds months of development
- Better margins with MCP (no API costs)

---

## SUCCESS METRICS

### Phase 1 (Months 1-3): Validation

- **Goal:** 50 paying MCP users
- **Metric:** $4,950/month MRR
- **Churn:** <10% monthly
- **NPS:** >50

### Phase 2 (Months 4-6): Growth

- **Goal:** 200 paying users
- **Metric:** $19,800/month MRR
- **Churn:** <5% monthly
- **Module Adoption:** 70%+ use full bundle

### Phase 3 (Months 7-12): Scale

- **Goal:** 500-1000 users
- **Metric:** $49,500-99,000/month MRR
- **Consider:** Web app if >20% of inquiries ask for it

---

## RISKS & MITIGATIONS

### Risk 1: MCP Setup Too Technical

**Impact:** High signup friction
**Mitigation:**

- Video walkthrough
- One-click installer script
- Live chat support during setup

### Risk 2: Multi-Tenancy Data Isolation

**Impact:** Data leaks between users
**Mitigation:**

- Row-level security in PostgreSQL
- Comprehensive integration tests
- User ID required on every query

### Risk 3: Stripe Webhook Failures

**Impact:** Users pay but don't get access
**Mitigation:**

- Webhook retry logic
- Manual reconciliation dashboard
- Email alerts on failed webhooks

### Risk 4: Module Access Check Performance

**Impact:** Slow VPA responses
**Mitigation:**

- Cache user subscriptions in memory (5 min TTL)
- Database indexes on user_id
- Monitor query performance

---

## TIMELINE

### Week 1-2: VPA Core Foundation

- Database schema + migrations
- VPA MCP server setup
- License validation
- Module registry

### Week 2-3: ProspectFinder Integration

- Add userId to tools
- Module wrapper
- Access control
- Usage tracking

### Week 3-4: LeadTracker Integration

- Same pattern as ProspectFinder

### Week 4-5: EmailOrchestrator Integration

- Same pattern

### Week 5-6: Multi-Tenancy & Billing

- Stripe webhook integration
- User management
- Admin scripts
- Testing

### Week 6-7: Polish & Launch

- Documentation
- Video tutorials
- Website updates
- First 10 beta customers

---

## NEXT STEPS

1. **Review this spec** - Confirm architecture decisions
2. **Launch Task agent** - Start building VPA Core
3. **Database migrations** - Set up multi-tenant schema
4. **Module wrappers** - Integrate existing MCPs

**Ready to build?**
