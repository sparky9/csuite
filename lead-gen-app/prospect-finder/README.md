# ProspectFinder MCP

**MCP-native B2B prospect finder with web scraping and RAG intelligence**

Get Mike calling blue-collar B2B prospects (HVAC, plumbing, electrical) ASAP.

> **Workspace layout tip:** all commands below assume you are inside the `prospect-finder/` folder (e.g., `cd prospect-finder`).

---

## What This Does

ProspectFinder is a Model Context Protocol (MCP) server that integrates with Claude Desktop to give you AI-powered lead generation capabilities:

- **Search for companies** by industry, location, and size
- **Find decision makers** with contact information
- **Enrich company data** from LinkedIn and websites
- **Export prospects** to CSV, JSON, or Google Sheets
- **Track scraping progress** and data quality

All through natural conversation with Claude.

---

## Current Status

**Phase: Day 1-3 Foundation (COMPLETE) + Yellow Pages Scraper (WORKING)**

✅ MCP server with 5 tools (search, find, enrich, export, stats)
✅ PostgreSQL database schema with pgvector for RAG
✅ Proxy manager (provider-agnostic, multiple rotation strategies)
✅ Browser pool (Playwright with stealth mode and proxy support)
✅ Rate limiter (per-source, configurable limits)
✅ Database setup scripts
✅ Full documentation
✅ **Yellow Pages scraper (100% phone coverage!)**
✅ **6 standalone tools for immediate lead generation**

**NEW: Start Generating Leads TODAY (No Database Required!)**

Mike can start prospecting RIGHT NOW using standalone tools:

- Yellow Pages scraper (fully working)
- CSV export for Excel/Google Sheets
- Bulk scraper (multiple industries × cities)
- Deduplication tool
- Prioritized call list generator
- Quick search presets

**See STANDALONE_TOOLS.md and QUICK_START_CHEATSHEET.md for immediate lead generation!**

---

## Two Ways to Use This Tool

### Option 1: Standalone Mode (START HERE - No Database!)

**Get calling leads in 5 minutes without any setup!**

```bash
# 1. Install dependencies
npm install

# 2. Run a quick search
npm run quick-search hvac-texas

# 3. Export to CSV
npm run export:csv test-results/yellow-pages-hvac-[TIMESTAMP].json

# 4. Open CSV in Excel and start calling!
```

**Full standalone documentation:** See `STANDALONE_TOOLS.md` and `QUICK_START_CHEATSHEET.md`

**Available standalone tools:**

- `npm run test:yellow-pages` - Single search
- `npm run bulk:scrape` - Bulk scraper (5 industries × 5 cities)
- `npm run quick-search` - Preset searches (hvac-texas, plumbing-fl, etc.)
- `npm run export:csv` - Convert JSON to Excel CSV
- `npm run dedupe` - Remove duplicates
- `npm run call-list` - Generate prioritized calling list
- `npm run stats` - View data quality statistics

### Option 2: Full MCP Mode (Later - Requires Database)

Complete integration with Claude Desktop for advanced features like RAG deduplication, decision maker finding, and company enrichment.

---

## Quick Start (Standalone Mode)

No prerequisites needed! Just:

```bash
npm install
npm run quick-search hvac-texas
npm run export:csv test-results/[latest-file].json
```

**Done!** Open the CSV and start calling.

---

## Unified Ecosystem Setup (Recommended)

If you're setting up multiple modules (ProspectFinder, LeadTracker Pro, EmailOrchestrator, VPA Core), use our unified setup script for a streamlined experience:

```bash
# One command sets up everything
npm run setup:all
```

This automated setup will:

- Install dependencies for all modules
- Configure database connections
- Set up API keys
- Copy configuration files
- Build TypeScript projects
- Provide next steps guidance

**Supports future modules** - content-writer, social-media, analytics, etc. can be easily added to the setup script.

## Full Setup (MCP Mode)

### Prerequisites

