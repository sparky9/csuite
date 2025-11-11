# Research & Insights Module

**AI-Powered Competitive Intelligence for Solopreneurs**

## Overview

The Research & Insights module automates competitor monitoring, industry research, and market intelligence gathering. Instead of manually checking competitor websites, industry blogs, and news sources, your VPA does it for you - capturing changes, generating intelligent summaries, and delivering daily digests.

---

## Key Features

### 1. **Intelligent Web Capture**
- Uses Playwright for JavaScript-rendered content (SPAs, dynamic sites)
- Falls back to HTTP fetch for simple pages
- Extracts clean text from HTML automatically

### 2. **LLM-Powered Summaries** (NEW!)
- Claude generates strategic insights, not just "first 3 sentences"
- Highlights key business developments: product launches, pricing changes, partnerships
- Categorizes updates: product_launch, pricing, hiring, funding, etc.
- Assigns urgency levels: high/medium/low
- Analyzes sentiment: positive/neutral/negative

### 3. **Automated Monitoring** (NEW!)
- Set frequency per source: hourly, daily, weekly, or manual
- Background worker checks sources automatically
- No need to remember to "scan competitors" - it just happens
- Smart change detection using content hashing

### 4. **Voice-Optimized Digests**
- Morning briefing format: "2 sources show fresh updates. Competitor X launched new pricing..."
- Natural language summaries perfect for mobile/voice access
- Prioritizes high-urgency updates first

---

## Quick Start

### Add a Competitor to Monitor

```
"Add competitor Acme Corp at acme.com/blog"
```

The VPA will:
- Capture current snapshot
- Set up monitoring (default: daily)
- Generate intelligent summary

### Run Manual Scan

```
"Scan my competitors for updates"
```

### Get Daily Digest

```
"Give me my research digest"
```

---

## Frequency Options

When adding a source, you can specify monitoring frequency:

- **`hourly`** - Every hour (high-volume sources)
- **`every-4-hours`** - Every 4 hours
- **`twice-daily`** - Every 12 hours
- **`daily`** - Once per day (default, recommended)
- **`weekly`** - Once per week (low-priority sources)
- **`manual`** - No automatic scanning (on-demand only)

### Example:

```
"Add competitor StartupX at startupx.com with daily monitoring"
```

---

## Available Actions

### `add_source`
Track a new competitor, blog, or news source.

**Parameters:**
- `label` (required): Friendly name (e.g., "Competitor X", "TechCrunch AI")
- `url` (required): Full URL or domain (protocol optional)
- `category` (optional): competitor | industry | trend | custom
- `frequency` (optional): See frequency options above
- `notes` (optional): Your internal notes about this source

**Example:**
```json
{
  "action": "add_source",
  "parameters": {
    "label": "Acme Corp Blog",
    "url": "https://acme.com/blog",
    "category": "competitor",
    "frequency": "daily",
    "notes": "Primary competitor, watch for pricing changes"
  }
}
```

### `list_sources`
View all monitored sources with their latest snapshots.

**Example:**
```json
{
  "action": "list_sources"
}
```

### `remove_source`
Stop monitoring a source.

**Parameters:**
- `sourceId` (required): ID of the source to remove

### `update_source`
Modify source details (label, URL, frequency, notes).

**Parameters:**
- `sourceId` (required)
- Any fields to update: `label`, `url`, `category`, `frequency`, `notes`

**Example:**
```json
{
  "action": "update_source",
  "parameters": {
    "sourceId": "abc-123",
    "frequency": "twice-daily",
    "notes": "Increased to twice-daily due to product launch"
  }
}
```

### `monitor`
Manually trigger monitoring scan (ignores frequency settings).

**Parameters:**
- `sourceIds` (optional): Array of specific source IDs to scan. If omitted, scans all sources.
- `force` (optional): Boolean. If true, captures even if no changes detected.

