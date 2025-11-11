import { BridgeEvent } from '../types.js';
import { ParsedIntent } from '../../intent-parser/keyword-parser.js';

export function createAssistantEvent(
  eventId: string,
  intent: ParsedIntent,
  result: any
): BridgeEvent {
  return {
    id: eventId,
    type: 'message',
    message: buildAssistantMessage(result),
    payload: {
      tool: intent.tool,
      action: intent.action,
      parameters: intent.parameters
    }
  };
}

function buildAssistantMessage(result: any) {
  const voiceHint = extractVoiceHint(result);
  const content = extractPrimaryContent(result);

  return {
    role: 'assistant' as const,
    content,
    voiceHint
  };
}

export function extractVoiceHint(result: any): string | undefined {
  if (result && typeof result === 'object' && result.voice) {
    const summary = result.voice.summary;
    const follow = result.voice.followUpHint;

    if (summary && follow) {
      return `${summary} ${follow}`;
    }

    if (summary) {
      return summary;
    }
  }

  return undefined;
}

export function extractPrimaryContent(result: any): string {
  if (result && typeof result === 'object') {
    if (Array.isArray(result.content)) {
      const textItem = result.content.find((item: any) => item?.type === 'text' && typeof item.text === 'string');
      if (textItem) {
        return textItem.text;
      }
    }

    if (typeof result.message === 'string') {
      return result.message;
    }
  }

  if (typeof result === 'string') {
    return result;
  }

  try {
    return JSON.stringify(result, null, 2);
  } catch (_error) {
    return 'Response ready (non-serializable result)';
  }
}
