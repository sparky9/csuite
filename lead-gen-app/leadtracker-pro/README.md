# LeadTracker Pro MCP

**World's First Fully MCP-Native CRM for B2B Prospecting**

LeadTracker Pro is a Model Context Protocol (MCP) server that provides conversational CRM capabilities through Claude Desktop. Manage your B2B sales pipeline entirely through natural language - no UI required.

## Features

- **13 MCP Tools** - All CRM functions accessible via conversational commands
- **Pipeline Management** - Track prospects from first contact to closed deals
- **Batch Operations** - Bulk update status, tags, or delete multiple prospects at once
- **High-Performance Import** - Optimized batch inserts for importing 1000+ prospects in seconds
- **Activity Logging** - Record calls, emails, meetings with configurable retention
- **Follow-up Reminders** - Never miss a callback or meeting
- **Multi-Contact Support** - Track multiple decision makers per company
- **ProspectFinder Integration** - Seamlessly import prospects from ProspectFinder MCP
- **Pipeline Analytics** - Conversion rates, revenue metrics, win rates
- **Tunable Scoring** - Configure next-action scoring weights without code changes
- **Next-Action Intelligence** - Prioritized follow-ups with context-aware recommendations
- **Win/Loss Coaching** - Spot top win sources and where deals slip by stage
- **Multi-User Ready** - Database schema supports multi-user deployments
- **Optimized Queries** - Composite indexes for fast filtering and sorting
- **Client Health Monitoring** - Score accounts, flag risks, and recommend proactive actions
- **Upsell Intelligence** - Surface expansion opportunities and auto-generate tailored pitches
- **Zero Cost** - Uses Neon PostgreSQL free tier

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (Neon free tier recommended)
- Claude Desktop with MCP support
- **Same database as ProspectFinder MCP** (shares Neon instance)

## Installation

### 1. Install Dependencies

```bash
cd leadtracker-pro
npm install
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env and set your DATABASE_URL
# IMPORTANT: Use the SAME database URL as ProspectFinder
```

### 3. Set Up Database

```bash
npm run db:setup
```

This will create:

- Tables: `prospects`, `contacts`, `activities`, `follow_ups`, `upsell_opportunities`, `leadtracker_config`
- Views: `pipeline_summary`, `overdue_follow_ups`, `activity_summary`, `top_prospects`
- Indexes for performance
- Triggers for automation

### 4. Build TypeScript

```bash
npm run build
```

### 5. Configure Claude Desktop

