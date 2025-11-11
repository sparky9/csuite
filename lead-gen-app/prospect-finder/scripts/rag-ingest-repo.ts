/**
 * Bulk-ingest key project folders into the local RAG store with helpful labels.
 */

import fs from 'node:fs';
import path from 'node:path';
import { ingestPath } from 'support-agent';
import { logger } from '../src/utils/logger.js';

interface IngestGroup {
  label: string;
  targetPath: string;
}

async function ingestGroup(group: IngestGroup): Promise<void> {
  const absolutePath = path.resolve(group.targetPath);
  if (!fs.existsSync(absolutePath)) {
    logger.warn('RAG bulk ingest: skipping missing path', {
      label: group.label,
      path: absolutePath,
    });
    return;
  }
  logger.info('RAG bulk ingest: starting group', {
    label: group.label,
    path: absolutePath,
  });

  const start = Date.now();
  await ingestPath(absolutePath, {
    sourceLabel: group.label,
  });
  const duration = Date.now() - start;

  logger.info('RAG bulk ingest: completed group', {
    label: group.label,
    path: absolutePath,
    duration_ms: duration,
  });
}

async function main() {
  const customTargets = process.argv.slice(2);

  let groups: IngestGroup[];

  if (customTargets.length > 0) {
    groups = customTargets.map((target, index) => ({
      label: `custom-${index + 1}`,
      targetPath: target,
    }));
  } else {
    groups = [
      { label: 'docs-root', targetPath: 'README.md' },
      { label: 'docs-guides', targetPath: 'docs' },
      { label: 'src', targetPath: 'src' },
      { label: 'scripts', targetPath: 'scripts' },
      { label: 'agents', targetPath: 'calendar-meeting-agent/src' },
      { label: 'email-orchestrator', targetPath: 'email-orchestrator/src' },
      { label: 'content-writer', targetPath: 'content-writer/src' },
      { label: 'vpa-core', targetPath: 'vpa-core/src' },
    ];
  }

  for (const group of groups) {
    await ingestGroup(group);
  }

  logger.info('RAG bulk ingestion complete');
}

main().catch((error) => {
  logger.error('RAG bulk ingestion failed', { error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
