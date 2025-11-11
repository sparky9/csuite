#!/usr/bin/env node

/**
 * Stripe Products Setup Script
 *
 * Creates Stripe products and prices matching VPA pricing plans.
 * Run this once to initialize your Stripe account with VPA products.
 *
 * Usage: npm run stripe:setup
 */

import { stripe } from '../../src/billing/stripe-client.js';
import { PRICING_PLANS } from '../../src/config/pricing.js';
import { logger } from '../../src/utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

interface ProductResult {
  plan: string;
  productId: string;
  priceId: string;
  amount: number;
}

async function setupStripeProducts(): Promise<void> {
  console.log('\n🎯 VPA Stripe Products Setup');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results: ProductResult[] = [];

  for (const plan of PRICING_PLANS) {
    try {
      console.log(`Creating product: ${plan.name}...`);

      // Create product
      const product = await stripe.products.create({
        name: plan.name,
        description: `VPA ${plan.displayName} - Modules: ${plan.modules.join(', ')}`,
        metadata: {
          plan_id: plan.id,
          display_name: plan.displayName,
          modules: plan.modules.join(','),
        },
      });

      logger.info('Stripe product created', {
        product_id: product.id,
        plan_name: plan.name
      });

      // Create price
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.priceMonthly, // Already in cents
        currency: 'usd',
        recurring: {
          interval: 'month',
        },
        metadata: {
          plan_id: plan.id,
        },
      });

      logger.info('Stripe price created', {
        price_id: price.id,
        amount: plan.priceMonthly
      });

      results.push({
        plan: plan.name,
        productId: product.id,
        priceId: price.id,
        amount: plan.priceMonthly,
      });

      console.log(`  ✅ Product ID: ${product.id}`);
      console.log(`  ✅ Price ID:   ${price.id}`);
      console.log(`  ✅ Amount:     $${plan.priceMonthly / 100}/month\n`);

    } catch (error) {
      logger.error('Failed to create Stripe product', {
        plan: plan.name,
        error: error instanceof Error ? error.message : String(error)
      });
      console.error(`  ❌ Failed: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }

  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Setup Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (results.length === 0) {
    console.log('❌ No products created. Check errors above.\n');
    return;
  }

  console.log(`✅ Created ${results.length} product(s)\n`);

  console.log('📝 Price IDs for reference:\n');
  results.forEach((result) => {
    console.log(`${result.plan}:`);
    console.log(`  Price ID: ${result.priceId}`);
    console.log(`  Amount:   $${result.amount / 100}/month\n`);
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n✨ Next Steps:\n');
  console.log('1. Save these Price IDs for creating checkout sessions');
  console.log('2. Setup webhook endpoint in Stripe Dashboard');
  console.log('3. Run: npm run stripe:checkout (to create test checkout link)');
  console.log('4. See STRIPE_SETUP.md for full configuration guide\n');
}

// Run setup
setupStripeProducts()
  .then(() => {
    console.log('✅ Setup complete!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    logger.error('Stripe setup failed', { error });
    process.exit(1);
  });
