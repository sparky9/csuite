/**
 * Lightweight SQLite-backed vector store for local RAG.
 */

import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { RAG_DB_PATH } from './config.js';
import type { RagChunk, RagDocument, RagQueryOptions, RagQueryResult } from './types.js';

function ensureDirectory(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export class RagVectorStore {
  private db: Database.Database;

  constructor(dbPath: string = RAG_DB_PATH) {
    ensureDirectory(dbPath);
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.setup();
  }

  private setup(): void {
    const createDocuments = `
      CREATE TABLE IF NOT EXISTS rag_documents (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createChunks = `
      CREATE TABLE IF NOT EXISTS rag_chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT,
        embedding TEXT NOT NULL,
        FOREIGN KEY(document_id) REFERENCES rag_documents(id) ON DELETE CASCADE
      );
    `;

    const createIndex = `
      CREATE INDEX IF NOT EXISTS idx_rag_chunks_document ON rag_chunks(document_id);
    `;

    this.db.exec(`${createDocuments}${createChunks}${createIndex}`);
  }

  dispose(): void {
    this.db.close();
  }

  deleteDocument(documentId: string): void {
    const statement = this.db.prepare('DELETE FROM rag_documents WHERE id = ?');
    statement.run(documentId);
  }

  upsertDocument(document: RagDocument, chunks: RagChunk[]): void {
    const transaction = this.db.transaction(() => {
      this.db.prepare(
        `INSERT INTO rag_documents (id, source, metadata)
         VALUES (@id, @source, @metadata)
         ON CONFLICT(id) DO UPDATE SET source=excluded.source, metadata=excluded.metadata`
      ).run({
        id: document.id,
        source: document.source,
        metadata: document.metadata ? JSON.stringify(document.metadata) : null,
      });

      this.db.prepare('DELETE FROM rag_chunks WHERE document_id = ?').run(document.id);

      const insertChunk = this.db.prepare(
        `INSERT INTO rag_chunks (id, document_id, position, content, metadata, embedding)
         VALUES (@id, @documentId, @position, @content, @metadata, @embedding)`
      );

      const chunkRows = chunks.map((chunk) => ({
        id: chunk.id,
        documentId: chunk.documentId,
        position: chunk.position,
        content: chunk.content,
        metadata: chunk.metadata ? JSON.stringify(chunk.metadata) : null,
        embedding: JSON.stringify(chunk.embedding),
      }));

      for (const row of chunkRows) {
        insertChunk.run(row);
      }
    });

    transaction();
  }

  listDocuments(): RagDocument[] {
    type DocumentRow = { id: string; source: string; metadata: string | null };

    const statement = this.db.prepare<[], DocumentRow>(
      'SELECT id, source, metadata FROM rag_documents ORDER BY created_at DESC'
    );
    const rows = statement.all();
    return rows.map((row: DocumentRow): RagDocument => ({
      id: row.id,
      source: row.source,
      metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : undefined,
    }));
  }

  query(embedding: number[], options: RagQueryOptions = {}): RagQueryResult[] {
    const topK = options.topK ?? 8;
    const minScore = options.minScore ?? 0;

    const rows = this.db
      .prepare<
        [],
        {
          id: string;
          document_id: string;
          position: number;
          content: string;
          metadata: string | null;
          embedding: string;
          source: string;
          document_metadata: string | null;
        }
      >(
        `SELECT c.id, c.document_id, c.position, c.content, c.metadata, c.embedding, d.source, d.metadata AS document_metadata
         FROM rag_chunks c
         JOIN rag_documents d ON c.document_id = d.id`
      )
      .all();

    const results: RagQueryResult[] = [];

    const filterSources = options.sourceFilter
      ? new Set(Array.isArray(options.sourceFilter) ? options.sourceFilter : [options.sourceFilter])
      : null;

    for (const row of rows) {
      if (filterSources && !filterSources.has(row.source)) {
        continue;
      }

      const chunkEmbedding = JSON.parse(row.embedding) as number[];
      const score = cosineSimilarity(embedding, chunkEmbedding);
      if (Number.isNaN(score) || score < minScore) {
        continue;
      }

      results.push({
        id: row.id,
        documentId: row.document_id,
        position: row.position,
        content: row.content,
        metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : undefined,
        embedding: chunkEmbedding,
        score,
        documentSource: row.source,
        documentMetadata: row.document_metadata
          ? (JSON.parse(row.document_metadata) as Record<string, unknown>)
          : undefined,
      });
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embedding vectors must have equal length');
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / Math.sqrt(normA * normB);
}
