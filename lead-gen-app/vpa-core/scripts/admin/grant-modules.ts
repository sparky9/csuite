/**
 * Admin Tool: Grant/Revoke Modules
 *
 * Add or remove modules from existing users.
 * Usage: npm run admin:grant-modules
 */

import { db } from '../../src/db/client.js';
import { logger, logError } from '../../src/utils/logger.js';
import { PRICING_PLANS } from '../../src/config/pricing.js';
import dotenv from 'dotenv';
import {
  prompt,
  promptNumber,
  confirm,
  isValidEmail,
  formatCurrency,
  header,
  success,
  error,
  divider,
  info
} from './utils.js';

dotenv.config();

// All available modules
const ALL_MODULES = [
  'vpa-core',
  'lead-tracker',
  'prospect-finder',
  'email-orchestrator'
];

const MODULE_PRICES = {
  'vpa-core': 0, // Core module is free (included in base)
  'lead-tracker': 0, // Included in base
  'prospect-finder': 5000, // $50/month
  'email-orchestrator': 2500 // $25/month
};

async function grantModules() {
  try {
    await db.connect();

    header('VPA Admin - Grant/Revoke Modules');

    // Get user email
    let email: string;
    let user: any;
    while (true) {
      email = await prompt('User email: ');

      const result = await db.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        error('User not found. Please try again.');
        continue;
      }

      user = result.rows[0];
      break;
    }

    // Get current subscription
    const subResult = await db.query(
      'SELECT * FROM user_subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [user.user_id]
    );

    if (subResult.rows.length === 0) {
      error('User has no subscription!');
      return;
    }

    const subscription = subResult.rows[0];
    const currentModules: string[] = subscription.modules;

    // Show current status
    console.log('\n');
    divider();
    console.log(`User: ${user.name} (${user.email})`);
    console.log(`Current Plan: ${subscription.plan_name}`);
    console.log(`Current Price: ${formatCurrency(subscription.price_monthly)}/month`);
    console.log(`Current Modules: ${currentModules.join(', ')}`);
    divider();
    console.log();

    // Show available actions
    console.log('Actions:');
    console.log('  [1] Add modules');
    console.log('  [2] Remove modules');
    console.log('  [3] Cancel');
    console.log();

    const action = await promptNumber('Select action: ', 1, 3);

    if (action === 3) {
      console.log('\n❌ Cancelled\n');
      return;
    }

    let newModules: string[] = [...currentModules];
    let newPrice = subscription.price_monthly;

    if (action === 1) {
      // Add modules
      const availableToAdd = ALL_MODULES.filter(m => !currentModules.includes(m));

      if (availableToAdd.length === 0) {
        info('User already has all modules!');
        return;
      }

      console.log('\nAvailable modules to add:');
      availableToAdd.forEach((mod, idx) => {
        const price = MODULE_PRICES[mod as keyof typeof MODULE_PRICES];
        const priceStr = price > 0 ? ` (+${formatCurrency(price)}/month)` : ' (included)';
        console.log(`  [${idx + 1}] ${mod}${priceStr}`);
      });
      console.log();

      const choices = await prompt('Select modules to add (comma-separated numbers, or "all"): ');

      if (choices.toLowerCase() === 'all') {
        newModules = [...currentModules, ...availableToAdd];
        availableToAdd.forEach(mod => {
          newPrice += MODULE_PRICES[mod as keyof typeof MODULE_PRICES];
        });
      } else {
        const selected = choices.split(',').map(s => parseInt(s.trim()));
        selected.forEach(choice => {
          if (choice > 0 && choice <= availableToAdd.length) {
            const module = availableToAdd[choice - 1];
            newModules.push(module);
            newPrice += MODULE_PRICES[module as keyof typeof MODULE_PRICES];
          }
        });
      }

    } else if (action === 2) {
      // Remove modules
      const removableModules = currentModules.filter(m => m !== 'vpa-core'); // Can't remove core

      if (removableModules.length === 0) {
        info('Only core modules remain - cannot remove!');
        return;
      }

      console.log('\nRemovable modules:');
      removableModules.forEach((mod, idx) => {
        const price = MODULE_PRICES[mod as keyof typeof MODULE_PRICES];
        const priceStr = price > 0 ? ` (-${formatCurrency(price)}/month)` : '';
        console.log(`  [${idx + 1}] ${mod}${priceStr}`);
      });
      console.log();

      const choices = await prompt('Select modules to remove (comma-separated numbers): ');
      const selected = choices.split(',').map(s => parseInt(s.trim()));

      selected.forEach(choice => {
        if (choice > 0 && choice <= removableModules.length) {
          const module = removableModules[choice - 1];
          newModules = newModules.filter(m => m !== module);
          newPrice -= MODULE_PRICES[module as keyof typeof MODULE_PRICES];
        }
      });
    }

    // Show changes
    console.log('\n');
    divider();
    console.log('Changes:');
    console.log(`  Old modules: ${currentModules.join(', ')}`);
    console.log(`  New modules: ${newModules.join(', ')}`);
    console.log(`  Old price: ${formatCurrency(subscription.price_monthly)}/month`);
    console.log(`  New price: ${formatCurrency(newPrice)}/month`);
    divider();
    console.log();

    const confirmed = await confirm('Apply these changes?');
    if (!confirmed) {
      console.log('\n❌ Changes cancelled\n');
      return;
    }

    // Update subscription
    await db.query(
      `UPDATE user_subscriptions
       SET modules = $1, price_monthly = $2, updated_at = NOW()
       WHERE subscription_id = $3`,
      [newModules, newPrice, subscription.subscription_id]
    );

    success('Modules updated successfully!');
    console.log();
    console.log(`✅ New modules: ${newModules.join(', ')}`);
    console.log(`💰 New price: ${formatCurrency(newPrice)}/month`);
    console.log();

    // Log admin action
    logger.info('Admin: Modules updated', {
      adminAction: 'grant-modules',
      userId: user.user_id,
      email: user.email,
      oldModules: currentModules,
      newModules,
      oldPrice: subscription.price_monthly,
      newPrice
    });

  } catch (err) {
    logError('Failed to grant modules', err);
    error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  } finally {
    await db.disconnect();
  }
}

// Run the tool
grantModules();
