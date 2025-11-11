/**
 * Admin Tool: Create User
 *
 * Interactive CLI to create new VPA users with license keys and subscriptions.
 * Usage: npm run admin:create-user
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
  generateLicenseKey,
  formatCurrency,
  formatDate,
  header,
  success,
  error,
  divider
} from './utils.js';

dotenv.config();

interface UserData {
  email: string;
  name: string;
  licenseKey: string;
  planId: string;
  trialDays: number;
}

async function createUser() {
  try {
    // Connect to database
    await db.connect();

    header('VPA Admin - Create New User');

    // Get user details
    let email: string;
    while (true) {
      email = await prompt('Email: ');
      if (!isValidEmail(email)) {
        error('Invalid email format. Please try again.');
        continue;
      }

      // Check if email already exists
      const existing = await db.query(
        'SELECT user_id FROM users WHERE email = $1',
        [email]
      );

      if (existing.rows.length > 0) {
        error('User with this email already exists!');
        continue;
      }

      break;
    }

    const name = await prompt('Name: ');

    // Show plan options
    console.log('\nAvailable Plans:');
    PRICING_PLANS.forEach((plan, idx) => {
      const recommended = plan.recommended ? ' ⭐ RECOMMENDED' : '';
      console.log(`  [${idx + 1}] ${plan.displayName} - ${formatCurrency(plan.priceMonthly)}/month${recommended}`);
      console.log(`      Modules: ${plan.modules.join(', ')}`);
      if (plan.limits) {
        const limits = [];
        if (plan.limits.monthlyProspects) limits.push(`${plan.limits.monthlyProspects} prospects/mo`);
        if (plan.limits.monthlyCampaigns) limits.push(`${plan.limits.monthlyCampaigns} campaigns/mo`);
        if (plan.limits.monthlyEmails) limits.push(`${plan.limits.monthlyEmails} emails/mo`);
        if (limits.length > 0) {
          console.log(`      Limits: ${limits.join(', ')}`);
        }
      }
      console.log();
    });

    const planChoice = await promptNumber('Select plan (1-4): ', 1, PRICING_PLANS.length);
    const selectedPlan = PRICING_PLANS[planChoice - 1];

    const trialDays = await promptNumber('Trial days (0 for no trial): ', 0);

    // Generate license key
    const licenseKey = generateLicenseKey();

    // Calculate dates
    const now = new Date();
    const trialEnd = trialDays > 0 ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000) : null;
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Show summary
    console.log('\n');
    divider();
    console.log('Review Details:');
    divider();
    console.log(`Email:        ${email}`);
    console.log(`Name:         ${name}`);
    console.log(`License Key:  ${licenseKey}`);
    console.log(`Plan:         ${selectedPlan.displayName}`);
    console.log(`Price:        ${formatCurrency(selectedPlan.priceMonthly)}/month`);
    console.log(`Modules:      ${selectedPlan.modules.join(', ')}`);
    if (trialEnd) {
      console.log(`Trial ends:   ${formatDate(trialEnd)}`);
    }
    console.log(`Period ends:  ${formatDate(periodEnd)}`);
    divider();
    console.log();

    const confirmed = await confirm('Create this user?');
    if (!confirmed) {
      console.log('\n❌ User creation cancelled\n');
      return;
    }

    // Begin transaction
    await db.query('BEGIN');

    try {
      // Create user
      const userResult = await db.query(
        `INSERT INTO users (email, name, license_key, status)
         VALUES ($1, $2, $3, 'active')
         RETURNING user_id`,
        [email, name, licenseKey]
      );

      const userId = userResult.rows[0].user_id;

      // Create subscription
      await db.query(
        `INSERT INTO user_subscriptions (
          user_id, plan_name, modules, price_monthly, status,
          trial_end, current_period_start, current_period_end
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId,
          selectedPlan.id,
          selectedPlan.modules,
          selectedPlan.priceMonthly,
          trialEnd ? 'trialing' : 'active',
          trialEnd,
          now,
          periodEnd
        ]
      );

      await db.query('COMMIT');

      // Success output
      success('User created successfully!');
      console.log();
      divider('━', 80);
      console.log(`📧 Email:        ${email}`);
      console.log(`👤 Name:         ${name}`);
      console.log(`🔑 License Key:  ${licenseKey}`);
      console.log(`📦 Plan:         ${selectedPlan.displayName}`);
      console.log(`💰 Price:        ${formatCurrency(selectedPlan.priceMonthly)}/month`);
      console.log(`🧩 Modules:      ${selectedPlan.modules.join(', ')}`);
      if (trialEnd) {
        console.log(`⏰ Trial ends:   ${formatDate(trialEnd)}`);
      }
      console.log(`📅 Period ends:  ${formatDate(periodEnd)}`);
      divider('━', 80);
      console.log();
      console.log('📧 Send the license key to the customer for VPA setup');
      console.log();

      // Log admin action
      logger.info('Admin: User created', {
        adminAction: 'create-user',
        userId,
        email,
        planId: selectedPlan.id,
        trialDays
      });

    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    }

  } catch (err) {
    logError('Failed to create user', err);
    error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  } finally {
    await db.disconnect();
  }
}

// Run the tool
createUser();
