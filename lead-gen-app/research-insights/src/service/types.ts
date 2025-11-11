export type ResearchSourceCategory = 'competitor' | 'industry' | 'trend' | 'custom';

export interface ResearchSourceInput {
  label: string;
  url: string;
  category?: ResearchSourceCategory;
  frequency?: string;
  notes?: string | null;
}

export interface ResearchSourceRecord {
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

export interface ResearchSnapshotRecord {
  id: string;
  sourceId: string;
  capturedAt: Date;
  contentHash: string;
  title: string | null;
  summary: string | null;
  highlights?: string[];
  metadata: Record<string, any>;
}

export interface DigestEntry {
  source: ResearchSourceRecord;
  snapshot: ResearchSnapshotRecord;
  diff?: import('../research/diff.js').DiffSummary;
}
