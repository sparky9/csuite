# EmailOrchestrator MCP

**AI-Powered Email Automation for B2B Lead Generation**

EmailOrchestrator is a Model Context Protocol (MCP) server that enables sophisticated email automation through Claude Desktop. It's the final piece of a three-MCP ecosystem for AI-runnable lead generation.

## Features

- **Multi-Touch Campaigns**: Create email sequences with intelligent timing
- **AI Personalization**: Claude-powered email generation for each prospect
- **Email Provider Flexibility**: Send through Gmail API or any SMTP provider
- **Smart Automation**: Auto-pause on reply, timezone-aware scheduling
- **Full Tracking**: Opens, clicks, replies, bounces
- **CAN-SPAM Compliant**: Built-in compliance with unsubscribe handling
- **Seamless Integration**: Works with ProspectFinder and LeadTracker Pro MCPs

## Architecture

```
┌─────────────────────┐
│  ProspectFinder MCP │──┐
│  (Scrape prospects) │  │
└─────────────────────┘  │
                         │    ┌──────────────────────┐
                         ├───▶│   Claude Desktop     │
                         │    └──────────────────────┘
┌─────────────────────┐  │              │
│ LeadTracker Pro MCP │──┤              │
│  (CRM pipeline)     │  │              ▼
└─────────────────────┘  │    ┌──────────────────────┐
                         │    │ EmailOrchestrator    │
┌─────────────────────┐  │    │ - Campaigns          │
│EmailOrchestrator MCP│──┘    │ - AI Personalization │
│  (Email automation) │       │ - Gmail Sending      │
└─────────────────────┘       │ - Tracking           │
                              └──────────────────────┘
            │
            ▼
  ┌──────────────────┐
  │ Neon PostgreSQL  │
  │ (Shared Database)│
  └──────────────────┘

       Include the `SMTP_*` environment variables in this block when `EMAIL_PROVIDER` is set to `smtp`.
```

## Installation

### Prerequisites

- Node.js 18+
- Neon PostgreSQL database (same as ProspectFinder/LeadTracker)
- Google Cloud Console project with Gmail API enabled
- Anthropic API key

### Quick Start

1. **Clone and Install**
   ```bash
   cd "d:\projects\Lead gen app\email-orchestrator"
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   ```

  Edit `.env`:
   ```
   DATABASE_URL=postgresql://user:pass@host.neon.tech/prospect_finder?sslmode=require
   ANTHROPIC_API_KEY=sk-ant-your-key
  EMAIL_PROVIDER=gmail
   GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GMAIL_CLIENT_SECRET=your-secret
   COMPANY_NAME=Your Company Name
   COMPANY_ADDRESS=123 Main St, City, ST 12345
   
  # SMTP settings (only required when EMAIL_PROVIDER=smtp)
  SMTP_HOST=smtp.mailprovider.com
  SMTP_PORT=587
  SMTP_SECURE=false
  SMTP_USERNAME=apikey
  SMTP_PASSWORD=your-password
  SMTP_DAILY_LIMIT=1000
  SMTP_HOURLY_LIMIT=200
   ```

3. **Setup Database**
   ```bash
   npm run db:setup
   ```

4. **Authenticate Gmail**
  ```bash
  npm run gmail:auth
  ```
  Skip this step if you are exclusively using SMTP.

5. **Build and Test**
   ```bash
   npm run build
   npm run dev
   ```

6. **Configure Claude Desktop**

   Edit `claude_desktop_config.json`:
   ```json
   {
     "mcpServers": {
       "email-orchestrator": {
         "command": "node",
         "args": ["d:\\projects\\Lead gen app\\email-orchestrator\\dist\\index.js"],
         "env": {
           "DATABASE_URL": "postgresql://...",
           "ANTHROPIC_API_KEY": "sk-ant-...",
           "EMAIL_PROVIDER": "gmail",
           "GMAIL_CLIENT_ID": "...",
           "GMAIL_CLIENT_SECRET": "..."
         }
       }
     }
   }
   ```

## Email Provider Configuration

Set `EMAIL_PROVIDER` to `gmail` (default) or `smtp` depending on your infrastructure. When `smtp` is selected, provide `SMTP_HOST`, `SMTP_PORT`, optional `SMTP_SECURE`, and authentication credentials via `SMTP_USERNAME` and `SMTP_PASSWORD`. Quota enforcement defaults to 1000 emails/day and 200 emails/hour but can be overridden with `SMTP_DAILY_LIMIT` and `SMTP_HOURLY_LIMIT` environment variables or the `email_config` table. Gmail OAuth remains available for inbox tooling even when SMTP handles outbound sending.

