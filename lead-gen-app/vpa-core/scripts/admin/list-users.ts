/**
 * Admin Tool: List Users
 *
 * View all users with key information, filter, sort, and export.
 * Usage: npm run admin:list-users
 */

import { db } from '../../src/db/client.js';
import { logger, logError } from '../../src/utils/logger.js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import {
  promptNumber,
  formatCurrency,
  formatDate,
  formatRelativeTime,
  header,
  success,
  error,
  divider,
  printTable,
  exportToCsv
} from './utils.js';

dotenv.config();

interface UserRow {
  email: string;
  name: string;
  plan_name: string;
  status: string;
  modules: string[];
  price_monthly: number;
  usage_count: number;
  created_at: Date;
  trial_end: Date | null;
}

async function listAllUsers() {
  const usersResult = await db.query<UserRow>(`
    SELECT
      u.email,
      u.name,
      u.status,
      u.created_at,
      s.plan_name,
      s.modules,
      s.status as sub_status,
      s.price_monthly,
      s.trial_end,
      COALESCE(usage.count, 0) as usage_count
    FROM users u
    LEFT JOIN user_subscriptions s ON u.user_id = s.user_id
    LEFT JOIN (
      SELECT user_id, COUNT(*) as count
      FROM user_usage
      WHERE timestamp > NOW() - INTERVAL '30 days'
      GROUP BY user_id
    ) usage ON u.user_id = usage.user_id
    ORDER BY u.created_at DESC
  `);

  const users = usersResult.rows;

  header(`VPA Users (Total: ${users.length})`);

  // Calculate totals
  const activeUsers = users.filter(u => u.status === 'active').length;
  const trialingUsers = users.filter(u => u.sub_status === 'trialing').length;
  const totalMRR = users
    .filter(u => u.status === 'active' && u.sub_status === 'active')
    .reduce((sum, u) => sum + (u.price_monthly || 0), 0);

  // Print table
  printTable(
    ['Email', 'Name', 'Plan', 'Status', 'Modules', 'Usage', 'Created'],
    users.map(u => [
      u.email,
      u.name || 'N/A',
      u.plan_name || 'N/A',
      u.sub_status || u.status,
      (u.modules?.length || 0).toString(),
      u.usage_count?.toString() || '0',
      formatRelativeTime(u.created_at)
    ]),
    [30, 20, 15, 10, 8, 7, 15]
  );

  console.log();
  divider();
  console.log(`Total Users:     ${users.length}`);
  console.log(`Active:          ${activeUsers}`);
  console.log(`Trialing:        ${trialingUsers}`);
  console.log(`Total MRR:       ${formatCurrency(totalMRR)}`);
  divider();
  console.log();
}

async function listByStatus(status: string) {
  const usersResult = await db.query<UserRow>(`
    SELECT
      u.email,
      u.name,
      u.status,
      u.created_at,
      s.plan_name,
      s.modules,
      s.status as sub_status,
      s.price_monthly,
      s.trial_end,
      s.current_period_end,
      COALESCE(usage.count, 0) as usage_count
    FROM users u
    LEFT JOIN user_subscriptions s ON u.user_id = s.user_id
    LEFT JOIN (
      SELECT user_id, COUNT(*) as count
      FROM user_usage
      WHERE timestamp > NOW() - INTERVAL '30 days'
      GROUP BY user_id
    ) usage ON u.user_id = usage.user_id
    WHERE s.status = $1
    ORDER BY u.created_at DESC
  `, [status]);

  const users = usersResult.rows;

  header(`Users with status: ${status.toUpperCase()} (${users.length})`);

  if (users.length === 0) {
    console.log('No users found with this status.\n');
    return;
  }

  printTable(
    ['Email', 'Name', 'Plan', 'Price/mo', 'Usage', 'Period End'],
    users.map(u => [
      u.email,
      u.name || 'N/A',
      u.plan_name || 'N/A',
      formatCurrency(u.price_monthly || 0),
      u.usage_count?.toString() || '0',
      formatDate(u.current_period_end)
    ]),
    [30, 20, 15, 12, 7, 15]
  );

  console.log();
}

async function listTrialingUsers() {
  const usersResult = await db.query(`
    SELECT
      u.email,
      u.name,
      s.plan_name,
      s.price_monthly,
      s.trial_end,
      EXTRACT(DAY FROM (s.trial_end - NOW())) as days_remaining,
      u.created_at
    FROM users u
    JOIN user_subscriptions s ON u.user_id = s.user_id
    WHERE s.status = 'trialing' AND s.trial_end > NOW()
    ORDER BY s.trial_end ASC
  `);

  const users = usersResult.rows;

  header(`Trialing Users (${users.length})`);

  if (users.length === 0) {
    console.log('No users currently in trial.\n');
    return;
  }

  printTable(
    ['Email', 'Name', 'Plan', 'Trial Ends', 'Days Left', 'Signed Up'],
    users.map(u => [
      u.email,
      u.name || 'N/A',
      u.plan_name,
      formatDate(u.trial_end),
      Math.ceil(u.days_remaining).toString(),
      formatRelativeTime(u.created_at)
    ]),
    [30, 20, 15, 15, 10, 15]
  );

  console.log();
}

