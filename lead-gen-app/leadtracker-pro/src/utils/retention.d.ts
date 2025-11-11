/**
 * Activity retention management utilities
 * Handles configurable data retention periods for activities
 */
import { RetentionPeriod, RetentionStats } from '../types/leadtracker.types.js';
/**
 * Get default retention period from config
 */
export declare function getDefaultRetention(): Promise<number>;
/**
 * Calculate delete_after date based on activity date and retention period
 */
export declare function calculateDeleteAfter(activityDate: Date, retentionMonths: number): Date;
/**
 * Clean up expired activities (run periodically)
 * Returns number of activities deleted
 */
export declare function cleanupExpiredActivities(): Promise<number>;
/**
 * Update retention configuration
 * Only accepts valid retention periods: 3, 6, 12, 24, or 60 months
 */
export declare function updateRetentionConfig(months: RetentionPeriod): Promise<void>;
/**
 * Get retention statistics
 * Shows total activities, activities scheduled for deletion, and oldest activity
 */
export declare function getRetentionStats(): Promise<RetentionStats>;
/**
 * Recalculate delete_after dates for all activities
 * Useful if retention policy changes and needs to be retroactively applied
 */
export declare function recalculateDeleteAfterDates(): Promise<number>;
/**
 * Preview activities that would be deleted
 * Returns list of activities scheduled for deletion
 */
export declare function previewExpiredActivities(limit?: number): Promise<Array<{
    id: string;
    prospect_id: string;
    activity_type: string;
    activity_date: Date;
    delete_after: Date;
    days_until_deletion: number;
}>>;
//# sourceMappingURL=retention.d.ts.map