Add to your `claude_desktop_config.json`:

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "leadtracker-pro": {
      "command": "node",
      "args": ["D:\\projects\\Lead gen app\\leadtracker-pro\\dist\\index.js"],
      "env": {
        "DATABASE_URL": "your-neon-database-url-here"
      }
    }
  }
}
```

### 6. Restart Claude Desktop

Close and reopen Claude Desktop to load LeadTracker Pro MCP.

## Available Tools

### 1. `add_prospect`

Create a new prospect in the CRM.

**Example:**

```
Add a new prospect:
- Company: Dallas HVAC Solutions
- Phone: (214) 555-1234
- Email: info@dallashvac.com
- City: Dallas
- State: TX
- Tags: HVAC, High Priority
- Deal Value: $15,000
- Notes: Found via Yellow Pages, highly rated
```

### 2. `add_contact`

Add a contact person to a prospect.

**Example:**

```
Add contact to prospect [prospect-id]:
- Name: John Smith
- Title: Owner
- Phone: (214) 555-5678
- Email: john@dallashvac.com
- Primary contact: yes
```

### 3. `update_prospect_status`

Update pipeline status with automatic activity logging.

**Valid Statuses:**

- `new` - Just added
- `contacted` - Initial contact made
- `qualified` - Meets criteria
- `meeting_scheduled` - Appointment set
- `proposal_sent` - Quote/proposal delivered
- `negotiating` - In discussions
- `closed_won` - Deal won!
- `closed_lost` - Deal lost
- `on_hold` - Paused

**Example:**

```
Update prospect [prospect-id] to status "contacted"
Notes: Left voicemail, will follow up tomorrow
```

### 4. `log_activity`

Record calls, emails, meetings, and notes.

**Activity Types:**

- `call` - Phone call
- `email` - Email sent/received
- `meeting` - In-person or virtual meeting
- `note` - General note

**Call Outcomes:**

- `answered` - Got through
- `voicemail` - Left message
- `no_answer` - No one picked up
- `wrong_number` - Invalid number

**Example:**

```
Log a call activity for prospect [prospect-id]:
- Type: call
- Outcome: answered
- Duration: 180 seconds
- Notes: Discussed their HVAC needs. Interested in our 5-year warranty. Need to send proposal.
- Follow-up date: 2024-10-22T10:00:00Z
- Retention: 12 months
```

### 5. `search_prospects`

Search and filter prospects.

**Example:**

```
Search for prospects:
- Status: contacted
- City: Dallas
- Tags: HVAC
- Limit: 20
```

Or simple queries:

```
Show me all qualified prospects in Texas
```

```
Find prospects with follow-ups scheduled
```

### 6. `get_follow_ups`

View pending follow-up reminders.

**Time Ranges:**

- `today` - Due today
- `this_week` - Due this week
- `next_week` - Due next week
- `overdue` - Past due
- `all` - All pending

**Example:**

```
Show me overdue follow-ups
```

```
What follow-ups do I have today?
```

### 7. `get_pipeline_stats`

View pipeline metrics and analytics.

**Group By:**

- `status` - Pipeline stage breakdown
- `source` - Lead source analysis
- `city` - Geographic breakdown
- `tags` - Tag-based segmentation

**Example:**

```
Get pipeline stats grouped by status for this month
```

```
Show me revenue breakdown by source
```

### 8. `import_prospects`

Import prospects from ProspectFinder JSON exports.

**Example:**

```
Import prospects from file: D:\exports\dallas-hvac.json
- Default status: new
- Tags: HVAC, Dallas, Q4-2024
- Source: Yellow Pages - Dallas HVAC - Oct 2024
```

### 9. `get_next_actions`

Surface the highest-impact follow-ups with contextual scoring across deal value, overdue reminders, stage, and recent activity.

**Example:**

```
Get my next best actions:
- Limit: 5
```

**Response includes:**

- Ranked list of prospects with urgency labels (urgent/high/normal)
- Key reasons (overdue follow-up, high deal value, stale outreach)
- Suggested action to take right now and next follow-up timing

### 10. `get_win_loss_report`

Analyze closed-won and closed-lost deals for coaching insights.

**Example:**

```
Give me a win/loss report:
- Timeframe: quarter
```

**Response includes:**

- Win/loss counts and win rate
- Revenue won vs. lost with average deal sizes
- Sources delivering the most wins (and losses)
- Stages where deals are slipping
- Highlight reel of top wins and losses with time-to-close

### 11. `batch_update_status`

Bulk update the status of multiple prospects at once. Automatically logs activity for each update.

**Example:**

```
Batch update these prospects to "contacted":
- Prospect IDs: [uuid1, uuid2, uuid3, ...]
```

**Benefits:**

- Updates hundreds of prospects in a single operation
- Automatic activity logging for audit trail
- Much faster than individual updates

### 12. `batch_manage_tags`

Bulk add or remove tags from multiple prospects.

**Example:**

```
Add tags "Hot Lead" and "Q1-2025" to these prospects:
- Prospect IDs: [uuid1, uuid2, uuid3, ...]
```

```
Remove tag "Cold" from these prospects:
- Prospect IDs: [uuid1, uuid2, uuid3, ...]
```

**Benefits:**

- Organize prospects in bulk
- Supports both add and remove operations
- Prevents duplicate tags automatically

### 13. `batch_delete_prospects`

Bulk delete multiple prospects and all associated data. Requires confirmation.

**Example:**

```
Delete these prospects (confirm: true):
- Prospect IDs: [uuid1, uuid2, uuid3, ...]
```

**Warning:** This operation:

- Permanently deletes prospects, contacts, activities, and follow-ups
- Cannot be undone
- Requires explicit confirmation

### 14. `analyze_client_health`

Score a client across engagement, payments, responsiveness, and sentiment. Returns the health score, level, risk factors, and recommended next actions.

**Example:**

```
Analyze client health:
- userId: user-123
- prospectId: 6f2f4b61-ce4f-4818-94e7-9b35c790b9f1
```

### 15. `detect_upsell_opportunities`

Review recent activities to spot upsell or cross-sell ideas, complete with confidence scores, reasoning, and estimated values. Automatically records opportunities in the CRM.

**Example:**

```
Detect upsell opportunities:
- userId: user-123
- minConfidence: 0.75
```

### 16. `generate_upsell_pitch`

Create a ready-to-send upsell email pitch with talking points and next steps, tailored to the selected tone.

**Example:**

```
Generate upsell pitch:
- prospectId: 6f2f4b61-ce4f-4818-94e7-9b35c790b9f1
- upsellService: Content Writing Package
- tone: executive
```

## Performance Improvements

### Optimized Import

The `import_prospects` tool now uses batch inserts instead of one-by-one operations:

- **Before:** ~30 seconds for 1000 prospects
- **After:** ~5 seconds for 1000 prospects
- **6x faster** with single transaction and PostgreSQL array syntax

### Database Indexes

Composite indexes added for common query patterns:

- `idx_prospects_user_status` - Fast filtering by user and status
- `idx_activities_user_prospect` - Quick prospect activity history
- Plus individual indexes on user_id columns for all tables

### Tunable Scoring

Next-action scoring is now configurable via database settings:

- Stage weights for each pipeline status
- Deal value thresholds and weights
- Priority classification thresholds
- No code changes required - update via database

## Configuration Management

The system now includes a configuration manager for tunable settings stored in the `leadtracker_config` table:

**Available Configurations:**

- `activity_retention_months` - Default retention period for activities
- `scoring_stage_weights` - Pipeline stage weights for next-action scoring
- `scoring_deal_thresholds` - Deal value thresholds and weights
- `scoring_priority_thresholds` - Score thresholds for priority labels

**Modify Configurations:**
Update values directly in the database to tune scoring behavior without deploying code changes.

## Common Workflows

### Morning Routine

```
Show me overdue follow-ups
```

```
What follow-ups do I have today?
```

```
Get pipeline stats for this week
```

### After Calling Session

```
Log a call for prospect [id]:
- Outcome: voicemail
- Notes: Left callback request
- Follow-up: tomorrow at 2pm
```

### Bulk Import from ProspectFinder

```
Import prospects from D:\exports\hvac-dallas-oct2024.json
- Status: new
- Tags: HVAC, Dallas, High-Value
- Source: Yellow Pages - Dallas HVAC - October 2024
```

### Pipeline Review

```
Search prospects by status "qualified"
```

```
Get pipeline stats grouped by status for this quarter
```

```
Show top prospects by deal value
```

## Data Retention

Activities have configurable retention periods:

- **3 months** - Short-term interactions
- **6 months** - Standard follow-ups
- **12 months** - Default (recommended)
- **24 months** - Important deals
- **60 months** - Long-term relationships

Default retention is set in the database config table and can be overridden per-activity.

Activities past their retention period are automatically flagged for cleanup (manual cleanup required for safety).

## Database Schema

### Tables

**prospects** - Core prospect tracking

- Company information
- Pipeline status
- Deal tracking
- Source attribution
- Tags for organization

**contacts** - Decision makers

- Multiple contacts per prospect
- Primary contact designation
- Full contact details

**activities** - Interaction history

- Calls, emails, meetings, notes
- Call outcomes and duration
- Configurable retention
- Follow-up scheduling

**follow_ups** - Reminders

- Due date tracking
- Completion status
- Linked to activities

**leadtracker_config** - System config

- Retention settings
- Future configuration options

### Views

**pipeline_summary** - Status breakdown with metrics
**overdue_follow_ups** - Past due reminders with details
**activity_summary** - Last 30 days activity metrics
**top_prospects** - Highest value prospects by engagement

## Integration with ProspectFinder

LeadTracker Pro is designed to work seamlessly with ProspectFinder MCP:

1. **Shared Database** - Both use the same Neon PostgreSQL database
2. **Import Tool** - Directly import ProspectFinder JSON exports
3. **Linked Records** - Prospects can reference ProspectFinder company IDs
4. **Contacts Import** - Decision makers automatically become contacts

**Workflow:**

1. Use ProspectFinder to scrape Yellow Pages/Google Maps
2. Export results to JSON
3. Import into LeadTracker Pro
4. Manage through sales pipeline
5. Track activities and follow-ups

## Development

### Run in Development Mode

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

### Database Management

```bash
# Set up database
npm run db:setup

