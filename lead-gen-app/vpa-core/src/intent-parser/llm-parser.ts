/**
 * LLM-Based Intent Parser
 *
 * Fallback parser using Claude API for complex queries that keyword matching can't handle.
 * Used when keyword parser confidence is low or returns null.
 * Cost: ~$0.001 per parse (acceptable for 20% of commands).
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger, logError } from '../utils/logger.js';
import { ConfigurationError } from '../utils/errors.js';
import type { ParsedIntent } from './keyword-parser.js';

/**
 * LLM parser using Claude API
 */
export async function llmParser(command: string, userId: string): Promise<ParsedIntent> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ConfigurationError(
      'ANTHROPIC_API_KEY',
      'ANTHROPIC_API_KEY environment variable is not set'
    );
  }

  const anthropic = new Anthropic({ apiKey });

  const prompt = buildIntentParsingPrompt(command);

  try {
    const startTime = Date.now();

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      temperature: 0, // Deterministic parsing
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const executionTime = Date.now() - startTime;

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude API');
    }

    // Parse JSON response
    const parsed = parseClaudeResponse(content.text);

    logger.info('LLM intent parsing completed', {
      userId,
      command,
      tool: parsed.tool,
      action: parsed.action,
      executionTime
    });

    return {
      ...parsed,
      confidence: 1.0 // LLM parsing is always high confidence
    };
  } catch (error) {
    logError('LLM intent parsing failed', error, { userId, command });
    throw error;
  }
}

/**
 * Build the prompt for Claude
 */
function buildIntentParsingPrompt(command: string): string {
  return `You are an intent parser for a VPA (Virtual Personal Assistant) system.

Parse this user command into a structured intent:
"${command}"

Available tools and their actions:

1. vpa_prospects (B2B prospect finding):
   - search: Find companies by industry/location
   - find_contacts: Find decision makers at companies
   - enrich: Enrich company data
   - export: Export prospects
   - stats: Get scraping statistics

2. vpa_pipeline (CRM pipeline management):
   - add: Add a new prospect
   - update: Update prospect status
   - search: Search prospects in pipeline
   - log_activity: Log calls, emails, notes
   - follow_ups: Get upcoming follow-ups
   - stats: Get pipeline statistics
   - import: Import prospects into pipeline

3. vpa_email (Email campaigns):
   - create_campaign: Create new email campaign
   - add_sequence: Add email sequence to campaign
   - start: Start a campaign
   - send_one: Send single email
   - stats: Get campaign statistics
   - pause: Pause/resume campaign
   - history: Get email history

4. vpa_status (System status):
   - modules: Show enabled modules
   - usage: Show usage statistics
   - subscription: Show subscription info
   - health: Check system health

5. vpa_configure (Settings):
   - set: Change a configuration setting

Respond with ONLY valid JSON in this exact format:
{
  "tool": "vpa_prospects",
  "action": "search",
  "parameters": {
    "industry": "hvac",
    "location": "Dallas, TX",
    "max_results": 50
  }
}

Extract as many parameters as possible from the command. If the command is ambiguous, make the best inference.`;
}

/**
 * Parse Claude's JSON response
 */
function parseClaudeResponse(responseText: string): Omit<ParsedIntent, 'confidence'> {
  try {
    // Remove markdown code blocks if present
    let cleaned = responseText.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/```\n?/g, '');
    }

    const parsed = JSON.parse(cleaned);

    // Validate required fields
    if (!parsed.tool || !parsed.action) {
      throw new Error('Missing required fields: tool and action');
    }

    return {
      tool: parsed.tool,
      action: parsed.action,
      parameters: parsed.parameters || {}
    };
  } catch (error) {
    logError('Failed to parse Claude response', error, { responseText });
    throw new Error('Invalid response format from LLM parser');
  }
}

/**
 * Validate parsed intent (ensure it matches known tools/actions)
 */
function validateParsedIntent(intent: Omit<ParsedIntent, 'confidence'>): boolean {
  const validTools = [
    'vpa_prospects',
    'vpa_pipeline',
    'vpa_email',
    'vpa_status',
    'vpa_configure'
  ];

  if (!validTools.includes(intent.tool)) {
    return false;
  }

  // Add more validation as needed
  return true;
}
