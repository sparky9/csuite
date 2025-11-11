export { db } from './db/client.js';
export {
  createResearchSource,
  updateResearchSource,
  listResearchSources,
  getResearchSource,
  deleteResearchSource,
  recordSnapshot,
  getLatestSnapshot,
  listRecentSnapshots,
  hashContent,
  sourceHasChanges
} from './db/research.js';
export type {
  ResearchSource,
  ResearchSnapshot,
  CreateSourceInput,
  SnapshotInput
} from './db/research.js';

export { captureSource, hashText } from './research/capture.js';
export { computeDiffSummary } from './research/diff.js';
export { buildDigestSummary } from './research/summarize.js';
export {
  generateIntelligentSummary,
  generateDigestNarrative
} from './research/llm-summarizer.js';
export {
  getSourcesDueForCheck,
  getFrequencyInterval,
  getFrequencyDescription,
  getValidFrequencies,
  isValidFrequency
} from './research/scheduler.js';

export { buildVoiceSummary } from './voice/format.js';
export { logger, logError } from './utils/logger.js';

export type {
  ResearchSourceCategory,
  ResearchSourceInput,
  ResearchSourceRecord,
  ResearchSnapshotRecord,
  DigestEntry
} from './service/types.js';
export type { DiffSummary } from './research/diff.js';
export type { SourceDueForCheck } from './research/scheduler.js';
export type { CaptureResult } from './research/types.js';
export type { IntelligentSummary } from './research/llm-summarizer.js';
