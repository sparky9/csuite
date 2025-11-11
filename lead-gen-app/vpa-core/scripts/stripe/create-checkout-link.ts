#!/usr/bin/env node

/**
 * Create Stripe Checkout Link (CLI Tool)
 *
 * Interactive CLI to generate Stripe checkout links for VPA subscriptions.
 * Useful for manual customer onboarding or testing.
 *
 * Usage: npm run stripe:checkout
 */

import { createCheckoutSession } from '../../src/billing/create-checkout.js';
import { PRICING_PLANS } from '../../src/config/pricing.js';
import readline from 'readline';
import dotenv from 'dotenv';

dotenv.config();

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function createCheckoutLink(): Promise<void> {
  console.log('\n🔗 VPA - Create Stripe Checkout Link');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Show available plans
  console.log('Available VPA Plans:\n');
  PRICING_PLANS.forEach((plan, idx) => {
    const marker = plan.recommended ? ' ⭐ RECOMMENDED' : '';
    console.log(`  [${idx + 1}] ${plan.displayName}${marker}`);
    console.log(`      ${plan.name} - $${plan.priceMonthly / 100}/month`);
    console.log(`      Modules: ${plan.modules.join(', ')}\n`);
  });

  // Get plan selection
  const planChoice = parseInt(await prompt('Select plan number: ')) - 1;

  if (planChoice < 0 || planChoice >= PRICING_PLANS.length) {
    console.error('❌ Invalid plan selection');
    process.exit(1);
  }

  const plan = PRICING_PLANS[planChoice];

  // Get customer details
  const email = await prompt('Customer email (optional, press Enter to skip): ');
  const trialDaysInput = await prompt('Trial days (0 for no trial, default 0): ');
  const trialDays = parseInt(trialDaysInput) || 0;

  // Get Stripe Price ID (you need to run stripe:setup first)
  console.log('\n💡 Tip: Run "npm run stripe:setup" first to create products');
  const priceId = await prompt(`\nStripe Price ID for "${plan.name}": `);

  if (!priceId) {
    console.error('❌ Price ID is required');
    process.exit(1);
  }

  console.log('\n⏳ Creating checkout session...\n');

  try {
    const session = await createCheckoutSession({
      priceId,
      customerEmail: email || undefined,
      trialDays: trialDays > 0 ? trialDays : undefined,
      metadata: {
        plan_id: plan.id,
        plan_name: plan.name,
      },
    });

    if (!session.url) {
      console.error('❌ Failed to create checkout URL');
      process.exit(1);
    }

    // Display success
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Checkout Link Created!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`Plan:     ${plan.displayName}`);
    console.log(`Price:    $${plan.priceMonthly / 100}/month`);
    console.log(`Modules:  ${plan.modules.join(', ')}`);
    if (email) console.log(`Email:    ${email}`);
    if (trialDays) console.log(`Trial:    ${trialDays} days`);
    console.log(`\nSession:  ${session.id}`);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🔗 CHECKOUT URL:\n');
    console.log(session.url);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📧 Send this link to the customer to complete payment.\n');
    console.log('⚠️  Link expires in 24 hours.\n');

  } catch (error) {
    console.error('\n❌ Failed to create checkout link:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run
createCheckoutLink()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
