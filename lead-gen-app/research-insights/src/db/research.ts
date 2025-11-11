import { createHash } from 'node:crypto';
import { db } from './client.js';

export interface ResearchSourceRow {
  source_id: string;
  user_id: string;
  label: string;
  url: string;
  category: string;
  frequency: string | null;
  notes: string | null;
  last_checked: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ResearchSnapshotRow {
  snapshot_id: string;
  source_id: string;
  captured_at: Date;
  content_hash: string;
  title: string | null;
  summary: string | null;
  highlights: string[] | null;
  metadata: Record<string, any>;
}

export interface ResearchSource {
  id: string;
  userId: string;
  label: string;
  url: string;
  category: string;
  frequency: string | null;
  notes: string | null;
  lastChecked: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResearchSnapshot {
  id: string;
  sourceId: string;
  capturedAt: Date;
  contentHash: string;
  title: string | null;
  summary: string | null;
  highlights: string[] | null;
  metadata: Record<string, any>;
}

export interface CreateSourceInput {
  label: string;
  url: string;
  category?: string;
  frequency?: string | null;
  notes?: string | null;
}

function mapSourceRow(row: ResearchSourceRow): ResearchSource {
  return {
    id: row.source_id,
    userId: row.user_id,
    label: row.label,
    url: row.url,
    category: row.category,
    frequency: row.frequency,
    notes: row.notes,
    lastChecked: row.last_checked,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSnapshotRow(row: ResearchSnapshotRow): ResearchSnapshot {
  return {
    id: row.snapshot_id,
    sourceId: row.source_id,
    capturedAt: row.captured_at,
    contentHash: row.content_hash,
    title: row.title,
    summary: row.summary,
    highlights: row.highlights ?? null,
    metadata: typeof row.metadata === 'object' ? row.metadata : JSON.parse(String(row.metadata || '{}'))
  };
}

export async function createResearchSource(userId: string, input: CreateSourceInput): Promise<ResearchSource> {
  const category = input.category ?? 'competitor';

  const result = await db.query<ResearchSourceRow>(
    `INSERT INTO research_sources (user_id, label, url, category, frequency, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, input.label, input.url, category, input.frequency ?? null, input.notes ?? null]
  );

  return mapSourceRow(result.rows[0]);
}

export async function updateResearchSource(
  userId: string,
  sourceId: string,
  input: Partial<CreateSourceInput>
): Promise<ResearchSource | null> {
  if (Object.keys(input).length === 0) {
    return await getResearchSource(userId, sourceId);
  }

  const columns: string[] = [];
  const values: any[] = [];

  if (input.label !== undefined) {
    columns.push('label');
    values.push(input.label);
  }
  if (input.url !== undefined) {
    columns.push('url');
    values.push(input.url);
  }
  if (input.category !== undefined) {
    columns.push('category');
    values.push(input.category);
  }
  if (input.frequency !== undefined) {
    columns.push('frequency');
    values.push(input.frequency);
  }
  if (input.notes !== undefined) {
    columns.push('notes');
    values.push(input.notes);
  }

  if (!columns.length) {
    return await getResearchSource(userId, sourceId);
  }

  const setClause = columns.map((column, index) => `${column} = $${index + 3}`).join(', ');
  const query = `UPDATE research_sources SET ${setClause}, updated_at = NOW() WHERE source_id = $1 AND user_id = $2 RETURNING *`;

  const result = await db.query<ResearchSourceRow>(query, [sourceId, userId, ...values]);
  return result.rows[0] ? mapSourceRow(result.rows[0]) : null;
}

export async function listResearchSources(userId: string): Promise<ResearchSource[]> {
  const result = await db.query<ResearchSourceRow>(
    `SELECT * FROM research_sources
     WHERE user_id = $1
     ORDER BY updated_at DESC`,
    [userId]
  );
  return result.rows.map(mapSourceRow);
}

export async function getResearchSource(userId: string, sourceId: string): Promise<ResearchSource | null> {
  const result = await db.query<ResearchSourceRow>(
    `SELECT * FROM research_sources
     WHERE user_id = $1 AND source_id = $2
     LIMIT 1`,
    [userId, sourceId]
  );
  return result.rows[0] ? mapSourceRow(result.rows[0]) : null;
}

export async function deleteResearchSource(userId: string, sourceId: string): Promise<boolean> {
  const result = await db.query(
    `DELETE FROM research_sources WHERE source_id = $1 AND user_id = $2`,
    [sourceId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

export interface SnapshotInput {
  sourceId: string;
  title?: string | null;
  summary?: string | null;
  highlights?: string[];
  metadata?: Record<string, any>;
  rawContent: string;
}

export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export async function recordSnapshot(input: SnapshotInput): Promise<ResearchSnapshot> {
  const contentHash = hashContent(input.rawContent);

  const result = await db.query<ResearchSnapshotRow>(
    `INSERT INTO research_snapshots (source_id, content_hash, title, summary, highlights, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.sourceId,
      contentHash,
      input.title ?? null,
      input.summary ?? null,
      input.highlights ?? null,
      input.metadata ? JSON.stringify(input.metadata) : '{}'
    ]
  );

  await db.query(
    `UPDATE research_sources SET last_checked = NOW(), updated_at = NOW() WHERE source_id = $1`,
    [input.sourceId]
  );

  return mapSnapshotRow(result.rows[0]);
}

export async function getLatestSnapshot(sourceId: string): Promise<ResearchSnapshot | null> {
  const result = await db.query<ResearchSnapshotRow>(
    `SELECT * FROM research_snapshots
     WHERE source_id = $1
     ORDER BY captured_at DESC
     LIMIT 1`,
    [sourceId]
  );

  return result.rows[0] ? mapSnapshotRow(result.rows[0]) : null;
}

export async function listRecentSnapshots(
  userId: string,
  limit: number = 10
): Promise<Array<{ source: ResearchSource; snapshot: ResearchSnapshot }>> {
  const result = await db.query(
    `SELECT rs.*, snap.*
     FROM research_sources rs
     JOIN research_snapshots snap ON snap.source_id = rs.source_id
     WHERE rs.user_id = $1
     ORDER BY snap.captured_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows.map((row: any) => ({
    source: mapSourceRow({
      source_id: row.source_id,
      user_id: row.user_id,
      label: row.label,
      url: row.url,
      category: row.category,
      frequency: row.frequency,
      notes: row.notes,
      last_checked: row.last_checked,
      created_at: row.created_at,
      updated_at: row.updated_at
    }),
    snapshot: mapSnapshotRow({
      snapshot_id: row.snapshot_id,
      source_id: row.source_id,
      captured_at: row.captured_at,
      content_hash: row.content_hash,
      title: row.title,
      summary: row.summary,
      highlights: row.highlights,
      metadata: row.metadata
    })
  }));
}

export async function sourceHasChanges(sourceId: string, rawContent: string): Promise<boolean> {
  const latest = await getLatestSnapshot(sourceId);
  if (!latest) {
    return true;
  }

  const hash = hashContent(rawContent);
  return hash !== latest.contentHash;
}
