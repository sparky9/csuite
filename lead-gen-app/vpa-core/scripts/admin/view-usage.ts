/**
 * Admin Tool: View Usage Analytics
 *
 * Analytics dashboard for user activity, module usage, and error tracking.
 * Usage: npm run admin:view-usage
 */

import { db } from '../../src/db/client.js';
import { logger, logError } from '../../src/utils/logger.js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import {
  prompt,
  promptNumber,
  formatDate,
  formatRelativeTime,
  header,
  success,
  error,
  divider,
  printTable,
  exportToCsv,
  percentage
} from './utils.js';

dotenv.config();

async function viewAllUsersSummary() {
  header('All Users Summary - Last 30 Days');

  // Get total stats
  const statsResult = await db.query(`
    SELECT
      COUNT(DISTINCT uu.user_id) as active_users,
      COUNT(*) as total_commands,
      COUNT(*) FILTER (WHERE uu.success = false) as failed_commands,
      AVG(uu.execution_time_ms) as avg_execution_time
    FROM user_usage uu
    WHERE uu.timestamp > NOW() - INTERVAL '30 days'
  `);

  const stats = statsResult.rows[0];

  console.log(`Total Commands:    ${stats.total_commands}`);
  console.log(`Active Users:      ${stats.active_users}`);
  console.log(`Failed Commands:   ${stats.failed_commands} (${percentage(stats.failed_commands, stats.total_commands)})`);
  console.log(`Avg Execution:     ${Math.round(stats.avg_execution_time)}ms`);
  console.log();

  // Top users by activity
  const topUsersResult = await db.query(`
    SELECT
      u.email,
      u.name,
      COUNT(*) as command_count,
      COUNT(*) FILTER (WHERE uu.success = false) as errors
    FROM user_usage uu
    JOIN users u ON uu.user_id = u.user_id
    WHERE uu.timestamp > NOW() - INTERVAL '30 days'
    GROUP BY u.user_id, u.email, u.name
    ORDER BY command_count DESC
    LIMIT 10
  `);

  console.log('Top 10 Users by Activity:');
  divider();
  printTable(
    ['Email', 'Name', 'Commands', 'Errors', '% of Total'],
    topUsersResult.rows.map(row => [
      row.email,
      row.name || 'N/A',
      row.command_count.toString(),
      row.errors.toString(),
      percentage(row.command_count, stats.total_commands)
    ]),
    [30, 20, 10, 8, 10]
  );
  console.log();

  // Module breakdown
  const modulesResult = await db.query(`
    SELECT
      module_id,
      COUNT(*) as command_count,
      COUNT(*) FILTER (WHERE success = false) as errors
    FROM user_usage
    WHERE timestamp > NOW() - INTERVAL '30 days'
    GROUP BY module_id
    ORDER BY command_count DESC
  `);

  console.log('Module Usage Breakdown:');
  divider();
  printTable(
    ['Module', 'Commands', 'Errors', '% of Total'],
    modulesResult.rows.map(row => [
      row.module_id,
      row.command_count.toString(),
      row.errors.toString(),
      percentage(row.command_count, stats.total_commands)
    ]),
    [25, 10, 8, 10]
  );
  console.log();
}

async function viewSpecificUser() {
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

  header(`Usage Details: ${user.name} (${user.email})`);

  // User stats
  const statsResult = await db.query(`
    SELECT
      COUNT(*) as total_commands,
      COUNT(*) FILTER (WHERE success = false) as failed_commands,
      AVG(execution_time_ms) as avg_execution_time,
      MIN(timestamp) as first_activity,
      MAX(timestamp) as last_activity
    FROM user_usage
    WHERE user_id = $1
  `, [user.user_id]);

  const stats = statsResult.rows[0];

  console.log(`Total Commands:    ${stats.total_commands}`);
  console.log(`Failed Commands:   ${stats.failed_commands} (${percentage(stats.failed_commands, stats.total_commands)})`);
  console.log(`Avg Execution:     ${Math.round(stats.avg_execution_time)}ms`);
  console.log(`First Activity:    ${formatDate(stats.first_activity)} (${formatRelativeTime(stats.first_activity)})`);
  console.log(`Last Activity:     ${formatDate(stats.last_activity)} (${formatRelativeTime(stats.last_activity)})`);
  console.log();

  // Module usage
  const moduleUsageResult = await db.query(`
    SELECT
      module_id,
      COUNT(*) as command_count,
      COUNT(*) FILTER (WHERE success = false) as errors,
      AVG(execution_time_ms) as avg_time
    FROM user_usage
    WHERE user_id = $1
    GROUP BY module_id
    ORDER BY command_count DESC
  `, [user.user_id]);

  console.log('Module Usage:');
  divider();
  printTable(
    ['Module', 'Commands', 'Errors', 'Avg Time'],
    moduleUsageResult.rows.map(row => [
      row.module_id,
      row.command_count.toString(),
      row.errors.toString(),
      `${Math.round(row.avg_time)}ms`
    ]),
    [25, 10, 8, 12]
  );
  console.log();

  // Recent activity
  const recentResult = await db.query(`
    SELECT
      module_id,
      tool_name,
      success,
      timestamp,
      execution_time_ms
    FROM user_usage
    WHERE user_id = $1
    ORDER BY timestamp DESC
    LIMIT 20
  `, [user.user_id]);

  console.log('Recent Activity (Last 20):');
  divider();
  printTable(
    ['Module', 'Tool', 'Status', 'Time', 'Duration'],
    recentResult.rows.map(row => [
      row.module_id,
      row.tool_name,
      row.success ? '✓' : '✗',
      formatRelativeTime(row.timestamp),
      `${row.execution_time_ms}ms`
    ]),
    [20, 20, 8, 15, 10]
  );
  console.log();
}

