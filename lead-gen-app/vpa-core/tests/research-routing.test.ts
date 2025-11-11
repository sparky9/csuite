import test from 'node:test';
import assert from 'node:assert/strict';
import { keywordParser } from '../src/intent-parser/keyword-parser.ts';
import {
  executeVPATool,
  __setResearchInsightsModule,
  __resetResearchInsightsModule
} from '../src/orchestrator.ts';
import { getVoiceContext, clearVoiceContext } from '../src/voice/context.ts';

class MockResearchInsightsModule {
  public calls: Array<{ method: string; params: any; userId: string }> = [];
  public listResponse: any = null;
  public monitorResponse: any = null;
  public digestResponse: any = null;

  resetOverrides() {
    this.listResponse = null;
    this.monitorResponse = null;
    this.digestResponse = null;
  }

  private record(method: string, params: any, userId: string) {
    this.calls.push({ method, params, userId });
  }

  async addSource(params: any, userId: string) {
    this.record('addSource', params, userId);
    return {
      status: 'success',
      message: `Monitoring ${params?.label ?? 'source'} added`,
      source: {
        id: params?.sourceId ?? 'src-add',
        label: params?.label ?? 'Unnamed',
        url: params?.url ?? 'https://example.com',
      },
      userId,
    };
  }

  async listSources(userId: string) {
    this.record('listSources', {}, userId);
    if (this.listResponse) {
      return this.listResponse;
    }

    return {
      status: 'success',
      sources: [
        {
          id: 'src-1',
          label: 'StartupX',
          url: 'https://startupx.com/blog',
          category: 'competitor',
          lastSnapshot: null,
        }
      ],
      userId,
    };
  }

  async removeSource(params: any, userId: string) {
    this.record('removeSource', params, userId);
    return {
      status: 'success',
      message: `Stopped monitoring ${params?.sourceId ?? 'unknown source'}`,
      removed: params?.sourceId,
      userId,
    };
  }

  async runMonitor(params: any, userId: string) {
    this.record('runMonitor', params, userId);
    if (this.monitorResponse) {
      return this.monitorResponse;
    }

    return {
      status: 'success',
      message: 'No notable changes detected',
      updates: [
        {
          source: { id: 'src-1', label: 'StartupX' },
          snapshot: { id: 'snap-1', capturedAt: new Date().toISOString() },
          diff: { hasChanges: true, highlights: ['Updated pricing page'] },
        }
      ],
      digest: { headline: 'StartupX tweaked their pricing', entries: [] },
      params,
      userId,
    };
  }

  async getDigest(userId: string, params?: any) {
    this.record('getDigest', params, userId);
    if (this.digestResponse) {
      return this.digestResponse;
    }

    return {
      status: 'success',
      digest: { headline: 'Weekly digest ready', entries: 3 },
      entries: [
        {
          source: { id: 'src-1', label: 'StartupX' },
          snapshot: { id: 'snap-1', capturedAt: new Date().toISOString() },
        }
      ],
      params,
      userId,
    };
  }

  async researchOnDemand(params: any, userId: string) {
    this.record('researchOnDemand', params, userId);
    return {
      status: 'success',
      topic: params?.topic,
      findings: [
        { url: 'https://example.com', summary: 'Summary', highlights: [] },
      ],
    };
  }

  async updateSource(params: any, userId: string) {
    this.record('updateSource', params, userId);
    return {
      status: 'success',
      message: `Updated ${params?.sourceId}`,
      source: { id: params?.sourceId, label: params?.label ?? 'Updated' },
      userId,
    };
  }
}

const mockModule = new MockResearchInsightsModule();
__setResearchInsightsModule(mockModule as any);

test.beforeEach(() => {
  mockModule.calls = [];
  mockModule.resetOverrides();
  clearVoiceContext('user-123');
  clearVoiceContext('user-ctx');
  clearVoiceContext('user-abc');
  clearVoiceContext('user-111');
});

test.after(() => {
  __resetResearchInsightsModule();
});

test('keyword parser adds competitor with url', () => {
  const intent = keywordParser('Add competitor StartupX at startupx.com/blog');
  assert.ok(intent, 'expected keyword parser to match command');
  assert.equal(intent?.tool, 'vpa_research');
  assert.equal(intent?.action, 'add_source');
  assert.equal(intent?.parameters?.url, 'https://startupx.com/blog');
  assert.equal(intent?.parameters?.label, 'StartupX');
});

test('executeVPATool routes monitor command to research module', async () => {
  const result = await executeVPATool('vpa_research', 'monitor', { force: true }, 'user-123');
  assert.equal(result.status, 'success');
  assert.deepEqual(result.params, { force: true });

  const call = mockModule.calls.find((entry) => entry.method === 'runMonitor');
  assert.ok(call, 'expected runMonitor to be invoked');
  assert.equal(call?.userId, 'user-123');
  assert.deepEqual(call?.params, { force: true });

  const context = getVoiceContext<any>('user-123', 'lastResearch');
  assert.ok(context, 'expected research context to be captured');
  assert.equal(context.lastAction, 'monitor');
  assert.equal(context.updatesCount, 1);
  assert.equal(context.sourceLabel, 'StartupX');
});

test('executeVPATool rejects unknown research action', async () => {
  await assert.rejects(
    executeVPATool('vpa_research', 'unknown_action', {}, 'user-xyz'),
    /unknown_action/i
  );
});

test('executeVPATool routes update command to research module', async () => {
  const result = await executeVPATool('vpa_research', 'update_source', { sourceId: 'abc', label: 'Fresh Name' }, 'user-111');
  assert.equal(result.status, 'success');

  const call = mockModule.calls.find((entry) => entry.method === 'updateSource');
  assert.ok(call, 'expected updateSource to be invoked');
  assert.equal(call?.userId, 'user-111');
  assert.deepEqual(call?.params, { sourceId: 'abc', label: 'Fresh Name' });

  const context = getVoiceContext<any>('user-111', 'lastResearch');
  assert.ok(context, 'expected context for update');
  assert.equal(context.lastAction, 'update_source');
  assert.equal(context.sourceId, 'abc');
  assert.equal(context.sourceLabel, 'Fresh Name');
});

test('capture research context after adding source', async () => {
  await executeVPATool('vpa_research', 'add_source', { label: 'Acme Labs', url: 'acme.com' }, 'user-ctx');

  const context = getVoiceContext<any>('user-ctx', 'lastResearch');
  assert.ok(context, 'expected context to be present');
  assert.equal(context.lastAction, 'add_source');
  assert.equal(context.sourceLabel, 'Acme Labs');
});

test('clears research context when no sources remain', async () => {
  mockModule.listResponse = { status: 'success', sources: [] };

  await executeVPATool('vpa_research', 'list_sources', {}, 'user-abc');

  const context = getVoiceContext<any>('user-abc', 'lastResearch');
  assert.equal(context, undefined);
});
