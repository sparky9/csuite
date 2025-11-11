# EmailOrchestrator Pro - Inbox Management Setup Guide

## Overview

EmailOrchestrator Pro extends the existing campaign-focused EmailOrchestrator with complete Gmail inbox management capabilities, including:

- **Inbox Reading**: Fetch and search emails
- **Email Composition**: Send new emails, reply to threads, forward messages
- **Organization**: Label, archive, mark read/unread, star, delete
- **AI Features**: Thread summarization and reply suggestions powered by Claude

## Architecture

### Existing Features (Unchanged)
All existing campaign tools remain fully functional:
- `create_campaign` - Multi-touch email campaigns
- `create_template` - Email templates
- `send_email` - Campaign email sending
- `get_campaign_stats` - Campaign analytics
- `add_email_sequence` - Campaign sequences
- `start_campaign` - Launch campaigns
- `pause_resume_campaign` - Campaign control
- `get_email_history` - Prospect email history
- `manage_unsubscribes` - Unsubscribe management

### New Features (EmailOrchestrator Pro)

**8 New MCP Tools:**
1. `read_inbox` - Fetch recent emails from Gmail
2. `search_emails` - Advanced email search with filters
3. `get_email_thread` - Retrieve full conversation threads
4. `compose_email` - Send new emails
5. `reply_to_email` - Reply to emails in threads
6. `organize_email` - Label, archive, mark read/unread, delete
7. `summarize_thread` - AI-powered thread summarization
8. `suggest_reply` - AI-generated reply suggestions

## Prerequisites

1. **Existing Setup**
   - PostgreSQL database (Neon)
   - Anthropic API key
   - Existing EmailOrchestrator installation

2. **New Requirements**
   - Google Cloud Project with Gmail API enabled
   - OAuth 2.0 credentials

## Installation Steps

### Step 1: Update Database Schema

Run the updated schema to add new tables:

```bash
tsx scripts/setup-email-orchestrator.ts
```

This adds two new tables:
- `email_oauth_tokens` - Stores Gmail OAuth tokens per user
- `email_cache` - Caches email data for faster access

### Step 2: Set Up Google Cloud Project

1. **Create/Select Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project or select existing one

2. **Enable Gmail API**
   - Navigate to "APIs & Services" > "Library"
   - Search for "Gmail API"
   - Click "Enable"

3. **Create OAuth Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client ID"
   - Application type: "Web application"
   - Name: "EmailOrchestrator Pro"
   - Authorized redirect URIs: `http://localhost:3000/oauth/callback`
   - Click "Create"
   - Copy **Client ID** and **Client Secret**

4. **Configure OAuth Consent Screen**
   - Go to "OAuth consent screen"
   - User type: "External" (for testing) or "Internal" (for organization)
   - App name: "EmailOrchestrator Pro"
   - Add scopes:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/gmail.modify`
     - `https://www.googleapis.com/auth/gmail.compose`
   - Add test users if using "External" type

### Step 3: Configure Environment Variables

Update your `.env` file with Google OAuth credentials:

```bash
# Google OAuth (for EmailOrchestrator Pro)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/callback

# AI Model Configuration
AI_MODEL=claude-sonnet-4-5-20250929
AI_MAX_TOKENS=2000

# Existing vars (keep these)
DATABASE_URL=postgresql://...
ANTHROPIC_API_KEY=sk-ant-...
```

### Step 4: Authenticate Gmail

Run the OAuth authentication flow:

```bash
npm run gmail:auth
```

This will:
1. Generate an OAuth authorization URL
2. Open your browser to Google's consent screen
3. After you approve, you'll get a code
4. Paste the code back into the terminal
5. Tokens will be saved to the database

**Note:** This is a one-time setup per user. Tokens are automatically refreshed.

### Step 5: Test the Installation

Run the test suite to verify everything works:

```bash
tsx scripts/test-inbox-tools.ts
```

This tests:
- Gmail authentication
- Inbox fetching
- Email search
- Thread retrieval
- MCP tool integration

## Usage Examples

### Reading Inbox

```typescript
// Via MCP tool
{
  "tool": "read_inbox",
  "arguments": {
    "max_results": 50,
    "unread_only": true
  }
}
```

### Searching Emails

```typescript
{
  "tool": "search_emails",
  "arguments": {
    "query": "from:client@example.com has:attachment after:2024/01/01",
    "max_results": 20
  }
}
```

### Getting Full Thread

```typescript
{
  "tool": "get_email_thread",
  "arguments": {
    "thread_id": "thread_id_from_inbox"
  }
}
```

### Composing Email

```typescript
{
  "tool": "compose_email",
  "arguments": {
    "to": "client@example.com",
    "subject": "Project Update",
    "body_html": "<p>Hi there,</p><p>Here's the update...</p>",
    "cc": ["manager@company.com"]
  }
}
```

