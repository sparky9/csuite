# Gmail OAuth Setup Guide

**Complete guide to setting up Gmail API for EmailOrchestrator**

## Overview

EmailOrchestrator uses Gmail API to send emails (zero cost, 500/day limit). This requires OAuth 2.0 authentication through Google Cloud Console.

## Prerequisites

- Gmail account (the one you'll send emails from)
- Google Cloud Console access

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)

2. Click **Select a project** → **New Project**

3. Enter project details:
   - **Project name**: EmailOrchestrator
   - **Location**: Your organization (or "No organization")

4. Click **Create**

## Step 2: Enable Gmail API

1. In your project, go to **APIs & Services** → **Library**

2. Search for "Gmail API"

3. Click **Gmail API**

4. Click **Enable**

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**

2. Select **External** (unless you have Google Workspace)

3. Click **Create**

4. Fill in **App information**:
   - **App name**: EmailOrchestrator
   - **User support email**: Your email
   - **Developer contact email**: Your email

5. Click **Save and Continue**

6. **Scopes** page:
   - Click **Add or Remove Scopes**
   - Search for "gmail send"
   - Select: `https://www.googleapis.com/auth/gmail.send`
   - Click **Update**
   - Click **Save and Continue**

7. **Test users** page:
   - Click **Add Users**
   - Add your Gmail address
   - Click **Save and Continue**

8. Review and click **Back to Dashboard**

## Step 4: Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**

2. Click **Create Credentials** → **OAuth client ID**

3. Select **Application type**:
   - Choose: **Web application**

4. Enter **Name**: EmailOrchestrator OAuth Client

5. **Authorized redirect URIs**:
   - Click **Add URI**
   - Enter: `http://localhost:3000/oauth/callback`
   - (This doesn't need to be a real server - OAuth will capture the code in the URL)

6. Click **Create**

7. **Save your credentials**:
   - Copy **Client ID** (looks like: `123456789.apps.googleusercontent.com`)
   - Copy **Client secret** (looks like: `GOCSPX-abcd1234...`)
   - Click **OK**

## Step 5: Add Credentials to .env

Edit your `.env` file:

```env
GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-your-client-secret
GMAIL_REDIRECT_URI=http://localhost:3000/oauth/callback
```

## Step 6: Run Authentication Script

```bash
npm run gmail:auth
```

You'll see:

```
EmailOrchestrator - Gmail OAuth Setup
=====================================

Step 1: Authorize Gmail access
-------------------------------
Open this URL in your browser:

https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&scope=...

Paste the authorization code here:
```

### What to do:

1. **Copy the URL** from the terminal

2. **Open it in your browser**

3. You'll see Google's authorization page:
   - It may say "Google hasn't verified this app" - this is normal for personal projects
   - Click **Advanced**
   - Click **Go to EmailOrchestrator (unsafe)** - it's safe because it's YOUR app

4. **Select your Gmail account**

5. **Grant permissions**:
   - You'll see: "EmailOrchestrator wants to access your Google Account"
   - It will request permission to: "Send email on your behalf"
   - Click **Allow**

6. **You'll be redirected** to `http://localhost:3000/oauth/callback?code=...`
   - The page will fail to load (that's okay!)
   - Copy the entire URL from your browser's address bar

7. **Extract the authorization code**:
   - From the URL, copy everything after `code=` and before `&scope`
   - Example: If URL is `http://localhost:3000/oauth/callback?code=4/0AX4XfWh...&scope=...`
   - Copy: `4/0AX4XfWh...`

8. **Paste the code** into the terminal and press Enter

You should see:

```
Step 2: Exchanging code for tokens...
✓ Tokens received

Step 3: Saving tokens to database...
✓ Tokens saved to database

Step 4: Testing Gmail API...
✓ Gmail API access verified
  Email: your-email@gmail.com

========================================
Gmail OAuth setup completed!
========================================
```

## Step 7: Verify Authentication

The tokens are now saved in your database. You can verify:

```sql
SELECT key, LEFT(value, 20) as value_preview
FROM email_config
WHERE key LIKE 'gmail%';
```

You should see:
- `gmail_access_token`
- `gmail_refresh_token`
- `gmail_token_expiry`

## Token Refresh

The access token expires after 1 hour. EmailOrchestrator automatically:
- Detects expiration
- Uses refresh token to get new access token
- Saves new token to database
- Continues sending emails

You only need to run `npm run gmail:auth` once (unless you revoke access).

## Testing Email Sending

Send a test email via Claude Desktop:

```
Use email-orchestrator to send a test email to yourself at your-email@gmail.com
Subject: "Test from EmailOrchestrator"
Body: "This is a test email to verify Gmail API is working"
```

Check your email - you should receive it!

## Troubleshooting

### Issue: "Access blocked: This app's request is invalid"

**Cause:** Redirect URI mismatch

**Solution:**
1. Go to Google Cloud Console → Credentials
2. Click your OAuth client
3. Verify redirect URI is exactly: `http://localhost:3000/oauth/callback`
4. Try authentication again

### Issue: "The app is not verified"

**Cause:** Normal for personal projects

**Solution:**
1. Click **Advanced**
2. Click **Go to EmailOrchestrator (unsafe)**
3. Continue with authorization

### Issue: "Invalid grant: Token has been expired or revoked"

**Cause:** Refresh token expired (shouldn't happen often)

**Solution:** Re-run `npm run gmail:auth`

### Issue: "Insufficient Permission"

**Cause:** Missing Gmail API scope

**Solution:**
1. Go to OAuth consent screen
2. Add scope: `https://www.googleapis.com/auth/gmail.send`
3. Re-authenticate

### Issue: "Daily sending quota exceeded"

**Cause:** Gmail free tier limits to 500/day

**Solution:**
1. Wait until next day (resets at midnight PT)
2. Or upgrade to Google Workspace for 2000/day limit

## Gmail Sending Limits

### Free Gmail Account
- **Daily limit**: 500 emails
- **Hourly limit**: ~50 emails (not official, but recommended)
- **Per-minute**: ~10 emails

### Google Workspace Account
- **Daily limit**: 2,000 emails
- **Better deliverability**
- **Custom domain** (looks more professional)

EmailOrchestrator respects these limits automatically.

## Security Best Practices

1. **Never commit credentials**
   - `.env` is in `.gitignore`
   - Tokens are in database, not code

2. **Restrict OAuth client**
   - Only add trusted users to test users list
   - Keep client secret confidential

3. **Monitor usage**
   - Check sent_emails table regularly
   - Watch for unusual patterns

4. **Revoke access if needed**
   - Go to Google Account → Security → Third-party apps
   - Remove EmailOrchestrator if needed

## Advanced: Using Different Gmail Account

To send from a different account:

1. Update test users in OAuth consent screen
2. Run `npm run gmail:auth` again
3. Authorize with the new account
4. Update `from_email` in campaigns to match

## Support

If you encounter issues not covered here:

1. Check Google Cloud Console error messages
2. Review EmailOrchestrator logs
3. Verify `.env` credentials are correct
4. Try re-running authentication

Happy sending!
