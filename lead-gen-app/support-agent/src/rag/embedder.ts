/**
 * Local embedding wrapper powered by @xenova/transformers.
 */

import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';
import { RAG_EMBEDDING_MODEL } from './config.js';

let embedder: FeatureExtractionPipeline | null = null;

async function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (!embedder) {
    embedder = await pipeline('feature-extraction', RAG_EMBEDDING_MODEL, {
      quantized: true,
    });
  }
  return embedder;
}

function toNumberArray(value: unknown): number[] {
  if (ArrayBuffer.isView(value) && 'length' in value) {
    const typed = value as unknown as { length: number; [index: number]: number };
    const result = new Array<number>(typed.length);
    for (let i = 0; i < typed.length; i += 1) {
      result[i] = Number(typed[i]);
    }
    return result;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [];
    }
    const first = value[0];
    if (typeof first === 'number') {
      return value as number[];
    }
    if (Array.isArray(first) || ArrayBuffer.isView(first)) {
      return toNumberArray(first);
    }
  }
  if (typeof value === 'object' && value !== null) {
    if ('data' in (value as Record<string, unknown>)) {
      return toNumberArray((value as { data: unknown }).data);
    }
    if ('tolist' in (value as Record<string, unknown>)) {
      const list = (value as { tolist: () => unknown }).tolist();
      return toNumberArray(list);
    }
  }
  throw new Error('Unsupported embedding output format');
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const pipe = await getEmbedder();
  const embeddings: number[][] = [];

  for (const text of texts) {
    const result = await pipe(text, { pooling: 'mean', normalize: true });
    embeddings.push(toNumberArray(result));
  }

  return embeddings;
}