## MCP Tools

### 1. `create_campaign`

Create a new multi-touch email campaign.

**Parameters:**
- `name` (required): Campaign name
- `description`: Campaign description
- `from_email` (required): Sender email
- `from_name`: Sender name
- `target_prospect_ids`: Array of specific prospect IDs
- `target_tags`: Array of tags to filter prospects
- `target_status`: Status to filter prospects (e.g., "qualified")
- `send_days_of_week`: Days to send [1,2,3,4,5] (Mon-Fri)
- `send_hours_start`: Start hour (default: 9)
- `send_hours_end`: End hour (default: 17)
- `send_timezone`: Timezone (default: "America/Chicago")
- `tracking_enabled`: Enable tracking (default: true)

**Example:**
```typescript
{
  name: "Q1 Outbound Campaign",
  description: "Targeting qualified prospects from lead gen",
  from_email: "mike@example.com",
  from_name: "Mike",
  target_tags: ["qualified", "tech"],
  send_days_of_week: [1, 2, 3, 4, 5],
  send_hours_start: 9,
  send_hours_end: 17,
  send_timezone: "America/Chicago"
}
```

### 2. `add_email_sequence`

Add an email to a campaign sequence.

**Parameters:**
- `campaign_id` (required): Campaign ID
- `sequence_order` (required): 1, 2, 3, etc.
- `day_offset` (required): Days after previous email (0 for first)
- `subject_line` (required): Email subject
- `body_template` (required): HTML body with {{variables}}
- `template_id`: Use existing template
- `personalization_instructions`: Instructions for AI

**Example:**
```typescript
{
  campaign_id: "uuid...",
  sequence_order: 1,
  day_offset: 0,
  subject_line: "Quick question about {{company}}",
  body_template: `
    <p>Hi {{first_name}},</p>
    <p>I noticed {{company}} is in the {{industry}} space...</p>
  `,
  personalization_instructions: "Reference their industry and make it conversational"
}
```

### 3. `start_campaign`

Start a draft campaign and enroll prospects.

**Parameters:**
- `campaign_id` (required): Campaign ID

**Example:**
```typescript
{ campaign_id: "uuid..." }
```

### 4. `create_template`

Create a reusable email template.

**Parameters:**
- `name` (required): Template name
- `category` (required): Category (introduction, follow_up, value_proposition)
- `subject_line` (required): Subject line
- `body_template` (required): HTML body
- `personalization_instructions`: Instructions for AI
- `use_ai_enhancement`: Enable AI (default: true)

**Example:**
```typescript
{
  name: "Introduction Email",
  category: "introduction",
  subject_line: "Quick intro - {{company}}",
  body_template: "<p>Hi {{first_name}},</p><p>I help {{industry}} companies...</p>",
  personalization_instructions: "Make it warm and conversational",
  use_ai_enhancement: true
}
```

### 5. `send_email`

Send a one-off email (not part of campaign).

**Parameters:**
- `to_email` (required): Recipient email
- `to_name`: Recipient name
- `from_email` (required): Sender email
- `from_name`: Sender name
- `subject_line` (required): Subject
- `body_html` (required): HTML body
- `prospect_id`: Link to prospect
- `tracking_enabled`: Enable tracking (default: true)

**Example:**
```typescript
{
  to_email: "john@acme.com",
  to_name: "John Doe",
  from_email: "mike@example.com",
  from_name: "Mike",
  subject_line: "Following up on our conversation",
  body_html: "<p>Hi John,</p><p>Great talking yesterday...</p>",
  tracking_enabled: true
}
```

### 6. `get_campaign_stats`

View detailed analytics for a campaign.

**Parameters:**
- `campaign_id` (required): Campaign ID

**Returns:**
- Performance metrics (open rate, click rate, reply rate)
- Email sequences
- Recent activity
- Top engaged prospects

### 7. `pause_resume_campaign`

Pause or resume an active campaign.

**Parameters:**
- `campaign_id` (required): Campaign ID
- `action` (required): "pause" or "resume"
- `reason`: Reason for pausing

**Example:**
```typescript
{
  campaign_id: "uuid...",
  action: "pause",
  reason: "End of quarter, resuming in January"
}
```

### 8. `get_email_history`

View all emails sent to a prospect.

**Parameters:**
- `prospect_id` (required): Prospect ID
- `limit`: Number of emails (default: 50)

**Returns:**
- All emails sent
- Opens and clicks for each
- Campaign context

### 9. `manage_unsubscribes`