# The schema.sql file contains all table definitions
# Located in: src/db/schema.sql
```

## Troubleshooting

### Tools Not Showing in Claude

1. Check Claude Desktop config path is correct
2. Verify `dist/index.js` exists (run `npm run build`)
3. Restart Claude Desktop completely
4. Check logs in Claude Desktop (Help > Developer Tools)

### Database Connection Issues

1. Verify `DATABASE_URL` in `.env` file
2. Check Neon database is accessible
3. Ensure SSL mode is set: `?sslmode=require`
4. Test connection: `npm run db:setup`

### Import Failures

1. Verify JSON file path is absolute
2. Check JSON format matches ProspectFinder export
3. Ensure database tables exist (`npm run db:setup`)
4. Check logs for specific error messages

## Architecture

**Tech Stack:**

- TypeScript
- Model Context Protocol SDK
- PostgreSQL (Neon)
- Zod for validation
- Winston for logging

**Design Patterns:**

- Singleton database client
- Tool-based architecture
- Transaction safety
- Graceful error handling
- Comprehensive input validation

**MCP Integration:**

- Stdio transport for Claude Desktop
- Structured tool schemas
- Rich text responses
- Error handling with user-friendly messages

## License

ISC

## Author

Mike & Forge (Technical Architect)

Built with elegant architecture and business-focused design. Part of the Lead Generation business ecosystem.

---

**Need Help?**

- Check the CLAUDE.md file for business context
- Review tool schemas in src/index.ts
- Examine database schema in src/db/schema.sql
- See example workflows above

**Ready to track leads like a pro? Let's go!**
