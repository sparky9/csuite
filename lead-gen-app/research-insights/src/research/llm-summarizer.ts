import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger.js';

const anthropic = new Anthropic({
  apiKey: ((globalThis as any)?.process?.env?.ANTHROPIC_API_KEY as string | undefined) || ''
});

export interface IntelligentSummary {
  summary: string;
  keyInsights: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  urgency: 'high' | 'medium' | 'low';
  category: string[];
}

export async function generateIntelligentSummary(
  text: string,
  sourceLabel: string,
  previousSummary?: string
): Promise<IntelligentSummary> {
  try {
    const truncatedText = text.slice(0, 4000);
    const systemPrompt = `You are a business intelligence analyst specializing in competitive research and market insights.
Your task is to analyze content from monitored sources (competitors, industry blogs, news) and extract actionable insights for solopreneurs.`;

    const userPrompt = previousSummary
      ? `Source: ${sourceLabel}

Previous snapshot summary:
${previousSummary}

NEW CONTENT:
${truncatedText}

Analyze what's new compared to the previous snapshot.`
      : `Source: ${sourceLabel}

CONTENT:
${truncatedText}

Analyze this content from a competitive intelligence perspective.`;

    const message = await anthropic.messages.create({
      model: ((globalThis as any)?.process?.env?.ANTHROPIC_MODEL as string | undefined) || 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `${userPrompt}

Format as JSON with keys: summary, keyInsights, sentiment, urgency, category.`
        }
      ]
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse JSON from Claude response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      summary: parsed.summary || 'No summary available',
      keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights : [],
      sentiment: ['positive', 'neutral', 'negative'].includes(parsed.sentiment) ? parsed.sentiment : 'neutral',
      urgency: ['high', 'medium', 'low'].includes(parsed.urgency) ? parsed.urgency : 'low',
      category: Array.isArray(parsed.category) ? parsed.category : []
    };
  } catch (error) {
    logger.error('LLM summarization failed', { error, sourceLabel });
    return {
      summary: text.slice(0, 220).trim() + '...',
      keyInsights: [],
      sentiment: 'neutral',
      urgency: 'low',
      category: []
    };
  }
}

export async function generateDigestNarrative(
  updates: Array<{ sourceLabel: string; summary: string; urgency: string }>
): Promise<string> {
  try {
    if (!updates.length) {
      return 'No updates captured recently.';
    }

    const highUrgency = updates.filter((u) => u.urgency === 'high');
    const mediumUrgency = updates.filter((u) => u.urgency === 'medium');
    const lowUrgency = updates.filter((u) => u.urgency === 'low');

    const prompt = `You are a business analyst providing a morning briefing.
Summarize the following updates in 2-3 sentences, prioritizing urgent items.

High urgency:
${highUrgency.map((u) => `- ${u.sourceLabel}: ${u.summary}`).join('\n') || 'None'}

Medium urgency:
${mediumUrgency.map((u) => `- ${u.sourceLabel}: ${u.summary}`).join('\n') || 'None'}

Low urgency:
${lowUrgency.map((u) => `- ${u.sourceLabel}: ${u.summary}`).join('\n') || 'None'}`;

    const message = await anthropic.messages.create({
      model: ((globalThis as any)?.process?.env?.ANTHROPIC_MODEL as string | undefined) || 'claude-3-5-haiku-20241022',
      max_tokens: 256,
      temperature: 0.5,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      return 'Digest generation failed';
    }

    return content.text.trim();
  } catch (error) {
    logger.error('Digest narrative generation failed', { error });
    return `${updates.length} sources updated. Check details for more info.`;
  }
}