### Replying to Email

```typescript
{
  "tool": "reply_to_email",
  "arguments": {
    "thread_id": "thread_id_here",
    "body_html": "<p>Thanks for your email. Here's my response...</p>"
  }
}
```

### Organizing Emails

```typescript
// Archive emails
{
  "tool": "organize_email",
  "arguments": {
    "message_ids": ["msg1", "msg2"],
    "action": "archive"
  }
}

// Mark as read
{
  "tool": "organize_email",
  "arguments": {
    "message_ids": ["msg1"],
    "action": "mark_read"
  }
}
```

### AI Thread Summary

```typescript
{
  "tool": "summarize_thread",
  "arguments": {
    "thread_id": "thread_id_here",
    "length": "medium"  // short, medium, or detailed
  }
}
```

### AI Reply Suggestions

```typescript
{
  "tool": "suggest_reply",
  "arguments": {
    "thread_id": "thread_id_here",
    "tone": "professional",  // professional, friendly, or brief
    "count": 3
  }
}
```

## Multi-Tenant Support

All new tools support optional `user_id` parameter for multi-tenant scenarios:

```typescript
{
  "tool": "read_inbox",
  "arguments": {
    "user_id": "user-123",
    "max_results": 50
  }
}
```

Each user needs their own Gmail OAuth authentication. Tokens are stored per user in the database.

## Gmail Search Syntax

The `search_emails` tool supports full Gmail search operators:

- `from:sender@email.com` - Emails from specific sender
- `to:recipient@email.com` - Emails to specific recipient
- `subject:keywords` - Subject line keywords
- `has:attachment` - Only emails with attachments
- `is:unread` - Only unread emails
- `is:starred` - Only starred emails
- `after:2024/01/01` - Date filters
- `before:2024/12/31` - Date filters
- `label:labelname` - Filter by label
- `"exact phrase"` - Exact phrase matching
- `OR` - Either term
- `-term` - Exclude term

## Caching

Emails are automatically cached in the `email_cache` table for:
- Faster subsequent access
- Reduced Gmail API calls
- Offline analysis capability

Cache is updated whenever emails are fetched.

## Rate Limits

Gmail API has quotas:
- **Queries per day**: 1 billion (shared across all API calls)
- **Queries per second per user**: 250

EmailOrchestrator Pro handles these automatically with:
- Intelligent batching
- Error handling with retries
- Rate limit detection

## Security Considerations

1. **OAuth Tokens**: Stored in database, should be encrypted at rest in production
2. **Access Scopes**: Uses minimal required scopes for functionality
3. **Multi-Tenant**: Each user's tokens are isolated by user_id
4. **Refresh Tokens**: Automatically refreshed when access token expires

## Troubleshooting

### "Gmail not authenticated" Error

**Solution**: Run `npm run gmail:auth` to complete OAuth flow

### "Invalid credentials" Error

**Solution**: Check that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct in `.env`

### "Insufficient permissions" Error

**Solution**: Ensure all required scopes are enabled in Google Cloud Console OAuth consent screen

### "Quota exceeded" Error

**Solution**: Gmail API quota exceeded. Wait for quota reset (daily) or request quota increase in Google Cloud Console

### OAuth redirect doesn't work

**Solution**: Ensure `http://localhost:3000/oauth/callback` is added to "Authorized redirect URIs" in Google Cloud Console

## Development

### Running in Development

```bash
npm run dev
```

### Building for Production

```bash
npm run build
npm start
```

### Running Tests

```bash
tsx scripts/test-inbox-tools.ts
```

## Integration with Claude Desktop/Code

EmailOrchestrator Pro is designed as an MCP server. Add to your Claude Desktop/Code configuration:

```json
{
  "mcpServers": {
    "email-orchestrator-pro": {
      "command": "node",
      "args": ["/path/to/email-orchestrator/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://...",
        "ANTHROPIC_API_KEY": "sk-ant-...",
        "GOOGLE_CLIENT_ID": "...",
        "GOOGLE_CLIENT_SECRET": "..."
      }
    }
  }
}
```

## Roadmap

Future enhancements:
- **Outlook/Office 365 support** - Additional email provider
- **Attachments download** - Full attachment handling
- **Email drafts** - Save and manage drafts
- **Calendar integration** - Meeting scheduling
- **Automated workflows** - Rules-based email processing
- **Bulk operations** - Process hundreds of emails at once
- **Advanced AI** - Smart categorization, priority detection

## Support

For issues or questions:
1. Check this documentation
2. Review test suite output: `tsx scripts/test-inbox-tools.ts`
3. Check logs for detailed error messages
4. Verify Google Cloud Console configuration

## License

Same license as EmailOrchestrator MCP.
