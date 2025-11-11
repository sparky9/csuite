#!/usr/bin/env tsx
import dotenv from 'dotenv';
import { ensureDataDir, RAG_DB_PATH } from '../src/rag/config.js';
import { RagVectorStore } from '../src/rag/vector-store.js';

dotenv.config();

async function main(): Promise<void> {
  console.log('Support Agent RAG Database Setup');
  console.log('================================\n');

  ensureDataDir();

  const store = new RagVectorStore();
  store.dispose();

  console.log(`SQLite database ready at: ${RAG_DB_PATH}`);
  console.log('\nNext steps:');
  console.log('1. Ingest documentation with your preferred scripts.');
  console.log('2. Run `npm run smoke:test` to verify mock responses.');
  console.log('3. Start the MCP server with `npm run dev` or build + `npm start`.');
}

main().catch((error) => {
  console.error('Failed to initialize RAG database');
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
