/**
 * Voice Response helpers.
 */

export interface VoiceResponseShape {
  summary: string;
  followUpHint?: string;
}

export function buildVoiceSummary(summary: string, followUpHint?: string): VoiceResponseShape {
  return { summary, followUpHint };
}
