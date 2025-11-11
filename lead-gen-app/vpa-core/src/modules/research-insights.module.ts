import { requireModuleAccess } from '../auth/module-access.js';
import { createUsageRecord, trackUsage } from '../db/usage.js';
import {
  buildDigestSummary,
  captureSource,
  computeDiffSummary,
  createResearchSource,
  deleteResearchSource,
  generateDigestNarrative,
  generateIntelligentSummary,
  getLatestSnapshot,
  getResearchSource,
  hashContent,
  listRecentSnapshots,
  listResearchSources,
  recordSnapshot,
  updateResearchSource
} from 'research-insights';
import type {
  CreateSourceInput,
  DigestEntry,
  ResearchSnapshot,
  ResearchSnapshotRecord,
  ResearchSource,
  ResearchSourceInput,
  ResearchSourceRecord
} from 'research-insights';
import { logger } from '../utils/logger.js';
import { buildVoiceSummary } from '../voice/format.js';

const MODULE_ID = 'research-insights';
const MAX_SOURCES_PER_USER = 50; // Prevent abuse

const farewellTemplates = [
  (label: string) => `Okay, we'll stop peeking at ${label}. They won't even notice we left.`,
  (label: string) => `${label} is off the radar. Consider it a stealthy Irish exit.`,
  (label: string) => `Farewell to ${label}! We'll keep an ear out in case you miss them.`
];

const refreshTemplates = [
  (label: string) => `${label} got a fresh coat of paint. Monitoring updated and ready.`,
  (label: string) => `Tweaks locked in for ${label}. We'll keep scouting with the new details.`,
  (label: string) => `${label} is now following your new specs. Let's see what they do next.`
];

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
    updatedAt: source.updatedAt
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
    metadata: snapshot.metadata
  };
}

function buildSummaryText(text: string): { summary: string; highlights: string[] } {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) {
    return { summary: 'No readable content captured.', highlights: [] };
  }

  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

  const summary = sentences.slice(0, 3).join(' ');
  const highlights = sentences.slice(0, 5);

  return {
    summary: summary || clean.slice(0, 220),
    highlights
  };
}

function pickMessage(label: string, templates: Array<(label: string) => string>): string {
  if (!templates.length) {
    return label;
  }

  const index = Math.floor(Math.random() * templates.length);
  return templates[index](label);
}

export class ResearchInsightsModule {
  async addSource(params: ResearchSourceInput, userId: string): Promise<any> {
    const start = Date.now();

    try {
      await requireModuleAccess(userId, MODULE_ID);

      // Check source limit
      const existingSources = await listResearchSources(userId);
      if (existingSources.length >= MAX_SOURCES_PER_USER) {
        throw new Error(
          `Maximum source limit reached (${MAX_SOURCES_PER_USER}). Remove unused sources before adding new ones.`
        );
      }

      const label = typeof params.label === 'string' ? params.label.trim() : '';
      let url = typeof params.url === 'string' ? params.url.trim() : '';

      if (!label) {
        throw new Error('Source label is required');
      }

      if (label.length > 200) {
        throw new Error('Source label must be 200 characters or less');
      }

      if (!url) {
        throw new Error('Source URL is required');
      }

      // Add protocol if missing
      if (!/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
      }

      // Validate URL format
      try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          throw new Error('Only HTTP and HTTPS URLs are supported');
        }
      } catch (error) {
        throw new Error('Invalid URL format. Please provide a valid web address.');
      }

      // Validate frequency if provided
      if (params.frequency) {
        const validFrequencies = ['hourly', 'every-4-hours', 'twice-daily', 'daily', 'weekly', 'manual'];
        if (!validFrequencies.includes(params.frequency)) {
          throw new Error(
            `Invalid frequency. Must be one of: ${validFrequencies.join(', ')}`
          );
        }
      }

      const createInput: CreateSourceInput = {
        label,
        url,
        category: params.category,
        frequency: params.frequency,
        notes: params.notes ?? null
      };

      const source = await createResearchSource(userId, createInput);

      await trackUsage(createUsageRecord(userId, MODULE_ID, 'add_source', {
        executionTimeMs: Date.now() - start,
        metadata: { sourceId: source.id }
      }));