Manage global unsubscribe list.

**Parameters:**
- `action` (required): "list", "add", or "check"
- `email`: Email address (for add/check)
- `reason`: Unsubscribe reason (for add)
- `limit`: Number to list (default: 100)

**Example:**
```typescript
// Check if unsubscribed
{ action: "check", email: "john@acme.com" }

// Add to unsubscribe list
{ action: "add", email: "john@acme.com", reason: "User requested" }

// List all unsubscribes
{ action: "list", limit: 100 }
```

## Campaign Workflow Example

```typescript
// 1. Create campaign
const campaign = await create_campaign({
  name: "Q1 SaaS Outreach",
  from_email: "mike@example.com",
  from_name: "Mike",
  target_tags: ["qualified", "saas"],
  send_timezone: "America/Chicago"
});

// 2. Add email sequence
await add_email_sequence({
  campaign_id: campaign.id,
  sequence_order: 1,
  day_offset: 0,
  subject_line: "Quick question about {{company}}",
  body_template: "<p>Hi {{first_name}},</p><p>I help {{industry}} companies...</p>",
  personalization_instructions: "Reference their industry and pain points"
});

await add_email_sequence({
  campaign_id: campaign.id,
  sequence_order: 2,
  day_offset: 3,
  subject_line: "Following up - {{company}}",
  body_template: "<p>Hi {{first_name}},</p><p>Following up on my previous email...</p>"
});

// 3. Start campaign
await start_campaign({ campaign_id: campaign.id });

// 4. Monitor progress
const stats = await get_campaign_stats({ campaign_id: campaign.id });
console.log(`Open rate: ${stats.performance.open_rate}%`);
console.log(`Reply rate: ${stats.performance.reply_rate}%`);

// 5. Pause if needed
await pause_resume_campaign({
  campaign_id: campaign.id,
  action: "pause",
  reason: "Tweaking messaging"
});
```

## Integration with Other MCPs

### ProspectFinder → EmailOrchestrator

```typescript
// 1. Scrape prospects with ProspectFinder
const prospects = await scrape_apollo_io({
  search_query: "CTO at SaaS companies",
  limit: 100
});

// 2. Qualify with LeadTracker
await add_prospects_to_pipeline({
  prospect_ids: prospects.map(p => p.id),
  status: "qualified"
});

// 3. Create email campaign
const campaign = await create_campaign({
  name: "CTO Outreach",
  target_tags: ["qualified"],
  from_email: "mike@example.com"
});

// 4. Add sequences and start
await add_email_sequence({ ... });
await start_campaign({ campaign_id: campaign.id });
```

## Auto-Pause Features

EmailOrchestrator automatically pauses prospects when:

- **Reply detected**: Prospect responds to an email
- **Email bounces**: Hard bounce detected
- **Unsubscribe**: Prospect clicks unsubscribe link
- **Campaign paused**: Manual campaign pause

## Tracking & Analytics

All emails include:

- **Open tracking**: 1x1 pixel tracking
- **Click tracking**: URL wrapping for link clicks
- **Reply detection**: Manual marking via MCP tools
- **Bounce handling**: Automatic bounce detection

## CAN-SPAM Compliance

Every email automatically includes:

- Physical mailing address
- Clear unsubscribe link
- "From" name and email
- Accurate subject lines

Update company info in database:
```sql
UPDATE email_config SET value = 'Your Company' WHERE key = 'company_name';
UPDATE email_config SET value = '123 Main St, City, ST 12345' WHERE key = 'company_address';
```

## Gmail Quota Management

- **Daily limit**: 500 emails (configurable)
- **Hourly limit**: 50 emails (configurable)
- Automatic quota checking before sends
- Rate limiting with intelligent delays

## Database Schema

Key tables:
- `campaigns`: Campaign configuration
- `email_sequences`: Multi-touch sequences
- `email_templates`: Reusable templates
- `sent_emails`: All sent emails
- `email_tracking`: Opens, clicks, events
- `campaign_prospects`: Enrollment tracking
- `unsubscribes`: Global unsubscribe list
- `email_config`: System configuration

## Troubleshooting

### Gmail not sending

```bash
# Re-authenticate
npm run gmail:auth

# Check quota
# Query: SELECT * FROM email_config WHERE key LIKE 'gmail%';
```

### AI personalization failing

Check `ANTHROPIC_API_KEY` in `.env`

### Database connection issues

Verify `DATABASE_URL` points to same Neon database as ProspectFinder

## License

Proprietary - Part of the Lead Generation Ecosystem

## Support

For issues or questions, contact the development team.
