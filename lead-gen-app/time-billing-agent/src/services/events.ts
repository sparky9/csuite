import type pg from 'pg';

export async function recordEvent(
  client: pg.PoolClient,
  params: {
    userId: string;
    eventType: string;
    entityType: string;
    entityId: string;
    eventData?: Record<string, unknown>;
  }
): Promise<void> {
  const { userId, eventType, entityType, entityId, eventData } = params;
  await client.query(
    `INSERT INTO billing_events (user_id, event_type, entity_type, entity_id, event_data)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, eventType, entityType, entityId, eventData ?? null]
  );
}
