# EmailOrchestrator Setup Guide

**5-Minute Quick Start**

## Prerequisites

- ✅ Node.js 18+ installed
- ✅ Neon PostgreSQL database (same as ProspectFinder/LeadTracker)
- ✅ Gmail account for sending emails
- ✅ Google Cloud Console access
- ✅ Anthropic API key

## Step 1: Clone and Install (1 min)

```bash
cd "d:\projects\Lead gen app\email-orchestrator"
npm install
```

## Step 2: Environment Configuration (2 min)

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Database (SAME as ProspectFinder and LeadTracker)
DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/prospect_finder?sslmode=require

# Anthropic API for AI personalization
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Gmail OAuth (get from Google Cloud Console)
GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REDIRECT_URI=http://localhost:3000/oauth/callback

# Logging
LOG_LEVEL=info

# Company info (CAN-SPAM compliance)
COMPANY_NAME=Your Company Name
COMPANY_ADDRESS=123 Main St, City, ST 12345
COMPANY_PHONE=+1-555-555-5555
```

## Step 3: Database Setup (1 min)

Run the database setup script:

```bash
npm run db:setup
```

You should see:

```
EmailOrchestrator Database Setup
================================

Connecting to database...
✓ Connected

Reading schema from: ...
✓ Schema file loaded

Creating database objects...
✓ Schema executed successfully

Tables created:
  ✓ campaigns
  ✓ email_templates
  ✓ email_sequences
  ✓ sent_emails
  ✓ email_tracking
  ✓ campaign_prospects
  ✓ unsubscribes
  ✓ email_config

Views created:
  ✓ campaign_performance
  ✓ pending_sends
  ✓ email_activity_timeline
  ✓ template_performance

Database setup completed successfully!
```

## Step 4: Gmail OAuth Setup (2 min)

See `GMAIL_OAUTH_GUIDE.md` for detailed instructions.

**Quick version:**

1. Go to Google Cloud Console
2. Enable Gmail API
3. Create OAuth 2.0 credentials
4. Copy Client ID and Client Secret to `.env`
5. Run authentication:

```bash
npm run gmail:auth
```

Follow the prompts:
- Open the URL in your browser
- Authorize Gmail access
- Paste the authorization code
- Tokens are saved automatically

You should see:

```
✓ Tokens received
✓ Tokens saved to database
✓ Gmail API access verified
  Email: your-email@gmail.com

Gmail OAuth setup completed!
```

## Step 5: Build and Test (1 min)

Build the project:

```bash
npm run build
```

Test the MCP server:

```bash
npm run dev
```

You should see:

```
Database connected successfully
Gmail client authenticated
EmailOrchestrator MCP server started
```

## Step 6: Configure Claude Desktop (2 min)

Edit your Claude Desktop config file:

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`

Add EmailOrchestrator to the `mcpServers` section:

```json
{
  "mcpServers": {
    "prospect-finder": {
      "command": "node",
      "args": ["d:\\projects\\Lead gen app\\prospect-finder\\dist\\index.js"],
      "env": {
        "DATABASE_URL": "postgresql://..."
      }
    },
    "leadtracker-pro": {
      "command": "node",
      "args": ["d:\\projects\\Lead gen app\\leadtracker-pro\\dist\\index.js"],
      "env": {
        "DATABASE_URL": "postgresql://..."
      }
    },
    "email-orchestrator": {
      "command": "node",
      "args": ["d:\\projects\\Lead gen app\\email-orchestrator\\dist\\index.js"],
      "env": {
        "DATABASE_URL": "postgresql://user:pass@host.neon.tech/prospect_finder?sslmode=require",
        "ANTHROPIC_API_KEY": "sk-ant-your-key",
        "GMAIL_CLIENT_ID": "your-client-id.apps.googleusercontent.com",
        "GMAIL_CLIENT_SECRET": "your-secret",
        "COMPANY_NAME": "Your Company Name",
        "COMPANY_ADDRESS": "123 Main St, City, ST 12345"
      }
    }
  }
}
```

**Restart Claude Desktop**

## Step 7: Verify Integration

Open Claude Desktop and ask:

```
What MCP servers are available?
```

You should see `email-orchestrator` in the list.

Test a tool:

```
Use the email-orchestrator to create a test campaign called "Test Campaign"
from mike@example.com
```

## Verification Checklist

- ✅ Database tables created
- ✅ Gmail OAuth authenticated
- ✅ MCP server starts without errors
- ✅ Claude Desktop sees email-orchestrator tools
- ✅ Can create campaigns
- ✅ Can send test emails

## Common Issues

### Issue: "DATABASE_URL not set"

**Solution:** Check `.env` file exists and has correct `DATABASE_URL`

### Issue: "Gmail not authenticated"

**Solution:** Run `npm run gmail:auth` again

### Issue: "Claude Desktop doesn't see MCP server"

**Solution:**
1. Check config file path is correct
2. Verify JSON is valid (no trailing commas)
3. Restart Claude Desktop
4. Check MCP server logs for errors

### Issue: "AI personalization failing"

**Solution:** Verify `ANTHROPIC_API_KEY` in `.env` is correct

### Issue: "Emails not sending"

**Solution:**
1. Check Gmail quota: Query database for email_config
2. Re-run `npm run gmail:auth`
3. Verify `from_email` matches authenticated Gmail account

## Next Steps

1. **Update Company Info**
   ```sql
   UPDATE email_config SET value = 'Your Company Name' WHERE key = 'company_name';
   UPDATE email_config SET value = '123 Main St, City, ST 12345' WHERE key = 'company_address';
   ```

2. **Create Your First Campaign**
   - Use ProspectFinder to scrape prospects
   - Use LeadTracker to qualify them
   - Use EmailOrchestrator to create campaign
   - Add email sequences
   - Start the campaign!

3. **Monitor Performance**
   - Use `get_campaign_stats` to track metrics
   - Check open rates, click rates, replies
   - Adjust messaging based on results

## Support

For issues or questions, consult:
- `README.md` - Full documentation
- `GMAIL_OAUTH_GUIDE.md` - Gmail setup details
- Database schema: `src/db/schema.sql`

Happy automating!
