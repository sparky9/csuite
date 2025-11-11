/**
 * Query interface for the local RAG store.
 */

import { embedTexts } from './embedder.js';
import { RagVectorStore } from './vector-store.js';
import { RAG_MAX_QUERY_RESULTS } from './config.js';
import type { RagQueryOptions, RagQueryResult } from './types.js';
import { logger } from '../utils/logger.js';

export interface RagQueryResponse {
  query: string;
  results: RagQueryResult[];
}

export async function queryRag(question: string, options: RagQueryOptions = {}): Promise<RagQueryResponse> {
  const store = new RagVectorStore();
  try {
    const [embedding] = await embedTexts([question]);
    const results = store.query(embedding, {
      topK: options.topK ?? RAG_MAX_QUERY_RESULTS,
      sourceFilter: options.sourceFilter,
      minScore: options.minScore,
    });
    if (results.length > 0) {
      logger.debug('RAG query results', {
        question,
        topScore: results[0]?.score,
        totalResults: results.length,
        sourceFilter: options.sourceFilter,
      });
    } else {
      logger.debug('RAG query returned no results', {
        question,
        sourceFilter: options.sourceFilter,
      });
    }
    return {
      query: question,
      results,
    };
  } finally {
    store.dispose();
  }
}
