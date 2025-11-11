#!/usr/bin/env tsx
import dotenv from 'dotenv';
import { handleSupportTicket } from '../src/agents/support-agent.js';

dotenv.config();

async function main(): Promise<void> {
  const result = await handleSupportTicket(
    {
      id: 'demo-ticket-001',
      subject: 'Demo: Password reset issue',
      body: 'Customer cannot reset their password after multiple attempts. They receive an unknown error.',
      customerName: 'Demo Customer',
      channel: 'email',
      priority: 'medium',
    },
    {
      mockMode: true,
      topK: 3,
    },
  );

  console.log('Support Agent Smoke Test Result');
  console.log('================================');
  console.log(JSON.stringify(result, null, 2));

  if (result.outcome === 'escalate') {
    console.log('\nNote: The mock pipeline escalates when no knowledge is ingested.');
  }
}

main().catch((error) => {
  console.error('Smoke test failed');
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
