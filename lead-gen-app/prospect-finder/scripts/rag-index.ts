/**
 * CLI helper to ingest local documents into the RAG store.
 */

import { ingestPath, ingestSingleFile } from 'support-agent';
import { logger } from '../src/utils/logger.js';

async function main() {
  const target = process.argv[2];
  if (!target) {
    throw new Error('Usage: npm run rag:index <file-or-directory>');
  }

  logger.info('Starting RAG ingestion', { target });

  const start = Date.now();
  if (target.endsWith('.md') || target.endsWith('.mdx') || target.endsWith('.txt') || target.endsWith('.json')) {
    await ingestSingleFile(target);
  } else {
    await ingestPath(target);
  }

  const duration = Date.now() - start;
  logger.info('RAG ingestion complete', { target, duration_ms: duration });
}

main().catch((error) => {
  logger.error('RAG ingestion failed', { error: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
