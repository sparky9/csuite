/**
 * Test script for EmailOrchestrator Pro inbox management tools
 * Run: tsx scripts/test-inbox-tools.ts
 */

import dotenv from 'dotenv';
import { db } from '../src/db/client.js';
import { logger } from '../src/utils/logger.js';
import { GmailAuth } from '../src/integrations/gmail/auth.js';
import { fetchInbox, searchEmails, getThread } from '../src/integrations/gmail/inbox.js';
import { composeAndSend, replyToEmail } from '../src/integrations/gmail/send.js';
import { organizeEmails } from '../src/integrations/gmail/organize.js';

dotenv.config();

async function testAuthentication() {
  console.log('\n=== Testing Gmail Authentication ===\n');

  try {
    const isAuthenticated = await GmailAuth.isAuthenticated();
    console.log(`Authenticated: ${isAuthenticated}`);

    if (isAuthenticated) {
      const email = await GmailAuth.getEmailAddress();
      console.log(`Email: ${email}`);
    } else {
      console.log('\nTo authenticate:');
      console.log('1. Run: tsx scripts/gmail-auth.ts');
      console.log('2. Follow the OAuth flow');
      console.log('3. Re-run this test');
    }

    return isAuthenticated;
  } catch (error: any) {
    console.error('Authentication test failed:', error.message);
    return false;
  }
}

async function testFetchInbox() {
  console.log('\n=== Testing Fetch Inbox ===\n');

  try {
    const emails = await fetchInbox(undefined, {
      max_results: 5,
      unread_only: false,
    });

    console.log(`Fetched ${emails.length} emails\n`);

    emails.forEach((email, idx) => {
      console.log(`${idx + 1}. ${email.subject}`);
      console.log(`   From: ${email.from_name || email.from_email}`);
      console.log(`   Date: ${email.date.toISOString()}`);
      console.log(`   Unread: ${email.is_unread}`);
      console.log(`   Thread ID: ${email.thread_id}`);
      console.log(`   Snippet: ${email.snippet.substring(0, 80)}...`);
      console.log('');
    });

    return emails.length > 0 ? emails[0] : null;
  } catch (error: any) {
    console.error('Fetch inbox failed:', error.message);
    return null;
  }
}

async function testSearchEmails() {
  console.log('\n=== Testing Search Emails ===\n');

  try {
    const results = await searchEmails(undefined, {
      query: 'is:unread',
      max_results: 3,
    });

    console.log(`Found ${results.length} unread emails\n`);

    results.forEach((email, idx) => {
      console.log(`${idx + 1}. ${email.subject}`);
      console.log(`   From: ${email.from_email}`);
      console.log('');
    });

    return results.length > 0;
  } catch (error: any) {
    console.error('Search emails failed:', error.message);
    return false;
  }
}

async function testGetThread(threadId: string) {
  console.log('\n=== Testing Get Thread ===\n');

  try {
    const thread = await getThread(undefined, threadId);

    console.log(`Thread: ${thread.subject}`);
    console.log(`Messages: ${thread.message_count}`);
    console.log(`Participants: ${thread.participants.join(', ')}`);
    console.log(`Unread: ${thread.unread_count}`);
    console.log('');

    thread.messages.forEach((msg, idx) => {
      console.log(`Message ${idx + 1}:`);
      console.log(`  From: ${msg.from_name || msg.from_email}`);
      console.log(`  Date: ${msg.date.toISOString()}`);
      console.log(`  Preview: ${msg.snippet.substring(0, 100)}...`);
      console.log('');
    });

    return true;
  } catch (error: any) {
    console.error('Get thread failed:', error.message);
    return false;
  }
}

async function testComposeEmail() {
  console.log('\n=== Testing Compose Email (DRY RUN) ===\n');

  console.log('Compose email test skipped (would send real email)');
  console.log('To test manually, use:');
  console.log(`
const result = await composeAndSend(undefined, {
  to: 'test@example.com',
  subject: 'Test Email',
  body_html: '<p>This is a test email from EmailOrchestrator Pro</p>',
});
`);

  return true;
}

async function testOrganizeEmail(messageId: string) {
  console.log('\n=== Testing Organize Email (Mark as Read) ===\n');

  try {
    const result = await organizeEmails(undefined, {
      message_ids: [messageId],
      action: 'mark_read',
    });

    console.log(`Organized ${result.modified_count} emails`);
    console.log(`Action: ${result.action}`);

    return true;
  } catch (error: any) {
    console.error('Organize email failed:', error.message);
    return false;
  }
}

async function testMCPTools() {
  console.log('\n=== Testing MCP Tools ===\n');

  try {
    // Import tool handlers
    const { handleReadInbox } = await import('../src/tools/read-inbox.tool.js');
    const { handleSearchEmails } = await import('../src/tools/search-emails.tool.js');

    // Test read_inbox tool
    console.log('Testing read_inbox MCP tool...');
    const inboxResult = await handleReadInbox({ max_results: 3 });
    console.log('read_inbox result:', inboxResult.content[0].text.substring(0, 200) + '...\n');

    // Test search_emails tool
    console.log('Testing search_emails MCP tool...');
    const searchResult = await handleSearchEmails({ query: 'is:unread', max_results: 2 });
    console.log('search_emails result:', searchResult.content[0].text.substring(0, 200) + '...\n');

    return true;
  } catch (error: any) {
    console.error('MCP tools test failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   EmailOrchestrator Pro - Inbox Management Test Suite    ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  try {
    // Connect to database
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL not set in .env');
    }

    await db.connect(dbUrl);
    console.log('✓ Database connected');

    // Test authentication
    const isAuth = await testAuthentication();
    if (!isAuth) {
      console.log('\n⚠ Gmail not authenticated. Some tests will be skipped.');
      console.log('Run: tsx scripts/gmail-auth.ts to set up OAuth\n');
      return;
    }

    // Test inbox fetching
    const firstEmail = await testFetchInbox();

    // Test search
    await testSearchEmails();

    // Test get thread (if we have an email)
    if (firstEmail) {
      await testGetThread(firstEmail.thread_id);
      // await testOrganizeEmail(firstEmail.id); // Uncomment to test organize
    }

    // Test compose (dry run)
    await testComposeEmail();

    // Test MCP tools
    await testMCPTools();

    console.log('\n✓ All tests completed!\n');
  } catch (error: any) {
    console.error('\n✗ Test suite failed:', error.message);
    logger.error('Test suite error', { error: error.stack });
  } finally {
    await db.disconnect();
    console.log('✓ Database disconnected');
  }
}

// Run tests
runAllTests().catch(console.error);
