import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger.js';
import { fetchTransactionAuditTrail } from '../utils/audit-log.js';
import { bookkeepingDb } from '../db/client.js';
import type { AuditTrailResult } from '../types/bookkeeping.types.js';

export const getAuditTrailTool: Tool = {
  name: 'get_audit_trail',
  description: `Retrieve the change history for a specific transaction, including versions, timestamps, and diffs.

Required parameters:
- transactionId: The database identifier of the transaction to inspect.`,
  inputSchema: {
    type: 'object',
    properties: {
      transactionId: { type: 'string', description: 'Transaction database ID (UUID)' },
    },
    required: ['transactionId'],
  },
};

export async function handleGetAuditTrail(args: unknown) {
  const startTime = Date.now();

  try {
    const params = args as { transactionId: string };
    if (!params?.transactionId) {
      throw new Error('transactionId parameter is required');
    }

    const history = bookkeepingDb.connected
      ? await fetchTransactionAuditTrail(params.transactionId)
      : [
          {
            version: 1,
            changedBy: 'system',
            changedAt: new Date().toISOString(),
            changes: {
              notice: { message: 'Audit trail persisted only when database is configured.' },
            },
          },
        ];

    const result: AuditTrailResult = {
      transactionId: params.transactionId,
      history,
      metadata: {
        entries: history.length,
      },
    };

    const duration = Date.now() - startTime;
    logger.info('Audit trail retrieved', {
      transactionId: params.transactionId,
      entries: history.length,
      durationMs: duration,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, audit: result }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error('get_audit_trail tool failed', {
      error: error.message,
      durationMs: duration,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: error.message,
              tool: 'get_audit_trail',
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }
}
