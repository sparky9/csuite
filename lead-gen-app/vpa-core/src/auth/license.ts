/**
 * License Key Validation
 *
 * Validates user license keys against the database and returns user context.
 * This is the primary authentication mechanism for VPA Core.
 */

import { db } from '../db/client.js';
import { logger, logLicenseValidation } from '../utils/logger.js';
import {
  InvalidLicenseError,
  LicenseExpiredError,
  AccountSuspendedError
} from '../utils/errors.js';

export interface User {
  userId: string;
  email: string;
  name: string | null;
  licenseKey: string;
  status: string;
  modules: string[]; // Enabled modules from subscription
  planName: string;
  subscriptionStatus: string;
  currentPeriodEnd: Date;
  metadata?: Record<string, any>;
}

/**
 * Validate a license key and return user information
 */
export async function validateLicenseKey(licenseKey: string): Promise<User> {
  if (!licenseKey || licenseKey.trim().length === 0) {
    throw new InvalidLicenseError();
  }

  try {
    const result = await db.query(
      `SELECT
         u.user_id,
         u.email,
         u.name,
         u.license_key,
         u.status as user_status,
         u.metadata,
         s.plan_name,
         s.modules,
         s.status as subscription_status,
         s.current_period_end
       FROM users u
       JOIN user_subscriptions s ON u.user_id = s.user_id
       WHERE u.license_key = $1
       AND s.status = 'active'
       AND s.current_period_end > NOW()
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [licenseKey]
    );

    if (result.rows.length === 0) {
      logLicenseValidation(licenseKey, false, undefined, 'License key not found or subscription inactive');
      throw new InvalidLicenseError();
    }

    const row = result.rows[0];

    // Check user account status
    if (row.user_status !== 'active') {
      logLicenseValidation(licenseKey, false, row.user_id, `Account status: ${row.user_status}`);
      throw new AccountSuspendedError(row.user_status);
    }

    // Check subscription status
    if (row.subscription_status !== 'active') {
      logLicenseValidation(licenseKey, false, row.user_id, `Subscription status: ${row.subscription_status}`);
      throw new LicenseExpiredError(row.subscription_status);
    }

    // Check if subscription has expired
    const currentPeriodEnd = new Date(row.current_period_end);
    if (currentPeriodEnd < new Date()) {
      logLicenseValidation(licenseKey, false, row.user_id, 'Subscription period ended');
      throw new LicenseExpiredError('Subscription period ended');
    }

    const user: User = {
      userId: row.user_id,
      email: row.email,
      name: row.name,
      licenseKey: row.license_key,
      status: row.user_status,
      modules: row.modules, // Array of module IDs
      planName: row.plan_name,
      subscriptionStatus: row.subscription_status,
      currentPeriodEnd: currentPeriodEnd,
      metadata: row.metadata
    };

    logLicenseValidation(licenseKey, true, user.userId);
    logger.info('User authenticated', {
      userId: user.userId,
      email: user.email,
      plan: user.planName,
      modules: user.modules
    });

    return user;
  } catch (error) {
    if (error instanceof InvalidLicenseError ||
        error instanceof LicenseExpiredError ||
        error instanceof AccountSuspendedError) {
      throw error;
    }

    logger.error('License validation error', { error, licenseKey: licenseKey.substring(0, 8) + '...' });
    throw new InvalidLicenseError();
  }
}

/**
 * Get user by ID (for internal use)
 */
export async function getUserById(userId: string): Promise<User | null> {
  try {
    const result = await db.query(
      `SELECT
         u.user_id,
         u.email,
         u.name,
         u.license_key,
         u.status as user_status,
         u.metadata,
         s.plan_name,
         s.modules,
         s.status as subscription_status,
         s.current_period_end
       FROM users u
       JOIN user_subscriptions s ON u.user_id = s.user_id
       WHERE u.user_id = $1
       AND s.status = 'active'
       AND s.current_period_end > NOW()
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    return {
      userId: row.user_id,
      email: row.email,
      name: row.name,
      licenseKey: row.license_key,
      status: row.user_status,
      modules: row.modules,
      planName: row.plan_name,
      subscriptionStatus: row.subscription_status,
      currentPeriodEnd: new Date(row.current_period_end),
      metadata: row.metadata
    };
  } catch (error) {
    logger.error('Get user by ID failed', { error, userId });
    return null;
  }
}

/**
 * Check if a license key exists (without full validation)
 */
export async function licenseKeyExists(licenseKey: string): Promise<boolean> {
  try {
    const result = await db.query(
      'SELECT 1 FROM users WHERE license_key = $1',
      [licenseKey]
    );
    return result.rows.length > 0;
  } catch (error) {
    logger.error('License key check failed', { error });
    return false;
  }
}

/**
 * Refresh user data (for long-running sessions)
 */
export async function refreshUser(userId: string): Promise<User> {
  const user = await getUserById(userId);
  if (!user) {
    throw new LicenseExpiredError('User session expired');
  }
  return user;
}

/**
 * Get subscription expiry info
 */
export async function getSubscriptionInfo(userId: string): Promise<{
  planName: string;
  status: string;
  currentPeriodEnd: Date;
  daysRemaining: number;
  modules: string[];
}> {
  const result = await db.query(
    `SELECT
       plan_name,
       status,
       current_period_end,
       modules
     FROM user_subscriptions
     WHERE user_id = $1
     AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw new LicenseExpiredError('No active subscription');
  }

  const row = result.rows[0];
  const currentPeriodEnd = new Date(row.current_period_end);
  const daysRemaining = Math.ceil((currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return {
    planName: row.plan_name,
    status: row.status,
    currentPeriodEnd,
    daysRemaining,
    modules: row.modules
  };
}
