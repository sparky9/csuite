/**
 * Configuration helpers for the support agent's local RAG store.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const RAG_DB_PATH = process.env.RAG_DB_PATH
  ? path.resolve(process.env.RAG_DB_PATH)
  : path.join(projectRoot, '..', 'data', 'rag-store.sqlite');

export const RAG_EMBEDDING_MODEL = process.env.RAG_EMBEDDING_MODEL ?? 'Xenova/all-MiniLM-L6-v2';
export const RAG_CHUNK_SIZE = Number.parseInt(process.env.RAG_CHUNK_SIZE ?? '800', 10);
export const RAG_CHUNK_OVERLAP = Number.parseInt(process.env.RAG_CHUNK_OVERLAP ?? '150', 10);
export const RAG_MAX_QUERY_RESULTS = Number.parseInt(process.env.RAG_MAX_QUERY_RESULTS ?? '8', 10);

export const RAG_ALLOWED_EXTENSIONS = new Set([
  '.md',
  '.mdx',
  '.txt',
  '.json',
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
]);

export function ensureDataDir(): string {
  const dir = path.dirname(RAG_DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}
