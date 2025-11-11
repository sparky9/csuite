/**
 * Admin Tool: Manage Subscriptions
 *
 * Update subscription status, plans, billing, and periods.
 * Usage: npm run admin:manage-subs
 */

import { db } from '../../src/db/client.js';
import { logger, logError } from '../../src/utils/logger.js';
import { PRICING_PLANS } from '../../src/config/pricing.js';
import dotenv from 'dotenv';
import {
  prompt,
  promptNumber,
  confirm,
  formatCurrency,
  formatDate,
  header,
  success,
  error,
  divider,
  info
} from './utils.js';

dotenv.config();

async function changePlan(userId: string, subscription: any) {
  console.log('\nAvailable Plans:');
  PRICING_PLANS.forEach((plan, idx) => {
    const current = plan.id === subscription.plan_name ? ' (CURRENT)' : '';
    const recommended = plan.recommended ? ' ⭐' : '';
    console.log(`  [${idx + 1}] ${plan.displayName} - ${formatCurrency(plan.priceMonthly)}/month${current}${recommended}`);
    console.log(`      Modules: ${plan.modules.join(', ')}`);
  });
  console.log();

  const planChoice = await promptNumber('Select new plan (0 to cancel): ', 0, PRICING_PLANS.length);

  if (planChoice === 0) {
    return;
  }

  const newPlan = PRICING_PLANS[planChoice - 1];

  console.log('\n');
  divider();
  console.log('Plan Change:');
  console.log(`  Old: ${subscription.plan_name} - ${formatCurrency(subscription.price_monthly)}/month`);
  console.log(`  New: ${newPlan.displayName} - ${formatCurrency(newPlan.priceMonthly)}/month`);
  console.log(`  Modules: ${newPlan.modules.join(', ')}`);
  divider();
  console.log();

  const confirmed = await confirm('Apply plan change?');
  if (!confirmed) {
    console.log('\n❌ Cancelled\n');
    return;
  }

  await db.query(
    `UPDATE user_subscriptions
     SET plan_name = $1, modules = $2, price_monthly = $3, updated_at = NOW()
     WHERE subscription_id = $4`,
    [newPlan.id, newPlan.modules, newPlan.priceMonthly, subscription.subscription_id]
  );

  success('Plan changed successfully!');
  logger.info('Admin: Plan changed', {
    adminAction: 'change-plan',
    userId,
    oldPlan: subscription.plan_name,
    newPlan: newPlan.id
  });
}

async function extendPeriod(userId: string, subscription: any) {
  const currentEnd = new Date(subscription.current_period_end);
  console.log(`\nCurrent period ends: ${formatDate(currentEnd)}`);

  const days = await promptNumber('Extend by how many days? ', 1);

  const newEnd = new Date(currentEnd.getTime() + days * 24 * 60 * 60 * 1000);

  console.log(`\nNew period end: ${formatDate(newEnd)}`);

  const confirmed = await confirm('Apply extension?');
  if (!confirmed) {
    console.log('\n❌ Cancelled\n');
    return;
  }

  await db.query(
    `UPDATE user_subscriptions
     SET current_period_end = $1, updated_at = NOW()
     WHERE subscription_id = $2`,
    [newEnd, subscription.subscription_id]
  );

  success(`Period extended by ${days} days!`);
  logger.info('Admin: Period extended', {
    adminAction: 'extend-period',
    userId,
    days,
    newEnd
  });
}

async function updateStatus(userId: string, subscription: any) {
  console.log('\nStatus Options:');
  console.log('  [1] active');
  console.log('  [2] trialing');
  console.log('  [3] past_due');
  console.log('  [4] cancelled');
  console.log();

  const statusChoice = await promptNumber('Select new status: ', 1, 4);
  const statuses = ['active', 'trialing', 'past_due', 'cancelled'];
  const newStatus = statuses[statusChoice - 1];

  console.log(`\nChange status from "${subscription.status}" to "${newStatus}"`);

  const confirmed = await confirm('Confirm status change?');
  if (!confirmed) {
    console.log('\n❌ Cancelled\n');
    return;
  }

  // If setting to cancelled, also update user status
  if (newStatus === 'cancelled') {
    await db.query('BEGIN');
    try {
      await db.query(
        `UPDATE user_subscriptions
         SET status = $1, updated_at = NOW()
         WHERE subscription_id = $2`,
        [newStatus, subscription.subscription_id]
      );

      await db.query(
        `UPDATE users
         SET status = 'cancelled'
         WHERE user_id = $1`,
        [userId]
      );

      await db.query('COMMIT');
      success('Subscription and user cancelled!');
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    }
  } else {
    await db.query(
      `UPDATE user_subscriptions
       SET status = $1, updated_at = NOW()
       WHERE subscription_id = $2`,
      [newStatus, subscription.subscription_id]
    );

    // If reactivating, also reactivate user
    if (newStatus === 'active' || newStatus === 'trialing') {
      await db.query(
        `UPDATE users
         SET status = 'active'
         WHERE user_id = $1`,
        [userId]
      );
    }

    success(`Status changed to "${newStatus}"!`);
  }

  logger.info('Admin: Status changed', {
    adminAction: 'change-status',
    userId,
    oldStatus: subscription.status,
    newStatus
  });
}

