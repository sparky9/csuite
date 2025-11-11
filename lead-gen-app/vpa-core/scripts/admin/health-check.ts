/**
 * Admin Tool: Health Check
 *
 * System health diagnostics and monitoring.
 * Usage: npm run admin:health
 */

import { db } from '../../src/db/client.js';
import { logger, logError } from '../../src/utils/logger.js';
import dotenv from 'dotenv';
import {
  header,
  success,
  error,
  warning,
  divider,
  formatDate
} from './utils.js';

dotenv.config();

interface HealthCheck {
  name: string;
  status: 'healthy' | 'warning' | 'error';
  message: string;
  details?: any;
}

const checks: HealthCheck[] = [];

async function checkDatabase(): Promise<HealthCheck> {
  try {
    await db.connect();
    const result = await db.query('SELECT NOW() as current_time');
    const serverTime = result.rows[0].current_time;

    return {
      name: 'Database Connection',
      status: 'healthy',
      message: 'Database connected successfully',
      details: {
        serverTime: formatDate(serverTime),
        database: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'Unknown'
      }
    };
  } catch (err) {
    return {
      name: 'Database Connection',
      status: 'error',
      message: 'Failed to connect to database',
      details: {
        error: err instanceof Error ? err.message : String(err)
      }
    };
  }
}

async function checkTables(): Promise<HealthCheck> {
  try {
    const tablesResult = await db.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    const requiredTables = [
      'users',
      'user_subscriptions',
      'user_usage',
      'user_module_config'
    ];

    const existingTables = tablesResult.rows.map((r: any) => r.table_name);
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));

    if (missingTables.length > 0) {
      return {
        name: 'Database Tables',
        status: 'error',
        message: `Missing required tables: ${missingTables.join(', ')}`,
        details: {
          required: requiredTables,
          existing: existingTables,
          missing: missingTables
        }
      };
    }

    return {
      name: 'Database Tables',
      status: 'healthy',
      message: 'All required tables exist',
      details: {
        tableCount: existingTables.length,
        tables: existingTables
      }
    };
  } catch (err) {
    return {
      name: 'Database Tables',
      status: 'error',
      message: 'Failed to check tables',
      details: {
        error: err instanceof Error ? err.message : String(err)
      }
    };
  }
}

async function checkDataIntegrity(): Promise<HealthCheck> {
  try {
    // Check for users without subscriptions
    const usersWithoutSubsResult = await db.query(`
      SELECT COUNT(*) as count
      FROM users u
      LEFT JOIN user_subscriptions s ON u.user_id = s.user_id
      WHERE s.subscription_id IS NULL AND u.status = 'active'
    `);

    const usersWithoutSubs = parseInt(usersWithoutSubsResult.rows[0].count);

    // Check for expired trials not marked as expired
    const expiredTrialsResult = await db.query(`
      SELECT COUNT(*) as count
      FROM user_subscriptions
      WHERE status = 'trialing' AND trial_end < NOW()
    `);

    const expiredTrials = parseInt(expiredTrialsResult.rows[0].count);

    // Check for expired periods
    const expiredPeriodsResult = await db.query(`
      SELECT COUNT(*) as count
      FROM user_subscriptions
      WHERE status = 'active' AND current_period_end < NOW()
    `);

    const expiredPeriods = parseInt(expiredPeriodsResult.rows[0].count);

    const issues = [];
    if (usersWithoutSubs > 0) issues.push(`${usersWithoutSubs} active users without subscriptions`);
    if (expiredTrials > 0) issues.push(`${expiredTrials} expired trials still marked as trialing`);
    if (expiredPeriods > 0) issues.push(`${expiredPeriods} subscriptions past period end`);

    if (issues.length > 0) {
      return {
        name: 'Data Integrity',
        status: 'warning',
        message: `Found ${issues.length} data integrity issue(s)`,
        details: { issues }
      };
    }

    return {
      name: 'Data Integrity',
      status: 'healthy',
      message: 'No data integrity issues found',
      details: {
        usersChecked: true,
        trialsChecked: true,
        periodsChecked: true
      }
    };
  } catch (err) {
    return {
      name: 'Data Integrity',
      status: 'error',
      message: 'Failed to check data integrity',
      details: {
        error: err instanceof Error ? err.message : String(err)
      }
    };
  }
}

async function checkUsageStats(): Promise<HealthCheck> {
  try {
    const statsResult = await db.query(`
      SELECT
        COUNT(*) as total_records,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '24 hours') as last_24h,
        COUNT(*) FILTER (WHERE success = false) as total_errors
      FROM user_usage
    `);

    const stats = statsResult.rows[0];

    return {
      name: 'Usage Tracking',
      status: 'healthy',
      message: 'Usage tracking operational',
      details: {
        totalRecords: parseInt(stats.total_records),
        uniqueUsers: parseInt(stats.unique_users),
        last24Hours: parseInt(stats.last_24h),
        totalErrors: parseInt(stats.total_errors)
      }
    };
  } catch (err) {
    return {
      name: 'Usage Tracking',
      status: 'error',
      message: 'Failed to check usage stats',
      details: {
        error: err instanceof Error ? err.message : String(err)
      }
    };
  }
}

