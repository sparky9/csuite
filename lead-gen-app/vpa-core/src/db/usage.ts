/**
 * Usage Tracking
 *
 * Track all VPA tool executions for analytics and usage-based billing.
 * Every module call is logged to the user_usage table.
 */

import { db } from './client.js';
import { logger, logError } from '../utils/logger.js';

export interface UsageRecord {
  userId: string;
  moduleId: string;
  toolName: string;
  commandText?: string;
  success: boolean;
  errorMessage?: string;
  executionTimeMs?: number;
  metadata?: Record<string, any>;
}

/**
 * Track a single tool execution
 */
export async function trackUsage(record: UsageRecord): Promise<void> {
  try {
    await db.query(
      `INSERT INTO user_usage
       (user_id, module_id, tool_name, command_text, success, error_message, execution_time_ms, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        record.userId,
        record.moduleId,
        record.toolName,
        record.commandText || null,
        record.success,
        record.errorMessage || null,
        record.executionTimeMs || null,
        record.metadata ? JSON.stringify(record.metadata) : '{}'
      ]
    );

    logger.debug('Usage tracked', {
      userId: record.userId,
      moduleId: record.moduleId,
      toolName: record.toolName,
      success: record.success
    });
  } catch (error) {
    // Don't throw - usage tracking failure shouldn't break tool execution
    logError('Failed to track usage', error, { record });
  }
}

/**
 * Get usage statistics for a user
 */
export async function getUserUsageStats(
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  byModule: Record<string, number>;
  byTool: Record<string, number>;
}> {
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: 30 days ago
  const end = endDate || new Date();

  const result = await db.query(
    `SELECT
       COUNT(*) as total_calls,
       COUNT(*) FILTER (WHERE success = true) as successful_calls,
       COUNT(*) FILTER (WHERE success = false) as failed_calls,
       module_id,
       tool_name
     FROM user_usage
     WHERE user_id = $1
       AND timestamp >= $2
       AND timestamp <= $3
     GROUP BY module_id, tool_name`,
    [userId, start, end]
  );

  const byModule: Record<string, number> = {};
  const byTool: Record<string, number> = {};

  for (const row of result.rows) {
    byModule[row.module_id] = (byModule[row.module_id] || 0) + parseInt(row.total_calls);
    byTool[row.tool_name] = (byTool[row.tool_name] || 0) + parseInt(row.total_calls);
  }

  // Get totals
  const totals = await db.query(
    `SELECT
       COUNT(*) as total_calls,
       COUNT(*) FILTER (WHERE success = true) as successful_calls,
       COUNT(*) FILTER (WHERE success = false) as failed_calls
     FROM user_usage
     WHERE user_id = $1
       AND timestamp >= $2
       AND timestamp <= $3`,
    [userId, start, end]
  );

  const totalRow = totals.rows[0];

  return {
    totalCalls: parseInt(totalRow.total_calls) || 0,
    successfulCalls: parseInt(totalRow.successful_calls) || 0,
    failedCalls: parseInt(totalRow.failed_calls) || 0,
    byModule,
    byTool
  };
}

/**
 * Check if user has exceeded usage quota (for usage-based billing)
 */
export async function checkUsageQuota(
  userId: string,
  moduleId: string,
  quotaLimit: number,
  periodDays: number = 30
): Promise<{ exceeded: boolean; current: number; limit: number }> {
  const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  const result = await db.query(
    `SELECT COUNT(*) as usage_count
     FROM user_usage
     WHERE user_id = $1
       AND module_id = $2
       AND timestamp >= $3
       AND success = true`,
    [userId, moduleId, startDate]
  );

  const current = parseInt(result.rows[0].usage_count) || 0;

  return {
    exceeded: current >= quotaLimit,
    current,
    limit: quotaLimit
  };
}

/**
 * Get recent usage for a user (for debugging/support)
 */
export async function getRecentUsage(
  userId: string,
  limit: number = 50
): Promise<Array<{
  timestamp: Date;
  moduleId: string;
  toolName: string;
  success: boolean;
  errorMessage?: string;
  executionTimeMs?: number;
}>> {
  const result = await db.query(
    `SELECT
       timestamp,
       module_id,
       tool_name,
       success,
       error_message,
       execution_time_ms
     FROM user_usage
     WHERE user_id = $1
     ORDER BY timestamp DESC
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows.map(row => ({
    timestamp: row.timestamp,
    moduleId: row.module_id,
    toolName: row.tool_name,
    success: row.success,
    errorMessage: row.error_message,
    executionTimeMs: row.execution_time_ms
  }));
}

/**
 * Get usage analytics across all users (admin only)
 */
export async function getGlobalUsageStats(
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalUsers: number;
  totalCalls: number;
  activeUsers: number;
  byModule: Record<string, number>;
  errorRate: number;
}> {
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate || new Date();

  const stats = await db.query(
    `SELECT
       COUNT(DISTINCT user_id) as total_users,
       COUNT(*) as total_calls,
       COUNT(DISTINCT user_id) FILTER (WHERE timestamp >= NOW() - INTERVAL '7 days') as active_users,
       COUNT(*) FILTER (WHERE success = false) as failed_calls,
       module_id
     FROM user_usage
     WHERE timestamp >= $1 AND timestamp <= $2
     GROUP BY module_id`,
    [start, end]
  );

  const byModule: Record<string, number> = {};
  let totalCalls = 0;
  let failedCalls = 0;

  for (const row of stats.rows) {
    byModule[row.module_id] = parseInt(row.total_calls);
    totalCalls += parseInt(row.total_calls);
    failedCalls += parseInt(row.failed_calls);
  }

  // Get overall totals
  const overall = await db.query(
    `SELECT
       COUNT(DISTINCT user_id) as total_users,
       COUNT(*) as total_calls,
       COUNT(DISTINCT user_id) FILTER (WHERE timestamp >= NOW() - INTERVAL '7 days') as active_users,
       COUNT(*) FILTER (WHERE success = false) as failed_calls
     FROM user_usage
     WHERE timestamp >= $1 AND timestamp <= $2`,
    [start, end]
  );

  const overallRow = overall.rows[0];

  return {
    totalUsers: parseInt(overallRow.total_users) || 0,
    totalCalls: parseInt(overallRow.total_calls) || 0,
    activeUsers: parseInt(overallRow.active_users) || 0,
    byModule,
    errorRate: totalCalls > 0 ? (parseInt(overallRow.failed_calls) / totalCalls) * 100 : 0
  };
}

/**
 * Helper: Create usage record from tool execution
 */
export function createUsageRecord(
  userId: string,
  moduleId: string,
  toolName: string,
  options: {
    commandText?: string;
    success?: boolean;
    errorMessage?: string;
    executionTimeMs?: number;
    metadata?: Record<string, any>;
  } = {}
): UsageRecord {
  return {
    userId,
    moduleId,
    toolName,
    commandText: options.commandText,
    success: options.success ?? true,
    errorMessage: options.errorMessage,
    executionTimeMs: options.executionTimeMs,
    metadata: options.metadata
  };
}
