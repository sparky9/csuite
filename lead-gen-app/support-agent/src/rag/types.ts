/**
 * Shared RAG domain types.
 */

export interface RagDocument {
  id: string;
  source: string;
  metadata?: Record<string, unknown>;
}

export interface RagChunk {
  id: string;
  documentId: string;
  content: string;
  position: number;
  metadata?: Record<string, unknown>;
  embedding: number[];
}

export interface RagQueryOptions {
  topK?: number;
  sourceFilter?: string | string[];
  minScore?: number;
}

export interface RagQueryResult extends RagChunk {
  score: number;
  documentSource: string;
  documentMetadata?: Record<string, unknown>;
}
