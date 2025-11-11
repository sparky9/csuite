import { logger } from '../utils/logger.js';

export interface DiffSummary {
  hasChanges: boolean;
  changeRatio: number;
  highlights: string[];
}

function normalize(text: string | null | undefined): string {
  if (!text) {
    return '';
  }
  return text.replace(/\s+/g, ' ').trim();
}

export function computeDiffSummary(previous: string | null | undefined, current: string | null | undefined): DiffSummary {
  const prevText = normalize(previous);
  const currentText = normalize(current);

  if (!prevText) {
    return {
      hasChanges: Boolean(currentText.length),
      changeRatio: currentText.length ? 1 : 0,
      highlights: currentText ? [currentText.slice(0, 240)] : ['No previous snapshot to compare.']
    };
  }

  if (!currentText) {
    return {
      hasChanges: false,
      changeRatio: 0,
      highlights: ['No new content was captured.']
    };
  }

  try {
    const prevSentences = prevText.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
    const currentSentences = currentText.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean);

    const prevSet = new Set(prevSentences);
    const newHighlights: string[] = [];

    for (const sentence of currentSentences) {
      if (!prevSet.has(sentence) && newHighlights.length < 5) {
        newHighlights.push(sentence);
      }
    }

    const changeRatio = newHighlights.length / Math.max(currentSentences.length, 1);

    return {
      hasChanges: newHighlights.length > 0,
      changeRatio,
      highlights: newHighlights.length ? newHighlights : ['No meaningful differences detected.']
    };
  } catch (error) {
    logger.error('Failed to compute diff summary', { error });
    return {
      hasChanges: true,
      changeRatio: 1,
      highlights: [currentText.slice(0, 240)]
    };
  }
}