async function extendTrial(userId: string, subscription: any) {
  const currentTrial = subscription.trial_end ? new Date(subscription.trial_end) : null;

  if (currentTrial) {
    console.log(`\nCurrent trial ends: ${formatDate(currentTrial)}`);
  } else {
    console.log('\nNo active trial period');
  }

  const days = await promptNumber('Set trial for how many days from now? ', 0);

  if (days === 0) {
    const confirmed = await confirm('Remove trial period?');
    if (confirmed) {
      await db.query(
        `UPDATE user_subscriptions
         SET trial_end = NULL, status = 'active', updated_at = NOW()
         WHERE subscription_id = $1`,
        [subscription.subscription_id]
      );
      success('Trial period removed!');
    }
    return;
  }

  const newTrialEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  console.log(`\nNew trial end: ${formatDate(newTrialEnd)}`);

  const confirmed = await confirm('Apply trial extension?');
  if (!confirmed) {
    console.log('\n❌ Cancelled\n');
    return;
  }

  await db.query(
    `UPDATE user_subscriptions
     SET trial_end = $1, status = 'trialing', updated_at = NOW()
     WHERE subscription_id = $2`,
    [newTrialEnd, subscription.subscription_id]
  );

  success(`Trial set to ${days} days!`);
  logger.info('Admin: Trial extended', {
    adminAction: 'extend-trial',
    userId,
    days,
    newTrialEnd
  });
}

async function manageSubscriptions() {
  try {
    await db.connect();

    header('VPA Admin - Manage Subscriptions');

    // Get user email
    const email = await prompt('User email: ');

    const userResult = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      error('User not found!');
      return;
    }

    const user = userResult.rows[0];

    // Get subscription
    const subResult = await db.query(
      'SELECT * FROM user_subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [user.user_id]
    );

    if (subResult.rows.length === 0) {
      error('User has no subscription!');
      return;
    }

    const subscription = subResult.rows[0];

    // Show current subscription
    console.log('\n');
    divider('━', 80);
    console.log(`User: ${user.name} (${user.email})`);
    console.log(`User Status: ${user.status}`);
    console.log();
    console.log(`Plan: ${subscription.plan_name}`);
    console.log(`Price: ${formatCurrency(subscription.price_monthly)}/month`);
    console.log(`Status: ${subscription.status}`);
    console.log(`Modules: ${subscription.modules.join(', ')}`);
    if (subscription.trial_end) {
      console.log(`Trial ends: ${formatDate(subscription.trial_end)}`);
    }
    console.log(`Period: ${formatDate(subscription.current_period_start)} → ${formatDate(subscription.current_period_end)}`);
    if (subscription.stripe_subscription_id) {
      console.log(`Stripe ID: ${subscription.stripe_subscription_id}`);
    }
    divider('━', 80);
    console.log();

    // Show actions
    console.log('Actions:');
    console.log('  [1] Change plan');
    console.log('  [2] Extend period');
    console.log('  [3] Update status');
    console.log('  [4] Extend/modify trial');
    console.log('  [5] Cancel');
    console.log();

    const action = await promptNumber('Select action: ', 1, 5);

    if (action === 5) {
      console.log('\n❌ Cancelled\n');
      return;
    }

    console.log();

    switch (action) {
      case 1:
        await changePlan(user.user_id, subscription);
        break;
      case 2:
        await extendPeriod(user.user_id, subscription);
        break;
      case 3:
        await updateStatus(user.user_id, subscription);
        break;
      case 4:
        await extendTrial(user.user_id, subscription);
        break;
    }

  } catch (err) {
    logError('Failed to manage subscription', err);
    error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  } finally {
    await db.disconnect();
  }
}

// Run the tool
manageSubscriptions();
