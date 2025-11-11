/**
 * Voice Response Formatting
 *
 * Keeps spoken responses short, friendly, and actionable while preserving the
 * full text response for desktop clients.
 */

export interface VoiceResponseShape {
  summary: string;
  followUpHint?: string;
}

export function buildVoiceSummary(summary: string, followUpHint?: string): VoiceResponseShape {
  return { summary, followUpHint };
}

export function attachVoiceMetadata<T extends { content: any[] }>(
  result: T,
  metadata: VoiceResponseShape | undefined,
): T {
  if (!metadata) {
    return result;
  }

  return {
    ...result,
    voice: metadata,
  } as T & { voice: VoiceResponseShape };
}
