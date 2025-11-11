/**
 * Module Access Control
 *
 * Checks if a user has access to a specific module based on their subscription.
 * This is the authorization layer for VPA Core.
 */

import { db } from '../db/client.js';
import { logger, logModuleAccess } from '../utils/logger.js';
import { ModuleNotEnabledError, ModuleNotFoundError } from '../utils/errors.js';
import { MODULE_REGISTRY, getModuleName } from '../modules/registry.js';

/**
 * Check if user has access to a module
 * Returns true/false without throwing
 */
export async function checkModuleAccess(
  userId: string,
  moduleId: string
): Promise<boolean> {
  try {
    // Check if module exists in registry
    if (!MODULE_REGISTRY[moduleId]) {
      logger.warn('Module not found in registry', { moduleId });
      return false;
    }

    // Get user's active subscription
    const result = await db.query(
      `SELECT modules, status
       FROM user_subscriptions
       WHERE user_id = $1
       AND status = 'active'
       AND current_period_end > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      logModuleAccess(userId, moduleId, false, 'No active subscription');
      return false;
    }

    const { modules, status } = result.rows[0];

    // Check if module is in user's enabled modules
    const hasAccess = modules.includes(moduleId);

    logModuleAccess(
      userId,
      moduleId,
      hasAccess,
      hasAccess ? undefined : `Module not in subscription (plan includes: ${modules.join(', ')})`
    );

    return hasAccess;
  } catch (error) {
    logger.error('Module access check failed', { error, userId, moduleId });
    return false;
  }
}

/**
 * Require module access (throws if not authorized)
 * Use this in module wrappers before executing tools
 */
export async function requireModuleAccess(
  userId: string,
  moduleId: string
): Promise<void> {
  // Check if module exists
  if (!MODULE_REGISTRY[moduleId]) {
    throw new ModuleNotFoundError(moduleId);
  }

  // Check access
  const hasAccess = await checkModuleAccess(userId, moduleId);

  if (!hasAccess) {
    const moduleName = getModuleName(moduleId);
    throw new ModuleNotEnabledError(moduleName);
  }
}

/**
 * Get all enabled modules for a user
 */
export async function getEnabledModules(userId: string): Promise<string[]> {
  try {
    const result = await db.query(
      `SELECT modules
       FROM user_subscriptions
       WHERE user_id = $1
       AND status = 'active'
       AND current_period_end > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return [];
    }

    return result.rows[0].modules;
  } catch (error) {
    logger.error('Get enabled modules failed', { error, userId });
    return [];
  }
}

/**
 * Get enabled modules with metadata (for vpa_status tool)
 */
export async function getEnabledModulesWithInfo(userId: string): Promise<Array<{
  id: string;
  name: string;
  enabled: boolean;
  version: string;
  description: string;
}>> {
  const enabledModuleIds = await getEnabledModules(userId);

  return Object.values(MODULE_REGISTRY).map(module => ({
    id: module.id,
    name: module.name,
    enabled: enabledModuleIds.includes(module.id),
    version: module.version,
    description: module.description
  }));
}

/**
 * Check if user can access a specific tool
 */
export async function checkToolAccess(
  userId: string,
  toolName: string
): Promise<{ hasAccess: boolean; moduleId?: string }> {
  // Find which module provides this tool
  const moduleEntry = Object.entries(MODULE_REGISTRY).find(([_, module]) =>
    module.tools.includes(toolName)
  );

  if (!moduleEntry) {
    return { hasAccess: false };
  }

  const [moduleId, _] = moduleEntry;
  const hasAccess = await checkModuleAccess(userId, moduleId);

  return {
    hasAccess,
    moduleId
  };
}

/**
 * Batch check module access (optimization for status checks)
 */
export async function checkMultipleModuleAccess(
  userId: string,
  moduleIds: string[]
): Promise<Record<string, boolean>> {
  const enabledModules = await getEnabledModules(userId);
  const result: Record<string, boolean> = {};

  for (const moduleId of moduleIds) {
    result[moduleId] = enabledModules.includes(moduleId);
  }

  return result;
}

/**
 * Check if user's subscription is valid (any active modules)
 */
export async function hasValidSubscription(userId: string): Promise<boolean> {
  try {
    const result = await db.query(
      `SELECT 1
       FROM user_subscriptions
       WHERE user_id = $1
       AND status = 'active'
       AND current_period_end > NOW()
       LIMIT 1`,
      [userId]
    );

    return result.rows.length > 0;
  } catch (error) {
    logger.error('Subscription check failed', { error, userId });
    return false;
  }
}

/**
 * Get module access summary (for debugging/support)
 */
export async function getModuleAccessSummary(userId: string): Promise<{
  hasSubscription: boolean;
  enabledModules: string[];
  disabledModules: string[];
  requiredModules: string[];
  allModules: string[];
}> {
  const hasSubscription = await hasValidSubscription(userId);
  const enabledModules = await getEnabledModules(userId);
  const allModules = Object.keys(MODULE_REGISTRY);
  const disabledModules = allModules.filter(m => !enabledModules.includes(m));
  const requiredModules = Object.values(MODULE_REGISTRY)
    .filter(m => m.required)
    .map(m => m.id);

  return {
    hasSubscription,
    enabledModules,
    disabledModules,
    requiredModules,
    allModules
  };
}
