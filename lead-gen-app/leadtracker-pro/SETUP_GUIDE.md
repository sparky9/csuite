# LeadTracker Pro - Quick Setup Guide

## For Mike: Get Started in 5 Minutes

### Step 1: Copy Environment File

```bash
cd d:\projects\Lead gen app\leadtracker-pro
copy .env.example .env
```

Edit `.env` and paste your Neon database URL (same as ProspectFinder):

```
DATABASE_URL=postgresql://your-actual-neon-url-here
```

### Step 2: Set Up Database

```bash
npm run db:setup
```

You should see:
- ✅ Connected successfully
- ✅ Database objects created
- ✅ Tables verified (prospects, contacts, activities, follow_ups, leadtracker_config)
- ✅ Views created
- ✅ Configuration loaded

### Step 3: Configure Claude Desktop

1. Open your Claude Desktop config file:
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Location: `C:\Users\YourUsername\AppData\Roaming\Claude\claude_desktop_config.json`

2. Add LeadTracker Pro server (alongside ProspectFinder):

```json
{
  "mcpServers": {
    "prospect-finder": {
      "command": "node",
      "args": ["D:\\projects\\Lead gen app\\dist\\index.js"],
      "env": {
        "DATABASE_URL": "your-neon-url-here"
      }
    },
    "leadtracker-pro": {
      "command": "node",
      "args": ["D:\\projects\\Lead gen app\\leadtracker-pro\\dist\\index.js"],
      "env": {
        "DATABASE_URL": "your-neon-url-here"
      }
    }
  }
}
```

3. **Important:** Use the SAME database URL for both servers!

### Step 4: Restart Claude Desktop

1. Completely quit Claude Desktop
2. Reopen it
3. Start a new conversation

### Step 5: Test It Works

In Claude Desktop, try:

```
Show me my pipeline stats
```

or

```
Add a test prospect:
- Company: Test HVAC Company
- City: Dallas
- State: TX
- Tags: Test
```

You should get a formatted response showing the prospect was created!

## Common Issues

### "Tool not found"

- Check the path in claude_desktop_config.json
- Make sure you ran `npm run build` (creates dist/ folder)
- Restart Claude Desktop completely

### "Database connection failed"

- Check DATABASE_URL is correct in .env
- Verify you can connect to Neon dashboard
- Make sure URL includes `?sslmode=require`

### "Table does not exist"

- Run `npm run db:setup` again
- Check you're using the same database as ProspectFinder

## What You Built

You now have a fully functional CRM accessible through conversation:

**8 MCP Tools:**
1. add_prospect - Create new leads
2. add_contact - Add decision makers
3. update_prospect_status - Move through pipeline
4. log_activity - Track calls, emails, meetings
5. search_prospects - Find and filter leads
6. get_follow_ups - View reminders
7. get_pipeline_stats - See analytics
8. import_prospects - Import from ProspectFinder

**Complete Features:**
- Pipeline tracking (new → closed_won/lost)
- Activity logging with call outcomes
- Follow-up reminders
- Multi-contact support
- Tags and organization
- Revenue tracking
- Configurable data retention (3-60 months)
- Seamless ProspectFinder integration

## Example Workflows

### Morning Check-In
```
What follow-ups do I have today?
Show me overdue follow-ups
Get pipeline stats for this week
```

### After a Call
```
Log a call for prospect [id]:
- Outcome: answered
- Duration: 300 seconds
- Notes: Discussed pricing. Sending proposal tomorrow.
- Follow-up: 2024-10-23T14:00:00Z
```

### Import Yellow Pages Scrape
```
Import prospects from: D:\exports\hvac-dallas-oct2024.json
- Status: new
- Tags: HVAC, Dallas, Q4-2024
- Source: Yellow Pages - Dallas HVAC - October 2024
```

## Architecture Highlights

**Tech Stack:**
- TypeScript with strict typing
- Zod validation on all inputs
- PostgreSQL with proper indexes
- Transaction safety
- Winston logging
- MCP SDK for Claude integration

**Database Design:**
- 5 tables with foreign keys
- 4 materialized views for analytics
- Automatic triggers for timestamps
- Configurable retention system
- Optimized indexes

**Business Logic:**
- Status change auto-logs activity
- Follow-ups auto-update prospect
- Import handles duplicates
- Validation prevents bad data
- Graceful error messages

## You're Ready!

The system is production-ready. Start using it through Claude Desktop immediately.

Need help? Check README.md for detailed tool documentation.

Built with elegance. Ready to scale.