      return {
        status: 'success',
        message: `Source ${source.label} added for monitoring`,
        source: mapSource(source),
        voice: buildVoiceSummary(`Monitoring ${source.label} is now live.`, 'Say "Run research digest" to fetch updates.')
      };
    } catch (error) {
      await trackUsage(createUsageRecord(userId, MODULE_ID, 'add_source', {
        success: false,
        executionTimeMs: Date.now() - start,
        errorMessage: error instanceof Error ? error.message : String(error)
      }));
      throw error;
    }
  }

  async listSources(userId: string): Promise<any> {
    const start = Date.now();

    try {
      await requireModuleAccess(userId, MODULE_ID);

      const sources = await listResearchSources(userId);
      const enriched = await Promise.all(
        sources.map(async (source) => {
          const latest = await getLatestSnapshot(source.id);
          return {
            ...mapSource(source),
            lastSnapshot: latest ? mapSnapshot(latest) : null
          };
        })
      );

      await trackUsage(createUsageRecord(userId, MODULE_ID, 'list_sources', {
        executionTimeMs: Date.now() - start,
        metadata: { count: enriched.length }
      }));

      const voice = buildVoiceSummary(
        enriched.length
          ? `${enriched.length} research sources on deck.`
          : 'No research sources configured yet.',
        enriched.length ? 'Say "Run competitor scan" to fetch new updates.' : 'Say "Add competitor" to start monitoring.'
      );

      return {
        status: 'success',
        sources: enriched,
        voice
      };
    } catch (error) {
      await trackUsage(createUsageRecord(userId, MODULE_ID, 'list_sources', {
        success: false,
        executionTimeMs: Date.now() - start,
        errorMessage: error instanceof Error ? error.message : String(error)
      }));
      throw error;
    }
  }

  async removeSource(params: { sourceId: string }, userId: string): Promise<any> {
    const start = Date.now();

    try {
      await requireModuleAccess(userId, MODULE_ID);

      const sourceId = typeof params?.sourceId === 'string' ? params.sourceId.trim() : '';
      if (!sourceId) {
        throw new Error('sourceId is required');
      }

      const source = await getResearchSource(userId, sourceId);
      if (!source) {
        throw new Error('Source not found');
      }

      await deleteResearchSource(userId, sourceId);

      const farewell = pickMessage(source.label, farewellTemplates);

      await trackUsage(createUsageRecord(userId, MODULE_ID, 'remove_source', {
        executionTimeMs: Date.now() - start,
        metadata: { sourceId }
      }));

      return {
        status: 'success',
        message: farewell,
        voice: buildVoiceSummary(farewell)
      };
    } catch (error) {
      await trackUsage(createUsageRecord(userId, MODULE_ID, 'remove_source', {
        success: false,
        executionTimeMs: Date.now() - start,
        errorMessage: error instanceof Error ? error.message : String(error)
      }));
      throw error;
    }
  }

  async runMonitor(
    params: { sourceIds?: string[]; force?: boolean } | undefined,
    userId: string
  ): Promise<any> {
    const start = Date.now();

    try {
      await requireModuleAccess(userId, MODULE_ID);

      const sources = await listResearchSources(userId);
      const selected = params?.sourceIds?.length
        ? sources.filter((source) => params.sourceIds?.includes(source.id))
        : sources;

      if (!selected.length) {
        return {
          status: 'success',
          message: 'No research sources configured yet.',
          updates: [],
          voice: buildVoiceSummary('No sources to monitor yet. Say "Add competitor" to begin.')
        };
      }

      const updates: DigestEntry[] = [];

      for (const source of selected) {
        try {
          const capture = await captureSource(source.url);
          const preview = capture.text.slice(0, 4000);
          const previous = await getLatestSnapshot(source.id);
          const hasChanges = params?.force ? true : !previous || hashContent(capture.text) !== previous.contentHash;

          if (!hasChanges && previous) {
            updates.push({
              source: mapSource(source),
              snapshot: mapSnapshot(previous),
              diff: {
                hasChanges: false,
                changeRatio: 0,
                highlights: ['No visible updates detected.']
              }
            });
            continue;
          }

          // Use LLM to generate intelligent summary (falls back to simple summary on error)
          const previousPreview = typeof previous?.metadata?.rawPreview === 'string' ? previous.metadata.rawPreview : null;
          const previousSummary = previous?.summary ?? undefined;

          const intelligentSummary = await generateIntelligentSummary(
            preview,
            source.label,
            previousSummary
          );

          const diff = computeDiffSummary(previousPreview, preview);

          const snapshot = await recordSnapshot({
            sourceId: source.id,
            title: capture.title ?? intelligentSummary.summary.slice(0, 120),
            summary: intelligentSummary.summary,
            highlights: intelligentSummary.keyInsights.length > 0
              ? intelligentSummary.keyInsights
              : diff.highlights,
            metadata: {
              url: capture.url,
              title: capture.title,
              loadTimeMs: capture.metadata.loadTimeMs,
              status: capture.metadata.status,
              contentLength: capture.metadata.contentLength,
              rawPreview: preview,
              diff,
              sentiment: intelligentSummary.sentiment,
              urgency: intelligentSummary.urgency,
              category: intelligentSummary.category,
              recordedAt: new Date().toISOString()
            },
            rawContent: capture.text
          });

          updates.push({
            source: mapSource(source),
            snapshot: mapSnapshot(snapshot),
            diff
          });
        } catch (error) {
          logger.error('Research monitor failed', {
            userId,
            sourceId: source.id,
            error
          });

          updates.push({
            source: mapSource(source),
            snapshot: {
              id: 'error',
              sourceId: source.id,
              capturedAt: new Date(),
              contentHash: 'error',
              title: 'Capture failed',
              summary: error instanceof Error ? error.message : String(error),
              highlights: [],
              metadata: {}
            },
            diff: {
              hasChanges: false,
              changeRatio: 0,
              highlights: ['Capture failed']
            }
          });
        }
      }

      await trackUsage(createUsageRecord(userId, MODULE_ID, 'run_monitor', {
        executionTimeMs: Date.now() - start,
        metadata: { scanned: updates.length }
      }));

      const digest = buildDigestSummary(updates);

      return {
        status: 'success',
        message: digest.headline,
        updates,
        digest,
        voice: buildVoiceSummary(digest.headline, 'Say "Send me the digest" to email the highlights.')
      };
    } catch (error) {
      await trackUsage(createUsageRecord(userId, MODULE_ID, 'run_monitor', {
        success: false,
        executionTimeMs: Date.now() - start,
        errorMessage: error instanceof Error ? error.message : String(error)
      }));
      throw error;
    }
  }

  async getDigest(userId: string, params?: { limit?: number }): Promise<any> {
    const start = Date.now();

    try {
      await requireModuleAccess(userId, MODULE_ID);

      const rows = await listRecentSnapshots(userId, params?.limit ?? 10);
      const entries: DigestEntry[] = rows.map(({ source, snapshot }) => ({
        source: mapSource(source),
        snapshot: mapSnapshot(snapshot),
        diff: snapshot.metadata?.diff ?? undefined
      }));

      const digest = buildDigestSummary(entries, { limit: params?.limit ?? 5 });

      // Generate intelligent voice narrative using LLM
      const narrativeUpdates = entries
        .slice(0, 5)
        .map((entry) => ({
          sourceLabel: entry.source.label,
          summary: entry.snapshot.summary || 'No summary available',
          urgency: (entry.snapshot.metadata?.urgency as string) || 'low'
        }));

      const voiceNarrative = await generateDigestNarrative(narrativeUpdates);

      await trackUsage(createUsageRecord(userId, MODULE_ID, 'get_digest', {
        executionTimeMs: Date.now() - start,
        metadata: { entries: entries.length }
      }));

      return {
        status: 'success',
        digest,
        entries,
        voice: buildVoiceSummary(voiceNarrative, 'Say "Research follow-up" to dive deeper.')
      };
    } catch (error) {
      await trackUsage(createUsageRecord(userId, MODULE_ID, 'get_digest', {
        success: false,
        executionTimeMs: Date.now() - start,
        errorMessage: error instanceof Error ? error.message : String(error)
      }));
      throw error;
    }
  }

  async researchOnDemand(
    params: { topic: string; urls?: string[] },
    userId: string
  ): Promise<any> {
    const start = Date.now();

    try {
      await requireModuleAccess(userId, MODULE_ID);

      const topic = typeof params.topic === 'string' ? params.topic.trim() : '';
      if (!topic) {
        throw new Error('Topic is required for on-demand research.');
      }

      const providedUrls = Array.isArray(params.urls)
        ? params.urls.map((value) => (typeof value === 'string' ? value.trim() : '')).filter(Boolean)
        : [];

      const urls = providedUrls.length
        ? providedUrls
        : (await listResearchSources(userId)).map((source) => source.url).filter(Boolean);
      if (!urls.length) {
        throw new Error('No sources available. Provide URLs or add monitored sources.');
      }

      const findings: Array<{ url: string; summary: string; highlights: string[] }> = [];

      for (const url of urls.slice(0, 5)) {
        try {
          const capture = await captureSource(url);
          const summaryBits = buildSummaryText(capture.text.slice(0, 4000));
          findings.push({
            url,
            summary: summaryBits.summary,
            highlights: summaryBits.highlights
          });
        } catch (error) {
          findings.push({
            url,
            summary: error instanceof Error ? error.message : String(error),
            highlights: []
          });
        }
      }

      await trackUsage(createUsageRecord(userId, MODULE_ID, 'research_on_demand', {
        executionTimeMs: Date.now() - start,
        metadata: { topic, sources: findings.length }
      }));

      const headline = findings.length
        ? `Research summary for ${topic}`
        : `No findings for ${topic}`;

      return {
        status: 'success',
        topic,
        findings,
        voice: buildVoiceSummary(headline, 'Say "Save this" to store the highlights.')
      };
    } catch (error) {
      await trackUsage(createUsageRecord(userId, MODULE_ID, 'research_on_demand', {
        success: false,
        executionTimeMs: Date.now() - start,
        errorMessage: error instanceof Error ? error.message : String(error)
      }));
      throw error;
    }
  }

  async updateSource(
    params: {
      sourceId: string;
      label?: string;
      url?: string;
      category?: string;
      frequency?: string | null;
      notes?: string | null;
    },
    userId: string
  ): Promise<any> {
    const start = Date.now();

    try {
      await requireModuleAccess(userId, MODULE_ID);

      const sourceId = typeof params?.sourceId === 'string' ? params.sourceId.trim() : '';
      if (!sourceId) {
        throw new Error('sourceId is required');
      }

      const updates: Partial<CreateSourceInput> = {};

      if (typeof params.label === 'string') {
        updates.label = params.label.trim();
      }

      if (typeof params.url === 'string') {
        const trimmed = params.url.trim();
        updates.url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      }

      if (typeof params.category === 'string') {
        updates.category = params.category.trim();
      }

      if (params.frequency !== undefined) {
        updates.frequency = params.frequency === null ? null : String(params.frequency).trim();
      }

      if (params.notes !== undefined) {
        updates.notes = params.notes === null ? null : String(params.notes).trim();
      }

      if (!Object.keys(updates).length) {
        throw new Error('Provide at least one field to update.');
      }

      const updated = await updateResearchSource(userId, sourceId, updates);
      if (!updated) {
        throw new Error('Source not found');
      }

      const refreshMessage = pickMessage(updated.label, refreshTemplates);

      await trackUsage(createUsageRecord(userId, MODULE_ID, 'update_source', {
        executionTimeMs: Date.now() - start,
        metadata: { sourceId, fields: Object.keys(updates) }
      }));

      return {
        status: 'success',
        message: refreshMessage,
        source: mapSource(updated),
        voice: buildVoiceSummary(refreshMessage, 'Say "Run competitor scan" to pick up fresh intel.')
      };
    } catch (error) {
      await trackUsage(createUsageRecord(userId, MODULE_ID, 'update_source', {
        success: false,
        executionTimeMs: Date.now() - start,
        errorMessage: error instanceof Error ? error.message : String(error)
      }));
      throw error;
    }
  }
}
