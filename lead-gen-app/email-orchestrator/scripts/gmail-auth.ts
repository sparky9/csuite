/**
 * Gmail OAuth authentication helper
 * Interactive script to authorize Gmail API access
 */

import dotenv from 'dotenv';
import { google } from 'googleapis';
import * as readline from 'readline';
import pg from 'pg';

const { Client } = pg;

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function authenticate() {
  console.log('EmailOrchestrator - Gmail OAuth Setup');
  console.log('=====================================\n');

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/oauth/callback';

  if (!clientId || !clientSecret) {
    console.error('ERROR: Gmail OAuth credentials not configured');
    console.log('\nPlease set in .env:');
    console.log('  GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com');
    console.log('  GMAIL_CLIENT_SECRET=your-client-secret');
    console.log('\nSee GMAIL_OAUTH_GUIDE.md for instructions\n');
    rl.close();
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  // Generate auth URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.send'],
    prompt: 'consent',
  });

  console.log('Step 1: Authorize Gmail access');
  console.log('-------------------------------');
  console.log('Open this URL in your browser:\n');
  console.log(authUrl);
  console.log();

  const code = await question('Paste the authorization code here: ');

  try {
    console.log('\nStep 2: Exchanging code for tokens...');
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Failed to get tokens from Google');
    }

    console.log('✓ Tokens received\n');

    // Save to database
    console.log('Step 3: Saving tokens to database...');

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL not set');
    }

    const client = new Client({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
    });

    await client.connect();

    await client.query(
      `INSERT INTO email_config (key, value, updated_at)
       VALUES
         ('gmail_access_token', $1, NOW()),
         ('gmail_refresh_token', $2, NOW()),
         ('gmail_token_expiry', $3, NOW())
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         updated_at = NOW()`,
      [tokens.access_token, tokens.refresh_token, tokens.expiry_date?.toString() || '0']
    );

    await client.end();

    console.log('✓ Tokens saved to database\n');

    // Test sending
    console.log('Step 4: Testing Gmail API...');

    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Just verify we can access the API
    const profile = await gmail.users.getProfile({ userId: 'me' });

    console.log('✓ Gmail API access verified');
    console.log('  Email:', profile.data.emailAddress);
    console.log();

    console.log('========================================');
    console.log('Gmail OAuth setup completed!');
    console.log('========================================\n');
    console.log('You can now send emails via the EmailOrchestrator MCP server.\n');
  } catch (error: any) {
    console.error('\nERROR:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    process.exit(1);
  } finally {
    rl.close();
  }
}

authenticate();
