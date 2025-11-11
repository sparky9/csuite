/**
 * Helpers for recording and retrieving transaction audit log entries.
 */
import { bookkeepingDb } from '../db/client.js';
import { logger } from './logger.js';
export async function recordTransactionAuditLog(options) {
    if (!bookkeepingDb.connected) {
        return;
    }
    const { transactionId, userId, changes } = options;
    const normalizedUser = userId && userId.trim() ? userId.trim() : 'system';
    try {
        const nextVersionRow = await bookkeepingDb.queryOne(`SELECT COALESCE(MAX(version), 0) + 1 AS next_version
       FROM bk_transaction_audit_log
       WHERE transaction_id = $1`, [transactionId]);
        const version = nextVersionRow?.next_version ?? 1;
        await bookkeepingDb.query(`INSERT INTO bk_transaction_audit_log (transaction_id, user_id, version, changes)
       VALUES ($1, $2, $3, $4::jsonb)`, [
            transactionId,
            normalizedUser,
            version,
            JSON.stringify(changes),
        ]);
    }
    catch (error) {
        logger.error('Failed to record transaction audit log entry', {
            transactionId,
            userId: normalizedUser,
            error: error.message,
        });
    }
}
export async function fetchTransactionAuditTrail(transactionId) {
    if (!bookkeepingDb.connected) {
        return [];
    }
    const result = await bookkeepingDb.query(`SELECT version, user_id, changed_at, changes
     FROM bk_transaction_audit_log
     WHERE transaction_id = $1
     ORDER BY version ASC`, [transactionId]);
    return result.rows.map((row) => {
        const normalized = {};
        if (row.changes && typeof row.changes === 'object') {
            for (const [key, value] of Object.entries(row.changes)) {
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    normalized[key] = value;
                }
                else {
                    normalized[key] = { value };
                }
            }
        }
        return {
            version: row.version,
            changedBy: row.user_id,
            changedAt: row.changed_at instanceof Date
                ? row.changed_at.toISOString()
                : new Date(row.changed_at).toISOString(),
            changes: normalized,
        };
    });
}
