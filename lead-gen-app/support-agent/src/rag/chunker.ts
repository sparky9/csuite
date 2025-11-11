/**
 * Chunk raw text into overlapping windows for embedding.
 */

import { RAG_CHUNK_SIZE, RAG_CHUNK_OVERLAP } from './config.js';

interface Chunk {
  content: string;
  position: number;
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function chunkText(text: string, size: number = RAG_CHUNK_SIZE, overlap: number = RAG_CHUNK_OVERLAP): Chunk[] {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return [];
  }

  const chunks: Chunk[] = [];
  let start = 0;
  let position = 0;

  while (start < normalized.length) {
    const end = Math.min(start + size, normalized.length);
    const content = normalized.slice(start, end);
    chunks.push({ content, position });
    if (end === normalized.length) {
      break;
    }
    start = Math.max(0, end - overlap);
    position += 1;
  }

  return chunks;
}
