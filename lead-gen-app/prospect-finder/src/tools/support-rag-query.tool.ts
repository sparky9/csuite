/**
 * support_rag_query tool implementation
 *
 * Provides MCP access to the local RAG store so support agents can
 * retrieve grounded knowledge snippets when answering customer tickets.
 */

import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { queryRag, RAG_MAX_QUERY_RESULTS, type RagQueryResult } from 'support-agent';

const SupportRagQuerySchema = z.object({
  question: z.string().min(3, 'Please provide a question or summary to search.'),
  top_k: z.number().int().min(1).max(RAG_MAX_QUERY_RESULTS).optional(),
  min_score: z.number().min(-1).max(1).optional(),
  source_filter: z.union([z.string(), z.array(z.string())]).optional(),
});

function formatResultSnippet(content: string, maxLength = 400): string {
  const trimmed = content.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength)}...`;
}

export async function supportRagQueryTool(args: unknown) {
  const params = SupportRagQuerySchema.parse(args ?? {});

  logger.info('support_rag_query invoked', params);

  const response = await queryRag(params.question, {
    topK: params.top_k,
    minScore: params.min_score,
    sourceFilter: params.source_filter,
  });

  if (response.results.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: `No knowledge chunks matched "${params.question}".\n\nTips:\n- Rephrase the question with more context\n- Ensure the relevant documents have been ingested into the RAG store`,
        },
      ],
    };
  }

  const lines: string[] = [];
  lines.push('Support Knowledge Search');
  lines.push('');
  lines.push(`Question: ${params.question}`);
  lines.push(`Results: ${response.results.length}`);
  if (params.min_score !== undefined) {
    lines.push(`Min Score: ${params.min_score}`);
  }
  if (params.source_filter) {
    const sources = Array.isArray(params.source_filter)
      ? params.source_filter.join(', ')
      : params.source_filter;
    lines.push(`Source Filter: ${sources}`);
  }
  lines.push('');
  lines.push('Top Matches:');

  response.results.forEach((result: RagQueryResult, index: number) => {
    const chunkMeta = result.metadata ?? {};
    const docMeta = result.documentMetadata ?? {};
    const location = (docMeta.file_path as string | undefined) ?? result.documentId;
    const position = chunkMeta.position ?? result.position;
    lines.push(`${index + 1}. Score ${(result.score * 100).toFixed(1)}% — ${result.documentSource}`);
    lines.push(`   Location: ${location} (chunk ${position})`);
    lines.push(`   Snippet: ${formatResultSnippet(result.content)}`);
    lines.push('');
  });

  lines.push('Raw JSON:');
  lines.push('```json');
  lines.push(JSON.stringify(response, null, 2));
  lines.push('```');

  return {
    content: [
      {
        type: 'text',
        text: lines.join('\n'),
      },
    ],
  };
}