async function listByUsage() {
  const usersResult = await db.query(`
    SELECT
      u.email,
      u.name,
      s.plan_name,
      s.price_monthly,
      COUNT(uu.*) as usage_count,
      COUNT(*) FILTER (WHERE uu.success = false) as error_count,
      MAX(uu.timestamp) as last_activity
    FROM users u
    LEFT JOIN user_subscriptions s ON u.user_id = s.user_id
    LEFT JOIN user_usage uu ON u.user_id = uu.user_id
      AND uu.timestamp > NOW() - INTERVAL '30 days'
    GROUP BY u.user_id, u.email, u.name, s.plan_name, s.price_monthly
    ORDER BY usage_count DESC
  `);

  const users = usersResult.rows;

  header('Users by Usage (Last 30 Days)');

  printTable(
    ['Email', 'Name', 'Plan', 'Commands', 'Errors', 'Last Activity'],
    users.map(u => [
      u.email,
      u.name || 'N/A',
      u.plan_name || 'N/A',
      u.usage_count?.toString() || '0',
      u.error_count?.toString() || '0',
      u.last_activity ? formatRelativeTime(u.last_activity) : 'Never'
    ]),
    [30, 20, 15, 10, 8, 15]
  );

  console.log();
}

async function exportUsers() {
  const usersResult = await db.query(`
    SELECT
      u.user_id,
      u.email,
      u.name,
      u.license_key,
      u.status,
      u.created_at,
      s.plan_name,
      s.modules,
      s.price_monthly,
      s.status as sub_status,
      s.trial_end,
      s.current_period_start,
      s.current_period_end,
      s.stripe_customer_id,
      COALESCE(usage.count, 0) as usage_30d
    FROM users u
    LEFT JOIN user_subscriptions s ON u.user_id = s.user_id
    LEFT JOIN (
      SELECT user_id, COUNT(*) as count
      FROM user_usage
      WHERE timestamp > NOW() - INTERVAL '30 days'
      GROUP BY user_id
    ) usage ON u.user_id = usage.user_id
    ORDER BY u.created_at DESC
  `);

  const filename = `vpa-users-export-${new Date().toISOString().split('T')[0]}.csv`;

  const csv = exportToCsv(
    [
      'User ID',
      'Email',
      'Name',
      'License Key',
      'User Status',
      'Plan',
      'Modules',
      'Price/Month',
      'Sub Status',
      'Trial End',
      'Period Start',
      'Period End',
      'Stripe Customer',
      'Usage (30d)',
      'Created At'
    ],
    usersResult.rows.map(u => [
      u.user_id,
      u.email,
      u.name || '',
      u.license_key,
      u.status,
      u.plan_name || '',
      u.modules?.join(';') || '',
      (u.price_monthly || 0).toString(),
      u.sub_status || '',
      u.trial_end ? new Date(u.trial_end).toISOString() : '',
      u.current_period_start ? new Date(u.current_period_start).toISOString() : '',
      u.current_period_end ? new Date(u.current_period_end).toISOString() : '',
      u.stripe_customer_id || '',
      u.usage_30d?.toString() || '0',
      new Date(u.created_at).toISOString()
    ])
  );

  await fs.writeFile(filename, csv);
  success(`Exported ${usersResult.rows.length} users to ${filename}`);
  console.log();
}

async function listUsers() {
  try {
    await db.connect();

    header('VPA Admin - List Users');

    console.log('Options:');
    console.log('  [1] All users');
    console.log('  [2] Active users only');
    console.log('  [3] Trialing users');
    console.log('  [4] Cancelled users');
    console.log('  [5] Users by usage (sorted)');
    console.log('  [6] Export to CSV');
    console.log();

    const choice = await promptNumber('Select option: ', 1, 6);

    console.log();

    switch (choice) {
      case 1:
        await listAllUsers();
        break;
      case 2:
        await listByStatus('active');
        break;
      case 3:
        await listTrialingUsers();
        break;
      case 4:
        await listByStatus('cancelled');
        break;
      case 5:
        await listByUsage();
        break;
      case 6:
        await exportUsers();
        break;
    }

  } catch (err) {
    logError('Failed to list users', err);
    error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  } finally {
    await db.disconnect();
  }
}

// Run the tool
listUsers();
