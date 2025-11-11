/**
 * Smoke test for the autonomous support agent.
 *
 * Usage: npm run test:support-agent [subject] [body]
 * Defaults provide a generic ticket if arguments are omitted.
 */

import { handleSupportTicket } from 'support-agent';
import { logger } from '../src/utils/logger.js';

async function main() {
  // Enable mock mode so we do not require live Anthropic access for smoke testing
  process.env.MOCK_SUPPORT_AGENT = process.env.MOCK_SUPPORT_AGENT ?? '1';

  const subject = process.argv[2] || 'Need help getting started';
  const body =
    process.argv[3] ||
    'Hi team, I just installed the product and would love a quick overview of the setup steps. Can you point me in the right direction?';

  logger.info('Support agent smoke test starting', { subject });

  const result = await handleSupportTicket(
    {
      id: 'smoke-ticket-001',
      subject,
      body,
      customerName: 'Pat Customer',
      channel: 'email',
      priority: 'medium',
    },
    {
      mockMode: true,
    }
  );

  console.log('\n' + '='.repeat(80));
  console.log('SUPPORT AGENT SMOKE TEST RESULT');
  console.log('='.repeat(80));
  console.log(`Outcome: ${result.outcome}`);
  console.log(`Summary: ${result.summary}`);

  if (result.reply) {
    console.log('\nReply Draft:\n');
    console.log(result.reply);
  }

  if (result.citations.length) {
    console.log('\nCitations:');
    for (const citation of result.citations) {
      console.log(
        `- ${citation.sourceId}: ${citation.documentSource} (score ${(citation.score * 100).toFixed(1)}%)`
      );
      if (citation.location) {
        console.log(`  location: ${citation.location}`);
      }
    }
  }

  console.log('\nRaw Result JSON:\n');
  console.log(JSON.stringify(result, null, 2));
  console.log('\n' + '='.repeat(80) + '\n');
}

main().catch((error) => {
  logger.error('Support agent smoke test failed', { error });
  console.error('Support agent smoke test failed:', error);
  process.exit(1);
});