- Node.js 18+ and npm
- [Claude Desktop](https://claude.ai/download) installed
- Neon PostgreSQL account (free tier: https://neon.tech)

### 1. Install Dependencies

```bash
npm install
```

### 2. Get Neon Database Credentials

1. Sign up at https://neon.tech (free tier works great)
2. Create a new project
3. Copy your connection string (looks like: `postgresql://user:pass@host.neon.tech/dbname`)

### 3. Configure Environment

Create a `.env` file in the project root:

```bash
# Copy the example file
cp .env.example .env
```

Edit `.env` and add your Neon credentials:

```env
DATABASE_URL=postgresql://user:password@host.neon.tech/prospect_finder?sslmode=require
ANTHROPIC_API_KEY=sk-ant-your-key-here
LOG_LEVEL=info
HEADLESS=true
MAX_CONCURRENT_BROWSERS=2
```

### 4. Initialize Database

```bash
npm run db:setup
```

This creates all tables, indexes, functions, and views. You should see:

```
✓ Database connection successful
✓ Schema executed successfully
✓ Found 4 tables
✓ Extensions installed: uuid-ossp, vector
```

### 5. Configure Claude Desktop MCP

Claude Desktop needs to know about your MCP server. Edit the config file:

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Linux:** `~/.config/Claude/claude_desktop_config.json`

Add this configuration (adjust path to your project):

```json
{
  "mcpServers": {
    "prospect-finder": {
      "command": "node",
      "args": ["D:\\projects\\Lead gen app\\prospect-finder\\dist\\index.js"],
      "env": {
        "DATABASE_URL": "your-neon-connection-string",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**Important:**

- Use absolute paths (not relative)
- On Windows, use double backslashes `\\` or forward slashes `/`
- Build the project first: `npm run build`

### 6. Build and Test

```bash
# Build TypeScript
npm run build

# Test MCP server (should start without errors)
npm run dev
```

If it starts successfully, you'll see:

```
2025-01-15 10:30:00 [info]: ProspectFinder MCP Server running on stdio
2025-01-15 10:30:00 [info]: Waiting for requests from Claude Desktop...
```

Press Ctrl+C to stop.

### 7. Restart Claude Desktop

**Important:** Claude Desktop only loads MCP servers on startup.

1. Completely quit Claude Desktop (not just close the window)
2. Restart Claude Desktop
3. Open a new conversation

### 8. Test with Claude

In Claude Desktop, try these commands:

```
Find HVAC companies in Dallas, TX
```

```
Show me plumbing companies in Miami with good ratings
```

```
Get scraping statistics
```

You should see mock data responses. Real data will appear once you run scrapers (Days 4-6).

---

## Available Tools

ProspectFinder exposes 9 MCP tools to Claude:

### 1. search_companies

Find B2B companies by industry and location.

**Example prompts:**

- "Find HVAC companies in Dallas"
- "Search for electrical contractors in Florida"
- "Show me roofing companies near Austin with 4+ star ratings"

**Parameters:**

- `location` (required): City, state, or "City, State"
- `industry` (optional): Business type (HVAC, plumbing, electrical, etc.)
- `radius_miles` (optional): Search radius (default: 25)
- `min_rating` (optional): Minimum Google rating (default: 3.5)
- `max_results` (optional): Max companies to return (default: 20, max: 100)

### 2. find_decision_makers

Find key contacts at a specific company.

**Example prompts:**

- "Find decision makers at [company name]"
- "Who are the owners and managers at [company ID]?"
- "Get contact info for executives at this company"

**Parameters:**

- `company_id` (required): Company ID from search results
- `job_titles` (optional): Target titles (default: Owner, CEO, President, Manager)
- `max_results` (optional): Max people to find (default: 5)

### 3. enrich_company

Add missing data to a company record.

**Example prompts:**

- "Enrich company data for [company ID]"
- "Get employee count and revenue for this company"
- "Update LinkedIn information for [company name]"

**Parameters:**

- `company_id` (required): Company ID to enrich
- `sources` (optional): Data sources (linkedin, website)
- `fields` (optional): Specific fields (employee_count, revenue, industry)

### 4. export_prospects

Export prospect data for outreach.

**Example prompts:**

- "Export all HVAC companies to CSV"
- "Give me a JSON export of high-quality prospects"
- "Export Texas companies with decision makers"

**Parameters:**

- `format` (required): Export format (csv, json, google_sheets)
- `company_ids` (optional): Specific companies to export
- `filters` (optional): Filter by quality, industry, location, etc.
- `include_decision_makers` (optional): Include contact info (default: true)

### 5. get_scraping_stats

View system statistics and data quality.

**Example prompts:**

- "Show scraping statistics"
- "How many companies are in the database?"
- "What's the data quality like?"

**Parameters:**

- `time_range` (optional): today, week, month, all (default: all)

### 6. support_rag_query

Search the local support knowledge base (RAG store) to retrieve relevant documentation snippets.

**Example prompts:**

- "Search knowledge base for 'billing issues'"
- "Find documentation about refund policy"

**Parameters:**

- `question` (required): Ticket summary or question to search
- `top_k` (optional): Maximum number of chunks to return
- `min_score` (optional): Minimum similarity score
- `source_filter` (optional): Restrict results to specific sources

### 7. support_agent

Autonomous frontline support agent that drafts responses using the local knowledge base.

**Example prompts:**

- "Handle support ticket about account setup"
- "Draft response for billing question"

**Parameters:**

- `ticket_id` (required): Unique ticket identifier
- `subject` (required): Ticket subject
- `body` (required): Full customer message body
- `customer_name` (optional): Customer name if available
- `channel` (optional): Channel (email, chat, phone, webform)
- `priority` (optional): Ticket priority (low, medium, high, urgent)

### 8. find_partnership_opportunities

Search for complementary businesses that would make good partnership targets.

**Example prompts:**

- "Find partnership opportunities for my web design business in Dallas"
- "Search for complementary businesses to HVAC services"
- "Show me potential partners for my accounting firm in California"

**Parameters:**

- `userId` (required): User ID for multi-tenant tracking
- `yourIndustry` (required): Your own industry/business type (e.g., "web design", "hvac")
- `location` (optional): Geographic location filter
- `maxResults` (optional): Max opportunities to return (default: 20, max: 100)

**Returns:**

- Company name, industry, and synergy explanation
- Contact information (email, phone, website)
- Location and rating data

### 9. generate_partnership_pitch

Create a professional co-marketing outreach template for partnership proposals.

**Example prompts:**

- "Generate partnership pitch for Cloud Hosting Solutions"
- "Create referral program proposal for SEO company"
- "Draft co-marketing email for event planning business"

**Parameters:**

- `partnerCompany` (required): Name of the potential partner company
- `partnerIndustry` (required): Industry the partner operates in
- `proposedCollaboration` (required): Type of collaboration (e.g., "referral program", "co-branded content")

**Returns:**

- Professional email subject line
- Personalized email body focused on mutual benefits
- List of proposed collaboration terms
- AI-generated content (requires ANTHROPIC_API_KEY)

**Note:** Set `ANTHROPIC_API_KEY` in `.env` for AI-generated pitches. Falls back to mock data if not configured.

---

## Project Structure

```
prospect-finder-mcp/
├── src/
│   ├── index.ts                 # MCP server entry point
│   ├── browser/
│   │   ├── browser-pool.ts      # Playwright instance manager
│   │   └── proxy-manager.ts     # Proxy rotation and health tracking
│   ├── db/
│   │   ├── client.ts            # PostgreSQL client (Neon)
│   │   └── schema.sql           # Database schema
│   ├── scrapers/                # (Day 4-6: Google Maps, LinkedIn, Email)
│   ├── tools/                   # MCP tool implementations
│   │   ├── search-companies.tool.ts
│   │   ├── find-decision-makers.tool.ts
│   │   ├── enrich-company.tool.ts
│   │   ├── export-prospects.tool.ts
│   │   └── get-scraping-stats.tool.ts
│   ├── types/
│   │   ├── prospect.types.ts    # Company, DecisionMaker, etc.
│   │   └── scraper.types.ts     # Browser, Proxy, RateLimit types
│   └── utils/
│       ├── logger.ts            # Winston structured logging
│       └── rate-limiter.ts      # Per-source rate limiting
├── config/
│   ├── scraper-limits.json      # Rate limit configuration
│   └── proxies.json.example     # Proxy configuration template
├── scripts/
│   ├── setup-database.ts        # Initialize database
│   └── database-stats.ts        # View database statistics
├── .env.example                 # Environment variables template
├── package.json
├── tsconfig.json
└── README.md
```

---

## Configuration

### Database (Required)

`.env`:

```env
DATABASE_URL=postgresql://user:pass@host.neon.tech/dbname
```

Get your connection string from Neon dashboard.

### Proxies (Optional for Day 4+)

Copy `config/proxies.json.example` to `config/proxies.json` and add your proxy credentials:

```json
{
  "provider": "webshare",
  "rotation_strategy": "round_robin",
  "proxies": [
    {
      "host": "proxy1.example.com",
      "port": 8080,
      "username": "your-username",
      "password": "your-password",
      "protocol": "http",
      "country": "US",
      "enabled": true
    }
  ]
}
```

**Rotation strategies:**

- `round_robin`: Use proxies in order
- `random`: Pick random proxy each time
- `least_used`: Use least recently used proxy

**Recommended proxy providers:**

- **Budget:** Webshare ($3/GB), Proxy-Cheap ($3/GB)
- **Premium:** Bright Data, Oxylabs (better for LinkedIn)
- **Note:** Residential proxies recommended for production

### Rate Limits (Adjustable)

Edit `config/scraper-limits.json` to adjust rate limits:

```json
{
  "google_maps": {
    "requests_per_minute": 10,
    "requests_per_hour": 200,
    "requests_per_day": 2000,
    "concurrent_browsers": 2
  }
}
```

Start conservative and increase if no issues after 7 days.

---

## Database Schema

### Tables

**companies** - Core prospect data

- Basic info: name, phone, email, website, address
- Business details: industry, category, employee count, revenue
- Source URLs: Google Maps, LinkedIn
- Data quality: quality score, completeness percentage
- RAG: pgvector embedding for deduplication

**decision_makers** - Key contacts at companies

- Personal info: name, title
- Contact info: email, phone, LinkedIn
- Metadata: source, confidence score

**scraping_jobs** - Track scraping operations

- Job details: type, parameters, status
- Progress: percentage, results count
- Performance: duration, proxy used, rate limiting

**duplicate_candidates** - RAG-detected potential duplicates

- Similarity metrics: cosine similarity, name/location match
- Resolution: confirmed duplicate, merged into

### Views

**callable_prospects** - High-quality prospects ready for calling

- Companies with phone number
- Data quality score ≥ 60%
- Includes decision maker count and names

**scraping_stats** - Job performance by source

- Success/failure rates
- Results found
- Average duration

---

## Scripts

### Database Setup

```bash
npm run db:setup
```

Initializes database with schema, extensions, indexes, views, and functions.

### Database Statistics

```bash
npm run db:stats
```

Shows current database statistics:

- Company count and quality distribution
- Decision makers found
- Scraping job performance
- Top industries

### Development

```bash
# Run MCP server (development mode with auto-reload)
npm run dev

# Build TypeScript
npm run build

# Run production server
npm start
```

---

## Troubleshooting

### "MCP server not showing in Claude Desktop"

1. Check Claude Desktop config file location (see section 5 above)
2. Ensure JSON syntax is valid (use a JSON validator)
3. Use absolute paths, not relative paths
4. Build the project first: `npm run build`
5. Completely quit and restart Claude Desktop (not just close window)

### "Database connection failed"

1. Verify DATABASE_URL in `.env` is correct
2. Check Neon dashboard for connection string
3. Ensure `?sslmode=require` is at the end of connection string
4. Test connection: `npm run db:setup`

### "Module not found" errors

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild TypeScript
npm run build
```

### "All proxies disabled"

This means all proxies failed too many times. To reset:

1. Check proxy credentials in `config/proxies.json`
2. Test proxies manually (curl through proxy)
3. Proxies not required until Day 4-6 (scrapers)

### "Rate limit hit"

You're scraping too fast. Options:

1. Wait for cooldown (shown in error message)
2. Reduce rate limits in `config/scraper-limits.json`
3. Add more proxies to distribute load

### Claude Desktop shows error

Check logs:

- **Windows:** `%APPDATA%\Claude\logs\mcp*.log`
- **macOS:** `~/Library/Logs/Claude/mcp*.log`

Common issues:

- Path in config file is wrong
- Node version too old (need 18+)
- Environment variables not set

---

## Next Steps

### Day 4: Google Maps Scraper

- Scrape companies from Google Maps
- Extract: name, phone, website, address, rating, reviews
- Store in database with quality scoring

### Day 5: LinkedIn Scraper

- Find company pages on LinkedIn
- Extract: employee count, industry, revenue estimates
- Find decision makers: owners, managers, executives
- Get contact info from profiles

### Day 6: Email Finder

- Pattern-based email generation
- Website scraping for contact pages
- Email verification (Hunter.io integration)
- Confidence scoring

### Day 7-8: RAG & Deduplication

- Generate embeddings with Anthropic API
- Detect duplicates with cosine similarity
- Auto-merge or suggest merges
- Quality score improvements

### Day 9-10: Production Hardening

- Error recovery and retry logic
- Monitoring and alerting
- Performance optimization
- Google Sheets export

---

## Architecture Notes

### Why MCP?

Model Context Protocol is Anthropic's standard for extending Claude with custom tools. Benefits:

- Natural language interface (no learning curve)
- Claude handles all UX and conversation flow
- Tools are composable (Claude can chain them)
- Secure (runs locally, you control data)

### Why Neon PostgreSQL?

- Serverless: no server management
- pgvector: built-in vector similarity for RAG deduplication
- Free tier: 10GB storage, 100 hours compute
- Fast: global edge network
- Easy: connection string, no config

### Why Playwright?

- Modern browser automation (better than Puppeteer)
- Built-in stealth mode features
- Auto-waits for elements (more reliable)
- Excellent debugging tools
- Cross-browser support

### Rate Limiting Strategy

Token bucket per source:

- Track request times (last 24 hours)
- Check per-minute, per-hour, per-day limits
- Configurable cooldown on limit hit
- Automatic proxy rotation helps distribute load

### Proxy Architecture

Provider-agnostic design:

- Read from JSON config (any provider works)
- Multiple rotation strategies
- Health tracking and auto-disable bad proxies
- Easy to swap providers (just update config)

---

## FAQ

**Q: Do I need proxies right now?**
A: No, proxies are only needed for scrapers (Day 4+). The MCP server works fine without them.

**Q: How much does this cost to run?**
A:

- Neon database: Free tier sufficient for testing
- Claude Desktop: Free (Anthropic account required)
- Proxies: $10-50/month depending on volume (Day 4+)
- Total: ~$0-50/month

**Q: Is this legal?**
A: Web scraping is legal for public data (Google Maps, LinkedIn profiles) as long as you:

- Respect robots.txt
- Don't overload servers (rate limiting)
- Only scrape public information
- Comply with terms of service

**Q: Can I use this for other industries?**
A: Yes! While optimized for blue-collar B2B (HVAC, plumbing, electrical), it works for any industry with Google Maps presence.

**Q: How accurate is the data?**
A: Data quality varies by source:

- Google Maps: Very accurate (phone, address, rating)
- LinkedIn: Accurate but requires good proxies
- Email finder: Pattern-based, needs verification

Quality scores help you prioritize best prospects.

**Q: Can I run this on a server instead of locally?**
A: Yes, but MCP currently requires stdio transport (local process). For server deployment, you'd need to:

1. Run MCP server on remote machine
2. Use SSH tunneling to connect from Claude Desktop
3. Or wait for MCP HTTP transport support (coming soon)

**Q: How do I update rate limits?**
A: Edit `config/scraper-limits.json` and restart the server. Start conservative and increase by 25% if no blocks after 7 days.

**Q: What if I get IP banned?**
A: This is why proxies exist! With rotating residential proxies, bans are rare. If it happens:

1. Wait 24-48 hours
2. Switch to different proxies
3. Reduce rate limits
4. Add delays between requests

---

## Support

- **Issues:** Open a GitHub issue
- **Documentation:** This README + inline code comments
- **Logs:** Check Winston logs in console (set LOG_LEVEL=debug for verbose)

---

## License

ISC

---

## Credits

Built by Mike & Forge

Powered by:

- [Model Context Protocol](https://modelcontextprotocol.io) by Anthropic
- [Neon](https://neon.tech) - Serverless PostgreSQL
- [Playwright](https://playwright.dev) - Browser automation
- [Claude](https://claude.ai) - AI assistant

---

**Ready to find prospects? Start with:**

```
Find HVAC companies in Dallas, TX
```
