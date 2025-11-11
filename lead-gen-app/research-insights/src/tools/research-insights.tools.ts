import { z, type ZodIssue } from 'zod';
import {
  createResearchSource,
  deleteResearchSource,
  getLatestSnapshot,
  getResearchSource,
  listRecentSnapshots,
  listResearchSources,
  hashContent,
  recordSnapshot,
  updateResearchSource,
  type CreateSourceInput,
  type ResearchSnapshot,
  type ResearchSource,
} from '../db/research.js';
import { captureSource } from '../research/capture.js';
import { computeDiffSummary, type DiffSummary } from '../research/diff.js';
import { buildDigestSummary } from '../research/summarize.js';
import { generateDigestNarrative, generateIntelligentSummary } from '../research/llm-summarizer.js';
import type { DigestEntry, ResearchSnapshotRecord, ResearchSourceRecord } from '../service/types.js';
import { logger } from '../utils/logger.js';

const VALID_FREQUENCIES = ['hourly', 'every-4-hours', 'twice-daily', 'daily', 'weekly', 'manual'] as const;

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

type SourceWithSnapshot = ResearchSourceRecord & { lastSnapshot: ResearchSnapshotRecord | null };

function hasLastSnapshot(
  source: ResearchSourceRecord | SourceWithSnapshot,
): source is SourceWithSnapshot {
  return Object.prototype.hasOwnProperty.call(source, 'lastSnapshot');
}

function mapSource(source: ResearchSource): ResearchSourceRecord {
  return {
    id: source.id,
    userId: source.userId,
    label: source.label,
    url: source.url,
    category: source.category,
    frequency: source.frequency,
    notes: source.notes,
    lastChecked: source.lastChecked,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
}

function mapSnapshot(snapshot: ResearchSnapshot): ResearchSnapshotRecord {
  return {
    id: snapshot.id,
    sourceId: snapshot.sourceId,
    capturedAt: snapshot.capturedAt,
    contentHash: snapshot.contentHash,
    title: snapshot.title,
    summary: snapshot.summary,
    highlights: snapshot.highlights ?? undefined,
    metadata: snapshot.metadata,
  };
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error('URL cannot be empty.');
  }
  const hydrated = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(hydrated);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Only HTTP and HTTPS URLs are supported.');
    }
    return parsed.toString();
  } catch (error) {
    throw new Error('Invalid URL format.');
  }
}

function buildResponse(lines: string[], payload?: unknown): ToolResult {
  if (payload !== undefined) {
    lines.push('', '```json', JSON.stringify(payload, null, 2), '```');
  }
  return {
    content: [
      {
        type: 'text',
        text: lines.join('\n'),
      },
    ],
  };
}

