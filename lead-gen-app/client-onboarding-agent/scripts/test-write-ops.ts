/**
 * Test script for Enhancement #7: Write Operations
 *
 * Tests the new onboarding_step_complete and onboarding_intake_submit tools
 * Run with: npx tsx scripts/test-write-ops.ts
 */

import { completeStep, submitIntakeResponse } from '../src/services/step-complete-service.js';
import { initializeOnboardingDb, shutdownOnboardingDb } from '../src/db/client.js';

async function testStepComplete() {
  console.log('\n🧪 Testing onboarding_step_complete...\n');

  try {
    const result = await completeStep({
      planId: '00000000-0000-0000-0000-000000000001', // Replace with real plan ID
      stepId: '00000000-0000-0000-0000-000000000002', // Replace with real step ID
      completedBy: 'test@example.com',
      completionNotes: 'Completed during test run'
    });

    console.log('✅ Step completed successfully:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error('❌ Step completion failed:', error.message);
  }
}

async function testIntakeSubmit() {
  console.log('\n🧪 Testing onboarding_intake_submit...\n');

  try {
    const result = await submitIntakeResponse({
      intakeRequestId: '00000000-0000-0000-0000-000000000003', // Replace with real intake request ID
      userId: '00000000-0000-0000-0000-000000000004',
      responses: {
        'company_size': '50-100 employees',
        'industry': 'Software Development',
        'goals': 'Improve customer onboarding experience',
        'timeline': 'Q2 2025'
      }
    });

    console.log('✅ Intake submitted successfully:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error('❌ Intake submission failed:', error.message);
  }
}

async function main() {
  console.log('🚀 Enhancement #7: Client Onboarding Write Operations Test');
  console.log('=' .repeat(60));

  await initializeOnboardingDb();

  console.log('\nℹ️  Note: Replace placeholder UUIDs with real IDs from your database');
  console.log('ℹ️  Use existing plan/step/intake IDs or create new test data first\n');

  await testStepComplete();
  await testIntakeSubmit();

  await shutdownOnboardingDb();

  console.log('\n✨ Tests complete!\n');
}

main().catch(console.error);
