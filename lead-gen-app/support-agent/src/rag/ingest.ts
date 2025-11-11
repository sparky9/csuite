/**
 * File ingestion pipeline for the local RAG store.
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chunkText } from './chunker.js';
import { embedTexts } from './embedder.js';
import { RagVectorStore } from './vector-store.js';
import { RAG_ALLOWED_EXTENSIONS } from './config.js';
import type { RagChunk, RagDocument } from './types.js';

function generateId(seed: string): string {
  return crypto.createHash('sha256').update(seed).digest('hex');
}

async function readFileIfSupported(filePath: string): Promise<string | null> {
  const extension = path.extname(filePath).toLowerCase();
  if (!RAG_ALLOWED_EXTENSIONS.has(extension)) {
    return null;
  }

  const data = await fs.readFile(filePath, 'utf8');
  if (extension === '.json') {
    const parsed = JSON.parse(data) as unknown;
    return JSON.stringify(parsed, null, 2);
  }
  return data;
}

async function walkFiles(targetPath: string): Promise<string[]> {
  const stats = await fs.stat(targetPath);
  if (stats.isFile()) {
    return [targetPath];
  }

  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

export interface IngestOptions {
  sourceLabel?: string;
  metadata?: Record<string, unknown>;
}

export async function ingestPath(targetPath: string, options: IngestOptions = {}): Promise<void> {
  const resolvedPath = path.resolve(targetPath);
  const store = new RagVectorStore();

  try {
    const files = await walkFiles(resolvedPath);
    for (const file of files) {
      const content = await readFileIfSupported(file);
      if (!content) {
        continue;
      }
      await ingestContent(store, file, content, options);
    }
  } finally {
    store.dispose();
  }
}

export async function ingestSingleFile(filePath: string, options: IngestOptions = {}): Promise<void> {
  const store = new RagVectorStore();
  try {
    const content = await readFileIfSupported(filePath);
    if (content) {
      await ingestContent(store, filePath, content, options);
    }
  } finally {
    store.dispose();
  }
}

async function ingestContent(
  store: RagVectorStore,
  filePath: string,
  content: string,
  options: IngestOptions,
): Promise<void> {
  const documentId = generateId(path.resolve(filePath));
  const document: RagDocument = {
    id: documentId,
    source: options.sourceLabel ?? path.relative(process.cwd(), filePath),
    metadata: {
      ...(options.metadata ?? {}),
      file_path: path.resolve(filePath),
      ingested_at: new Date().toISOString(),
    },
  };

  const chunks = chunkText(content);
  if (chunks.length === 0) {
    return;
  }

  const embeddings = await embedTexts(chunks.map((chunk) => chunk.content));

  const ragChunks: RagChunk[] = chunks.map((chunk, index) => ({
    id: generateId(`${documentId}:${index}`),
    documentId: document.id,
    content: chunk.content,
    position: chunk.position,
    metadata: {
      position: chunk.position,
      char_length: chunk.content.length,
    },
    embedding: embeddings[index],
  }));

  store.upsertDocument(document, ragChunks);
}
