/**
 * Activity retention management utilities
 * Handles configurable data retention periods for activities
 */
import { db } from '../db/client.js';
import { logger } from './logger.js';
/**
 * Get default retention period from config
 */
export async function getDefaultRetention() {
    try {
        const result = await db.queryOne('SELECT value FROM leadtracker_config WHERE key = $1', ['activity_retention_months']);
        if (!result) {
            logger.warn('Retention config not found, using default: 12 months');
            return 12;
        }
        const retention = parseInt(result.value, 10);
        if (![3, 6, 12, 24, 60].includes(retention)) {
            logger.warn(`Invalid retention value: ${retention}, using default: 12 months`);
            return 12;
        }
        return retention;
    }
    catch (error) {
        logger.error('Failed to get default retention', { error });
        return 12; // Fallback default
    }
}
/**
 * Calculate delete_after date based on activity date and retention period
 */
export function calculateDeleteAfter(activityDate, retentionMonths) {
    const deleteDate = new Date(activityDate);
    deleteDate.setMonth(deleteDate.getMonth() + retentionMonths);
    return deleteDate;
}
/**
 * Clean up expired activities (run periodically)
 * Returns number of activities deleted
 */
export async function cleanupExpiredActivities() {
    try {
        const result = await db.query(`DELETE FROM activities
       WHERE delete_after IS NOT NULL
         AND delete_after < NOW()
       RETURNING id`);
        const deletedCount = result.rowCount || 0;
        if (deletedCount > 0) {
            logger.info('Cleaned up expired activities', {
                deleted_count: deletedCount,
                deleted_before: new Date().toISOString(),
            });
        }
        return deletedCount;
    }
    catch (error) {
        logger.error('Failed to clean up expired activities', { error });
        throw error;
    }
}
/**
 * Update retention configuration
 * Only accepts valid retention periods: 3, 6, 12, 24, or 60 months
 */
export async function updateRetentionConfig(months) {
    const validPeriods = [3, 6, 12, 24, 60];
    if (!validPeriods.includes(months)) {
        throw new Error(`Invalid retention period: ${months}. Must be one of: ${validPeriods.join(', ')}`);
    }
    try {
        await db.query(`UPDATE leadtracker_config
       SET value = $1, updated_at = NOW()
       WHERE key = 'activity_retention_months'`, [months.toString()]);
        logger.info('Updated retention configuration', {
            new_retention_months: months,
        });
    }
    catch (error) {
        logger.error('Failed to update retention config', { error });
        throw error;
    }
}
/**
 * Get retention statistics
 * Shows total activities, activities scheduled for deletion, and oldest activity
 */
export async function getRetentionStats() {
    try {
        const [totalResult, toDeleteResult, oldestResult, configResult] = await Promise.all([
            // Total activities
            db.queryOne('SELECT COUNT(*) as count FROM activities'),
            // Activities scheduled for deletion
            db.queryOne('SELECT COUNT(*) as count FROM activities WHERE delete_after < NOW()'),
            // Oldest activity
            db.queryOne('SELECT MIN(activity_date) as oldest FROM activities'),
            // Current config
            getDefaultRetention(),
        ]);
        return {
            total_activities: parseInt(totalResult?.count || '0', 10),
            activities_to_delete: parseInt(toDeleteResult?.count || '0', 10),
            oldest_activity: oldestResult?.oldest || null,
            retention_config: {
                default_months: configResult,
            },
        };
    }
    catch (error) {
        logger.error('Failed to get retention stats', { error });
        throw error;
    }
}
/**
 * Recalculate delete_after dates for all activities
 * Useful if retention policy changes and needs to be retroactively applied
 */
export async function recalculateDeleteAfterDates() {
    try {
        const result = await db.query(`UPDATE activities
       SET delete_after = activity_date + (retention_months || ' months')::INTERVAL
       WHERE retention_months IS NOT NULL
       RETURNING id`);
        const updatedCount = result.rowCount || 0;
        logger.info('Recalculated delete_after dates', {
            updated_count: updatedCount,
        });
        return updatedCount;
    }
    catch (error) {
        logger.error('Failed to recalculate delete_after dates', { error });
        throw error;
    }
}
/**
 * Preview activities that would be deleted
 * Returns list of activities scheduled for deletion
 */
export async function previewExpiredActivities(limit = 100) {
    try {
        const result = await db.query(`SELECT
         id,
         prospect_id,
         activity_type,
         activity_date,
         delete_after,
         EXTRACT(DAY FROM delete_after - NOW())::INT as days_until_deletion
       FROM activities
       WHERE delete_after IS NOT NULL
         AND delete_after < NOW() + INTERVAL '30 days'
       ORDER BY delete_after ASC
       LIMIT $1`, [limit]);
        return result.rows;
    }
    catch (error) {
        logger.error('Failed to preview expired activities', { error });
        throw error;
    }
}
//# sourceMappingURL=retention.js.map