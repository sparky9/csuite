/**
 * MCP Tool: Ingest Availability Snapshot
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { v4 as uuid } from 'uuid';
import { logger } from '../utils/logger.js';
import { calendarDb } from '../db/client.js';

interface IngestAvailabilityInput {
  user_id?: string;
  organizer_email?: string;
  window_start: string;
  window_end: string;
  timezone: string;
  busy_blocks: Array<{ start: string; end: string; source?: string }>;
}

export const ingestAvailabilityTool: Tool = {
  name: 'ingest_availability_snapshot',
  description: 'Persist deterministic availability snapshot to inform future scheduling runs.',
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string' },
      organizer_email: { type: 'string' },
      window_start: { type: 'string' },
      window_end: { type: 'string' },
      timezone: { type: 'string' },
      busy_blocks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            start: { type: 'string' },
            end: { type: 'string' },
            source: { type: 'string' },
          },
          required: ['start', 'end'],
        },
      },
    },
    required: ['window_start', 'window_end', 'timezone', 'busy_blocks'],
  },
};

export async function handleIngestAvailability(args: unknown): Promise<any> {
  const params = args as IngestAvailabilityInput;
  const snapshotId = uuid();

  logger.info('Recording availability snapshot', {
    user: params.user_id ?? params.organizer_email,
    window_start: params.window_start,
    window_end: params.window_end,
    busy_blocks: params.busy_blocks.length,
  });

  if (calendarDb.connected) {
    await calendarDb.query(
      `INSERT INTO cm_availability_snapshots (id, user_id, window_start, window_end, timezone, busy_blocks)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        snapshotId,
        params.user_id ?? null,
        params.window_start,
        params.window_end,
        params.timezone,
        JSON.stringify(params.busy_blocks),
      ],
    );
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            success: true,
            snapshot: {
              id: snapshotId,
              window_start: params.window_start,
              window_end: params.window_end,
              timezone: params.timezone,
              busy_blocks: params.busy_blocks,
            },
          },
          null,
          2,
        ),
      },
    ],
  };
}