async function checkEnvironment(): Promise<HealthCheck> {
  const requiredVars = [
    'DATABASE_URL',
    'NODE_ENV'
  ];

  const missing = requiredVars.filter(v => !process.env[v]);

  if (missing.length > 0) {
    return {
      name: 'Environment Variables',
      status: 'warning',
      message: `Missing environment variables: ${missing.join(', ')}`,
      details: {
        required: requiredVars,
        missing
      }
    };
  }

  return {
    name: 'Environment Variables',
    status: 'healthy',
    message: 'All required environment variables set',
    details: {
      nodeEnv: process.env.NODE_ENV,
      logLevel: process.env.LOG_LEVEL || 'info'
    }
  };
}

async function getSystemStats(): Promise<any> {
  try {
    const [userStats, subStats, usageStats] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'active') as active,
          COUNT(*) FILTER (WHERE status = 'suspended') as suspended,
          COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
        FROM users
      `),
      db.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'active') as active,
          COUNT(*) FILTER (WHERE status = 'trialing') as trialing,
          COUNT(*) FILTER (WHERE status = 'past_due') as past_due,
          COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
          SUM(price_monthly) FILTER (WHERE status = 'active') as mrr
        FROM user_subscriptions
      `),
      db.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '24 hours') as last_24h,
          COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '7 days') as last_7d,
          COUNT(*) FILTER (WHERE success = false) as errors
        FROM user_usage
      `)
    ]);

    return {
      users: userStats.rows[0],
      subscriptions: subStats.rows[0],
      usage: usageStats.rows[0]
    };
  } catch (err) {
    return null;
  }
}

async function runHealthCheck() {
  try {
    header('VPA Core - System Health Check');

    console.log('Running diagnostics...\n');

    // Run all checks
    checks.push(checkEnvironment());
    checks.push(await checkDatabase());
    checks.push(await checkTables());
    checks.push(await checkDataIntegrity());
    checks.push(await checkUsageStats());

    // Wait for environment check
    const resolvedChecks = await Promise.all(checks);

    // Print results
    divider();
    console.log('Health Check Results:');
    divider();
    console.log();

    let healthyCount = 0;
    let warningCount = 0;
    let errorCount = 0;

    resolvedChecks.forEach(check => {
      const icon = check.status === 'healthy' ? '✓' : check.status === 'warning' ? '⚠' : '✗';
      const color = check.status === 'healthy' ? '\x1b[32m' : check.status === 'warning' ? '\x1b[33m' : '\x1b[31m';
      const reset = '\x1b[0m';

      console.log(`${color}${icon}${reset} ${check.name.padEnd(25)} ${check.message}`);

      if (check.details && Object.keys(check.details).length > 0) {
        Object.entries(check.details).forEach(([key, value]) => {
          console.log(`  ${key}: ${JSON.stringify(value)}`);
        });
      }

      console.log();

      if (check.status === 'healthy') healthyCount++;
      else if (check.status === 'warning') warningCount++;
      else errorCount++;
    });

    // System statistics
    const stats = await getSystemStats();

    if (stats) {
      divider();
      console.log('System Statistics:');
      divider();
      console.log();

      console.log('Users:');
      console.log(`  Total:      ${stats.users.total}`);
      console.log(`  Active:     ${stats.users.active}`);
      console.log(`  Suspended:  ${stats.users.suspended}`);
      console.log(`  Cancelled:  ${stats.users.cancelled}`);
      console.log();

      console.log('Subscriptions:');
      console.log(`  Total:      ${stats.subscriptions.total}`);
      console.log(`  Active:     ${stats.subscriptions.active}`);
      console.log(`  Trialing:   ${stats.subscriptions.trialing}`);
      console.log(`  Past Due:   ${stats.subscriptions.past_due}`);
      console.log(`  MRR:        $${((stats.subscriptions.mrr || 0) / 100).toFixed(2)}`);
      console.log();

      console.log('Usage:');
      console.log(`  Total:      ${stats.usage.total}`);
      console.log(`  Last 24h:   ${stats.usage.last_24h}`);
      console.log(`  Last 7d:    ${stats.usage.last_7d}`);
      console.log(`  Errors:     ${stats.usage.errors}`);
      console.log();
    }

    // Overall status
    divider();
    console.log('Overall Status:');
    divider();
    console.log();

    console.log(`✓ Healthy:   ${healthyCount}`);
    console.log(`⚠ Warnings:  ${warningCount}`);
    console.log(`✗ Errors:    ${errorCount}`);
    console.log();

    if (errorCount === 0 && warningCount === 0) {
      success('System is healthy! All checks passed.');
    } else if (errorCount > 0) {
      error(`System has ${errorCount} critical error(s). Please address immediately.`);
    } else {
      warning(`System has ${warningCount} warning(s). Review recommended.`);
    }

    // Log health check
    logger.info('Admin: Health check completed', {
      adminAction: 'health-check',
      healthy: healthyCount,
      warnings: warningCount,
      errors: errorCount
    });

  } catch (err) {
    logError('Health check failed', err);
    error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  } finally {
    await db.disconnect();
  }
}

// Run the tool
runHealthCheck();