**Example:**
```json
{
  "action": "monitor",
  "parameters": {
    "sourceIds": ["abc-123", "def-456"],
    "force": false
  }
}
```

### `digest`
Get summarized recent updates from all sources.

**Parameters:**
- `limit` (optional): Number of entries to include (default: 5)

**Example:**
```json
{
  "action": "digest",
  "parameters": {
    "limit": 10
  }
}
```

### `on_demand`
Quick research on a topic using your saved sources or new URLs.

**Parameters:**
- `topic` (required): What you're researching
- `urls` (optional): Specific URLs to analyze. If omitted, uses all saved sources.

**Example:**
```json
{
  "action": "on_demand",
  "parameters": {
    "topic": "AI model pricing trends",
    "urls": ["https://openai.com/pricing", "https://anthropic.com/pricing"]
  }
}
```

---

## Intelligent Summary Example

**Old (Simple) Summary:**
> "Welcome to our blog! Today we're excited to announce some updates. Stay tuned for more information about our latest developments."

**New (Intelligent) Summary:**
> "Acme Corp launched Premium tier pricing at $299/month with 3 new enterprise features. Key change from previous $199 Professional plan. Targets mid-market companies looking to scale operations without custom enterprise contracts."

**Key Insights:**
- Introduced Premium tier at $299/month (50% price increase over Professional)
- Three enterprise features now available: SSO, audit logs, priority support
- Positioning shift toward mid-market segment
- Removes requirement for custom contracts previously needed for enterprise features

**Sentiment:** Positive (opportunity to differentiate on value)
**Urgency:** High (pricing change affects competitive positioning)
**Category:** pricing, product_launch

---

## Background Monitoring

Once you add sources with frequency settings, the VPA Core background worker automatically monitors them. No manual intervention needed.

### Configuration

Set check interval via environment variable (default: 5 minutes):

```env
RESEARCH_CHECK_INTERVAL_MINUTES=5
```

The worker:
1. Checks every 5 minutes (configurable)
2. Identifies sources due for monitoring based on frequency
3. Captures fresh snapshots
4. Generates intelligent summaries
5. Stores with urgency/sentiment metadata

### Monitoring

Check logs for background activity:

```
[INFO] Background research monitor started (checkIntervalMinutes: 5)
[INFO] Running scheduled research monitoring (sourcesCount: 3)
[INFO] Scheduled monitoring completed for user (sourcesCount: 3)
```

---

## Source Limits

**Maximum sources per user:** 50

This prevents abuse and ensures performance. If you hit the limit, remove unused sources before adding new ones.

---

## Cost Optimization

### LLM Usage

Intelligent summaries use Claude (Haiku by default) with ~1024 tokens per capture:

- **Cost per capture:** ~$0.001-0.002 (depends on content length)
- **Daily cost (10 sources, daily monitoring):** ~$0.01-0.02
- **Monthly cost:** ~$0.30-0.60

### Optimization Tips

1. Use `manual` frequency for low-priority sources
2. Set `weekly` for sources that rarely change
3. Reserve `hourly` for critical, fast-moving sources
4. Digest narrative generation adds ~$0.001 per digest

### Model Configuration

Override default model via environment variable:

```env
ANTHROPIC_MODEL=claude-3-5-haiku-20241022  # Default, fast & cheap
# or
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022  # Higher quality, 20x cost
```

**Recommendation:** Stick with Haiku for research monitoring. Quality is excellent for this use case.

---

## Voice Workflows

### Morning Briefing

```
User: "Give me my research digest"
VPA: "2 sources show fresh updates. Competitor Acme launched Premium pricing at $299/month with enterprise features. Industry blog TechCrunch published analysis of AI model costs declining 40% year-over-year. Say 'Research follow-up' to dive deeper."
```

### Quick Check During Commute

```
User: "Scan my competitors"
VPA: "Scanning 5 sources... Done. Acme Corp has new activity. StartupX unchanged. No updates from the others. Say 'Tell me about Acme' for details."
```

### Ad-Hoc Research

