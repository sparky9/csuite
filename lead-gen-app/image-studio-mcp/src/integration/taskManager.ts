/**
 * Task & Project Manager integration helpers.
 */

import { randomUUID } from 'node:crypto';
import pg from 'pg';
import type { ResolvedTaskManagerConfig } from '../config/integration.js';

const { Pool } = pg;

interface ProjectAssetPayload {
  label: string;
  description?: string;
  sourcePath?: string;
  outputPath: string;
  revisionId?: string;
  cost?: number;
  currency?: string;
  brand?: string;
  metadata?: Record<string, unknown>;
  userId?: string;
  projectId?: string;
}

export interface ProjectAssetResult {
  assetId: string;
  projectId: string;
}

let taskManagerInitPromise: Promise<boolean> | null = null;
let pool: pg.Pool | null = null;

const createPool = (connectionString: string): pg.Pool => {
  if (pool) {
    return pool;
  }

  pool = new Pool({
    connectionString,
    ssl:
      connectionString.includes('neon.tech') || connectionString.includes('amazonaws.com')
        ? { rejectUnauthorized: false }
        : undefined,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

  pool.on('error', (error) => {
    console.error('[image-studio] Task manager database pool error', error);
  });

  return pool;
};

const ensureSchema = async (client: pg.PoolClient): Promise<void> => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS project_assets (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL,
      project_id UUID NOT NULL,
      label TEXT NOT NULL,
      description TEXT,
      source_path TEXT,
      output_path TEXT NOT NULL,
      revision_id TEXT,
      cost NUMERIC,
      currency TEXT,
      brand TEXT,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (project_id, output_path)
    );
  `);

  await client.query(
    'CREATE INDEX IF NOT EXISTS idx_project_assets_project ON project_assets(project_id);',
  );
  await client.query(
    'CREATE INDEX IF NOT EXISTS idx_project_assets_user ON project_assets(user_id);',
  );
  await client.query(
    'CREATE INDEX IF NOT EXISTS idx_project_assets_revision ON project_assets(revision_id);',
  );
};

const ensureTaskManagerReady = async (databaseUrl?: string): Promise<boolean> => {
  if (taskManagerInitPromise) {
    return taskManagerInitPromise;
  }

  if (!databaseUrl) {
    console.warn('[image-studio] Task manager integration skipped: no database URL configured.');
    return false;
  }

  taskManagerInitPromise = (async () => {
    const activePool = createPool(databaseUrl);
    const client = await activePool.connect();
    try {
      await ensureSchema(client);
      return true;
    } finally {
      client.release();
    }
  })().catch(async (error) => {
    console.error('[image-studio] Failed to initialise task manager database', error);
    taskManagerInitPromise = null;
    if (pool) {
      try {
        await pool.end();
      } catch (closeError) {
        console.error('[image-studio] Failed to close task manager pool after init failure', closeError);
      }
      pool = null;
    }
    return false;
  });

  return taskManagerInitPromise;
};

export const recordProjectAssetLink = async (
  config: ResolvedTaskManagerConfig,
  payload: ProjectAssetPayload,
): Promise<ProjectAssetResult | undefined> => {
  if (!config.enabled) {
    return undefined;
  }

  const projectId = payload.projectId ?? config.projectId;
  if (!projectId) {
    console.warn('[image-studio] Task manager integration skipped: no project ID provided.');
    return undefined;
  }

  const userId = payload.userId ?? config.userId;
  if (!userId) {
    console.warn('[image-studio] Task manager integration skipped: no user ID configured.');
    return undefined;
  }

  const databaseUrl = config.databaseUrl ?? process.env.DATABASE_URL;
  const ready = await ensureTaskManagerReady(databaseUrl ?? undefined);
  if (!ready || !pool) {
    return undefined;
  }

  try {
    const assetId = randomUUID();
    const label = payload.label ?? config.label ?? 'Staged asset';
    const description = payload.description ?? config.description ?? null;
    const sourcePath = payload.sourcePath ?? null;
    const revisionId = payload.revisionId ?? null;
    const cost = typeof payload.cost === 'number' ? Number(payload.cost.toFixed(4)) : null;
    const currency = payload.currency ?? null;
    const brand = payload.brand ?? config.brand ?? null;
    const metadataJson = payload.metadata ? JSON.stringify(payload.metadata) : null;

    const insertResult = await pool.query<{ id: string }>(
      `
        INSERT INTO project_assets (
          id,
          user_id,
          project_id,
          label,
          description,
          source_path,
          output_path,
          revision_id,
          cost,
          currency,
          brand,
          metadata
        ) VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12::jsonb
        )
        ON CONFLICT (project_id, output_path)
        DO UPDATE SET
          label = EXCLUDED.label,
          description = EXCLUDED.description,
          source_path = EXCLUDED.source_path,
          revision_id = EXCLUDED.revision_id,
          cost = EXCLUDED.cost,
          currency = EXCLUDED.currency,
          brand = EXCLUDED.brand,
          metadata = CASE
            WHEN project_assets.metadata IS NULL THEN EXCLUDED.metadata
            WHEN EXCLUDED.metadata IS NULL THEN project_assets.metadata
            ELSE project_assets.metadata || EXCLUDED.metadata
          END,
          updated_at = NOW()
        RETURNING id;
      `,
      [
        assetId,
        userId,
        projectId,
        label,
        description,
        sourcePath,
        payload.outputPath,
        revisionId,
        cost,
        currency,
        brand,
        metadataJson,
      ],
    );

    const persistedId = insertResult.rows[0]?.id ?? assetId;

    return {
      assetId: persistedId,
      projectId,
    } satisfies ProjectAssetResult;
  } catch (error) {
    console.error('[image-studio] Failed to record project asset', error);
    return undefined;
  }
};
