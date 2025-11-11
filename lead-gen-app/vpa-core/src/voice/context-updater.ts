/**
 * Helper utilities to keep the voice context cache in sync after tool calls.
 */

import { setVoiceContext, clearVoiceContext, type VoiceContextKey } from './context.js';

interface ProspectContext {
  prospectId?: string;
  name?: string;
  status?: string;
  lastInteraction?: string;
}

interface ActivityContext {
  activityId?: string;
  followUpId?: string;
  prospectId?: string;
  prospectName?: string;
  type?: string;
  notes?: string;
  followUp?: string;
}

interface SearchContext {
  querySummary: string;
  prospectIds?: string[];
  location?: string;
  industry?: string;
}

type ResearchAction =
  | 'add_source'
  | 'list_sources'
  | 'remove_source'
  | 'monitor'
  | 'digest'
  | 'on_demand'
  | 'update_source';

export interface ResearchContext {
  lastAction: ResearchAction;
  timestamp?: string;
  sourceId?: string;
  sourceLabel?: string;
  sourcesTracked?: number;
  digestHeadline?: string;
  updatesCount?: number;
  findingsCount?: number;
  topic?: string;
  lastMessage?: string;
}

const DEFAULT_PROSPECT_CONTEXT: ProspectContext = {};
const DEFAULT_ACTIVITY_CONTEXT: ActivityContext = {};
const DEFAULT_RESEARCH_CONTEXT: Omit<ResearchContext, 'lastAction'> = {};

export function captureProspectContext(
  userId: string,
  context: ProspectContext,
): void {
  setVoiceContext<ProspectContext>(userId, 'lastProspect', {
    ...DEFAULT_PROSPECT_CONTEXT,
    ...context,
    lastInteraction: context.lastInteraction || new Date().toISOString(),
  });
}

export function captureActivityContext(
  userId: string,
  context: ActivityContext,
): void {
  setVoiceContext<ActivityContext>(userId, 'lastActivity', {
    ...DEFAULT_ACTIVITY_CONTEXT,
    ...context,
  });

  if (context.prospectId) {
    captureProspectContext(userId, {
      prospectId: context.prospectId,
      name: context.prospectName,
    });
  }
}

export function captureSearchContext(
  userId: string,
  context: SearchContext,
): void {
  setVoiceContext<SearchContext>(userId, 'lastSearch', context);
}

export function captureResearchContext(
  userId: string,
  context: ResearchContext,
): void {
  setVoiceContext<ResearchContext>(userId, 'lastResearch', {
    ...DEFAULT_RESEARCH_CONTEXT,
    ...context,
    timestamp: context.timestamp ?? new Date().toISOString(),
  });
}

export function clearResearchContext(userId: string): void {
  clearVoiceContext(userId, 'lastResearch');
}

export function clearVoiceContextKey(userId: string, key: VoiceContextKey): void {
  clearVoiceContext(userId, key);
}