```
User: "Research AI model pricing trends"
VPA: "Analyzing 5 industry sources... OpenAI reduced GPT-4 pricing by 25%. Anthropic held pricing steady. Google announced new free tier. Summary complete."
```

---

## Database Schema

### `research_sources`

| Column | Type | Description |
|--------|------|-------------|
| `source_id` | UUID | Primary key |
| `user_id` | UUID | Owner |
| `label` | VARCHAR(200) | Friendly name |
| `url` | TEXT | Source URL |
| `category` | VARCHAR(50) | competitor / industry / trend / custom |
| `frequency` | VARCHAR(50) | Monitoring cadence |
| `notes` | TEXT | User notes |
| `last_checked` | TIMESTAMP | Last capture time |
| `created_at` | TIMESTAMP | When added |
| `updated_at` | TIMESTAMP | Last modified |

**Indexes:** `user_id`, `url` (unique per user), `category`

### `research_snapshots`

| Column | Type | Description |
|--------|------|-------------|
| `snapshot_id` | UUID | Primary key |
| `source_id` | UUID | Foreign key to sources |
| `captured_at` | TIMESTAMP | Capture time |
| `content_hash` | VARCHAR(64) | SHA256 for change detection |
| `title` | TEXT | Page title |
| `summary` | TEXT | Intelligent LLM summary |
| `highlights` | TEXT[] | Key insights array |
| `metadata` | JSONB | Sentiment, urgency, category, etc. |

**Indexes:** `source_id + captured_at` (DESC), `content_hash`

---

## Troubleshooting

### "Playwright install failed" Warning

During `npm install`, if Playwright fails to install (network issues, permissions), the module falls back to HTTP fetch. Most sites will still work, but JS-heavy SPAs won't capture properly.

**Fix:**
```bash
npx playwright install chromium --with-deps
```

### Captures Return Empty Content

**Causes:**
1. Site blocks scrapers (User-Agent detection)
2. Site requires authentication
3. Content behind JavaScript that Playwright couldn't execute

**Solutions:**
- Try `force: true` to re-capture
- Check site in browser - is content publicly visible?
- Some sites (paywalls, login-required) won't work

### Background Monitor Not Running

Check logs for:
```
Background research monitor started (checkIntervalMinutes: X)
```

If missing:
1. Verify `research-insights` module is in user's subscription
2. Check environment variable `RESEARCH_CHECK_INTERVAL_MINUTES`
3. Restart VPA server

---

## Best Practices

### Source Organization

**Good:**
- "Acme Corp Pricing Page" (specific)
- "Competitor X Blog - Product Updates" (descriptive)
- "TechCrunch AI Section" (clear scope)

**Bad:**
- "Competitor 1" (vague)
- "Website" (no context)
- "Check this" (unclear purpose)

### Frequency Selection

- **Hourly:** Breaking news, active product launch tracking
- **Daily:** Most competitors, industry blogs (default, recommended)
- **Weekly:** Company about pages, pricing pages that rarely change
- **Manual:** One-time research, ad-hoc checks

### Category Usage

- **competitor:** Direct competitors
- **industry:** Industry news, analyst reports
- **trend:** Emerging tech, market trends
- **custom:** Anything else (investor memos, case studies, etc.)

---

## Roadmap

### Coming Soon

- **Email digest delivery** - Get morning briefing via email automatically
- **Slack/Discord webhooks** - Push high-urgency updates to team channels
- **Trend analysis** - "Show me pricing trends over last 30 days"
- **Image change detection** - Track visual changes (logos, screenshots)
- **Source recommendations** - "Competitors like yours also track X"

---

## Support

For issues or questions:

1. Check VPA logs: `logs/vpa-combined.log`
2. Verify module access: `vpa_status { report_type: "modules" }`
3. Test capture manually: `monitor { force: true }`
4. Contact Mike

---

**Built by Forge - Elegant systems for AI-runnable businesses** 🚀
