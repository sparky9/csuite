import type { DigestEntry } from '../service/types.js';

interface BuildDigestOptions {
  limit?: number;
}

export interface DigestSummary {
  headline: string;
  highlights: Array<{ source: string; summary: string }>;
}

export function buildDigestSummary(entries: DigestEntry[], options: BuildDigestOptions = {}): DigestSummary {
  const limit = options.limit ?? 5;
  const truncated = entries.slice(0, limit);

  if (!truncated.length) {
    return {
      headline: 'No updates captured yet.',
      highlights: []
    };
  }

  const highlights = truncated.map((entry) => ({
    source: entry.source.label,
    summary: entry.snapshot.summary || entry.diff?.highlights?.[0] || 'No summary available.'
  }));

  const headline = truncated.length === 1
    ? `${truncated[0]?.source.label} has one notable update.`
    : `${truncated.length} sources have notable updates.`;

  return {
    headline,
    highlights
  };
}