function handleError(context: string, error: unknown): ToolResult {
  if (error instanceof z.ZodError) {
    const details = error.issues
      .map((issue: ZodIssue) => `${issue.path.join('.') || 'value'}: ${issue.message}`)
      .join('; ');
    return {
      content: [
        {
          type: 'text',
          text: `Validation error while ${context}: ${details}`,
        },
      ],
      isError: true,
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  logger.error('Research Insights tool failed', { context, error: message });

  return {
    content: [
      {
        type: 'text',
        text: `Error while ${context}: ${message}`,
      },
    ],
    isError: true,
  };
}

const AddSourceSchema = z.object({
  label: z.string().min(3, 'Label must be at least 3 characters.').max(200, 'Label is too long.'),
  url: z.string().min(5, 'Provide a URL to monitor.'),
  category: z.string().optional(),
  frequency: z.enum(VALID_FREQUENCIES).optional(),
  notes: z.string().optional().nullable(),
});

export async function addSourceTool(args: unknown, userId: string): Promise<ToolResult> {
  try {
    const params = AddSourceSchema.parse(args ?? {});
    const label = params.label.trim();
    const url = normalizeUrl(params.url);

    const createInput: CreateSourceInput = {
      label,
      url,
      category: params.category,
      frequency: params.frequency ?? null,
      notes: params.notes ?? null,
    };

    const source = await createResearchSource(userId, createInput);
    logger.info('Research source created', { userId, sourceId: source.id });

    const record = mapSource(source);
    const lines = [
      `✅ Monitoring started for ${record.label}.`,
      `URL: ${record.url}`,
      params.frequency ? `Frequency: ${params.frequency}` : 'Frequency: manual or default schedule.',
    ];

    return buildResponse(lines, record);
  } catch (error) {
    return handleError('adding research source', error);
  }
}

const ListSourcesSchema = z
  .object({
    include_snapshots: z.boolean().optional(),
  })
  .optional();

export async function listSourcesTool(args: unknown, userId: string): Promise<ToolResult> {
  try {
    const params = ListSourcesSchema.parse(args ?? {});
    const includeSnapshots = params?.include_snapshots ?? true;

    const sources = await listResearchSources(userId);

    const enriched = includeSnapshots
      ? await Promise.all(
          sources.map(async (source) => {
            const latest = await getLatestSnapshot(source.id);
            return {
              ...mapSource(source),
              lastSnapshot: latest ? mapSnapshot(latest) : null,
            };
          }),
        )
      : sources.map(mapSource);

    if (!enriched.length) {
      return buildResponse(['No research sources configured yet.']);
    }

    const lines: string[] = ['Tracked Research Sources:', ''];
    for (const source of enriched) {
      lines.push(`• ${source.label} — ${source.url}`);
      if (hasLastSnapshot(source) && source.lastSnapshot) {
        const snapshot = source.lastSnapshot;
        lines.push(`  Last update: ${snapshot.capturedAt.toISOString()}`);
        if (snapshot.summary) {
          lines.push(`  Summary: ${snapshot.summary}`);
        }
      }
    }

    return buildResponse(lines, enriched);
  } catch (error) {
    return handleError('listing research sources', error);
  }
}

const RemoveSourceSchema = z.object({
  source_id: z.string().min(1, 'source_id is required.'),
});

export async function removeSourceTool(args: unknown, userId: string): Promise<ToolResult> {
  try {
    const params = RemoveSourceSchema.parse(args ?? {});
    const source = await getResearchSource(userId, params.source_id.trim());

    if (!source) {
      return {
        content: [
          {
            type: 'text',
            text: `Source ${params.source_id} was not found for this user.`,
          },
        ],
        isError: true,
      };
    }

    await deleteResearchSource(userId, source.id);
    logger.info('Research source removed', { userId, sourceId: source.id });

    return buildResponse([`🗑️ Removed ${source.label} from monitoring.`]);
  } catch (error) {
    return handleError('removing research source', error);
  }
}

const RunMonitorSchema = z
  .object({
    source_ids: z.array(z.string().min(1)).max(25).optional(),
    force: z.boolean().optional(),
  })
  .optional();

export async function runMonitorTool(args: unknown, userId: string): Promise<ToolResult> {
  try {
    const params = RunMonitorSchema.parse(args ?? {});
    const sources = await listResearchSources(userId);
    const selected = params?.source_ids?.length
      ? sources.filter((source) => params.source_ids?.includes(source.id))
      : sources;

    if (!selected.length) {
      return buildResponse(['No research sources available to monitor. Add sources first.']);
    }

    const updates: DigestEntry[] = [];
    const notes: string[] = [];

    for (const source of selected) {
      try {
        const capture = await captureSource(source.url);
        const preview = capture.text.slice(0, 4000);
        const previous = await getLatestSnapshot(source.id);
        const previousPreview = typeof previous?.metadata?.rawPreview === 'string' ? previous.metadata.rawPreview : null;
        const diff = computeDiffSummary(previousPreview, preview);
        const contentHash = hashContent(capture.text);
        const shouldRecord = params?.force
          ? true
          : !previous || previous.contentHash !== contentHash || diff.hasChanges;

        if (!shouldRecord && previous) {
          notes.push(`• ${source.label}: no visible changes.`);
          updates.push({
            source: mapSource(source),
            snapshot: mapSnapshot(previous),
            diff,
          });
          continue;
        }

        const summary = await generateIntelligentSummary(preview, source.label, previous?.summary ?? undefined);

        const snapshot = await recordSnapshot({
          sourceId: source.id,
          title: capture.title ?? summary.summary.slice(0, 120),
          summary: summary.summary,
          highlights: summary.keyInsights.length ? summary.keyInsights : diff.highlights,
          metadata: {
            url: capture.url,
            title: capture.title,
            loadTimeMs: capture.metadata?.loadTimeMs,
            status: capture.metadata?.status,
            contentLength: capture.metadata?.contentLength,
            diff,
            sentiment: summary.sentiment,
            urgency: summary.urgency,
            category: summary.category,
            rawPreview: preview,
            recordedAt: new Date().toISOString(),
          },
          rawContent: capture.text,
        });

        notes.push(`• ${source.label}: captured new snapshot (${snapshot.summary?.slice(0, 80) ?? 'summary unavailable'}).`);
        updates.push({
          source: mapSource(source),
          snapshot: mapSnapshot(snapshot),
          diff,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Research monitor failed', { sourceId: source.id, error: message });
        notes.push(`• ${source.label}: capture failed (${message}).`);
      }
    }

    const digest = buildDigestSummary(updates);

    const lines = ['Research monitor completed.', '', digest.headline];
    if (notes.length) {
      lines.push('', 'Details:', ...notes);
    }

    return buildResponse(lines, { digest, updates });
  } catch (error) {
    return handleError('running research monitor', error);
  }
}

const GetDigestSchema = z
  .object({
    limit: z.number().int().min(1).max(20).optional(),
  })
  .optional();

export async function getDigestTool(args: unknown, userId: string): Promise<ToolResult> {
  try {
    const params = GetDigestSchema.parse(args ?? {});
    const rows = await listRecentSnapshots(userId, params?.limit ?? 10);

    if (!rows.length) {
      return buildResponse(['No research snapshots recorded yet. Run the monitor first.']);
    }

    const entries: DigestEntry[] = rows.map(({ source, snapshot }) => ({
      source: mapSource(source),
      snapshot: mapSnapshot(snapshot),
      diff: snapshot.metadata?.diff as DiffSummary | undefined,
    }));

    const digest = buildDigestSummary(entries, { limit: params?.limit ?? 5 });
    const narrative = await generateDigestNarrative(
      entries.slice(0, 5).map((entry) => ({
        sourceLabel: entry.source.label,
        summary: entry.snapshot.summary ?? 'No summary available.',
        urgency: (entry.snapshot.metadata?.urgency as string) || 'low',
      })),
    );

    const lines = ['Latest research digest.', '', `Headline: ${digest.headline}`, '', narrative];

    return buildResponse(lines, { digest, entries });
  } catch (error) {
    return handleError('fetching research digest', error);
  }
}

const ResearchOnDemandSchema = z.object({
  topic: z.string().min(3, 'Topic must be at least 3 characters.'),
  urls: z.array(z.string().min(5)).optional(),
});

export async function researchOnDemandTool(args: unknown, userId: string): Promise<ToolResult> {
  try {
    const params = ResearchOnDemandSchema.parse(args ?? {});
    const topic = params.topic.trim();

  const providedUrls = params.urls?.map((url: string) => normalizeUrl(url)).slice(0, 5) ?? [];
    const fallbackSources = await listResearchSources(userId);
    const urls = providedUrls.length
      ? providedUrls
      : fallbackSources.map((source) => source.url).slice(0, 5);

    if (!urls.length) {
      return {
        content: [
          {
            type: 'text',
            text: 'Provide URLs or add monitored sources before running on-demand research.',
          },
        ],
        isError: true,
      };
    }

    const findings: Array<{ url: string; summary: string; highlights: string[] }> = [];

    for (const url of urls) {
      try {
        const capture = await captureSource(url);
        const text = capture.text.slice(0, 4000);
        const summary = text.replace(/\s+/g, ' ').trim().slice(0, 280) || 'No readable content captured.';
        findings.push({
          url,
          summary,
          highlights: [summary],
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn('On-demand research capture failed', { url, error: message });
        findings.push({ url, summary: message, highlights: [] });
      }
    }

    const lines = [`Research summary for ${topic}`, '', `Sources scanned: ${findings.length}`];

    return buildResponse(lines, { topic, findings });
  } catch (error) {
    return handleError('running on-demand research', error);
  }
}

const UpdateSourceSchema = z.object({
  source_id: z.string().min(1, 'source_id is required.'),
  label: z.string().min(3).max(200).optional(),
  url: z.string().min(5).optional(),
  category: z.string().optional(),
  frequency: z.union([z.enum(VALID_FREQUENCIES), z.null()]).optional(),
  notes: z.union([z.string(), z.null()]).optional(),
});

export async function updateSourceTool(args: unknown, userId: string): Promise<ToolResult> {
  try {
    const params = UpdateSourceSchema.parse(args ?? {});
    const updates: Partial<CreateSourceInput> = {};

    if (params.label !== undefined) {
      updates.label = params.label.trim();
    }

    if (params.url !== undefined) {
      updates.url = normalizeUrl(params.url);
    }

    if (params.category !== undefined) {
      updates.category = params.category.trim();
    }

    if (params.frequency !== undefined) {
      updates.frequency = params.frequency;
    }

    if (params.notes !== undefined) {
      updates.notes = params.notes;
    }

    if (!Object.keys(updates).length) {
      return {
        content: [
          {
            type: 'text',
            text: 'Provide at least one field to update.',
          },
        ],
        isError: true,
      };
    }

    const updated = await updateResearchSource(userId, params.source_id.trim(), updates);
    if (!updated) {
      return {
        content: [
          {
            type: 'text',
            text: `Source ${params.source_id} was not found.`,
          },
        ],
        isError: true,
      };
    }

    logger.info('Research source updated', { userId, sourceId: updated.id, fields: Object.keys(updates) });

    const lines = [`Refreshed configuration for ${updated.label}.`];

    return buildResponse(lines, mapSource(updated));
  } catch (error) {
    return handleError('updating research source', error);
  }
}