async function viewModuleBreakdown() {
  header('Module Usage Breakdown - Last 30 Days');

  const modulesResult = await db.query(`
    SELECT
      module_id,
      tool_name,
      COUNT(*) as command_count,
      COUNT(*) FILTER (WHERE success = false) as errors,
      AVG(execution_time_ms) as avg_time,
      COUNT(DISTINCT user_id) as unique_users
    FROM user_usage
    WHERE timestamp > NOW() - INTERVAL '30 days'
    GROUP BY module_id, tool_name
    ORDER BY module_id, command_count DESC
  `);

  let currentModule = '';

  modulesResult.rows.forEach(row => {
    if (row.module_id !== currentModule) {
      currentModule = row.module_id;
      console.log();
      divider();
      console.log(`📦 ${currentModule.toUpperCase()}`);
      divider();
      console.log();
    }

    console.log(`  ${row.tool_name.padEnd(30)} ${row.command_count.toString().padStart(6)} calls  ${row.unique_users.toString().padStart(3)} users  ${Math.round(row.avg_time).toString().padStart(5)}ms avg  ${row.errors > 0 ? `⚠️  ${row.errors} errors` : ''}`);
  });

  console.log();
}

async function viewLast24Hours() {
  header('Activity - Last 24 Hours');

  const statsResult = await db.query(`
    SELECT
      COUNT(*) as total_commands,
      COUNT(DISTINCT user_id) as active_users,
      COUNT(*) FILTER (WHERE success = false) as failed_commands,
      AVG(execution_time_ms) as avg_execution_time
    FROM user_usage
    WHERE timestamp > NOW() - INTERVAL '24 hours'
  `);

  const stats = statsResult.rows[0];

  console.log(`Total Commands:    ${stats.total_commands}`);
  console.log(`Active Users:      ${stats.active_users}`);
  console.log(`Failed Commands:   ${stats.failed_commands} (${percentage(stats.failed_commands, stats.total_commands)})`);
  console.log(`Avg Execution:     ${Math.round(stats.avg_execution_time)}ms`);
  console.log();

  // Hourly breakdown
  const hourlyResult = await db.query(`
    SELECT
      DATE_TRUNC('hour', timestamp) as hour,
      COUNT(*) as command_count,
      COUNT(*) FILTER (WHERE success = false) as errors
    FROM user_usage
    WHERE timestamp > NOW() - INTERVAL '24 hours'
    GROUP BY hour
    ORDER BY hour DESC
  `);

  console.log('Hourly Breakdown:');
  divider();
  printTable(
    ['Hour', 'Commands', 'Errors'],
    hourlyResult.rows.map(row => [
      new Date(row.hour).toLocaleString(),
      row.command_count.toString(),
      row.errors.toString()
    ]),
    [25, 12, 10]
  );
  console.log();
}

async function exportToCSV() {
  const filename = `vpa-usage-export-${new Date().toISOString().split('T')[0]}.csv`;

  const usageResult = await db.query(`
    SELECT
      u.email,
      u.name,
      uu.module_id,
      uu.tool_name,
      uu.success,
      uu.execution_time_ms,
      uu.timestamp
    FROM user_usage uu
    JOIN users u ON uu.user_id = u.user_id
    WHERE uu.timestamp > NOW() - INTERVAL '30 days'
    ORDER BY uu.timestamp DESC
  `);

  const csv = exportToCsv(
    ['Email', 'Name', 'Module', 'Tool', 'Success', 'Execution Time (ms)', 'Timestamp'],
    usageResult.rows.map(row => [
      row.email,
      row.name || '',
      row.module_id,
      row.tool_name,
      row.success ? 'true' : 'false',
      row.execution_time_ms?.toString() || '',
      row.timestamp.toISOString()
    ])
  );

  await fs.writeFile(filename, csv);
  success(`Exported to ${filename}`);
  console.log(`Total rows: ${usageResult.rows.length}`);
  console.log();
}

async function viewUsage() {
  try {
    await db.connect();

    header('VPA Admin - Usage Analytics');

    console.log('Options:');
    console.log('  [1] All users summary');
    console.log('  [2] Specific user details');
    console.log('  [3] Module usage breakdown');
    console.log('  [4] Last 24 hours activity');
    console.log('  [5] Export to CSV');
    console.log();

    const choice = await promptNumber('Select option: ', 1, 5);

    console.log();

    switch (choice) {
      case 1:
        await viewAllUsersSummary();
        break;
      case 2:
        await viewSpecificUser();
        break;
      case 3:
        await viewModuleBreakdown();
        break;
      case 4:
        await viewLast24Hours();
        break;
      case 5:
        await exportToCSV();
        break;
    }

  } catch (err) {
    logError('Failed to view usage', err);
    error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  } finally {
    await db.disconnect();
  }
}

// Run the tool
viewUsage();
