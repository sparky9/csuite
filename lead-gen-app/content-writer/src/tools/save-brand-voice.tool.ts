/**
 * MCP Tool: Save Brand Voice
 * Store brand voice preferences per client
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { saveBrandVoiceSchema } from '../utils/validation.js';
import { logger } from '../utils/logger.js';
import type { SaveBrandVoiceParams, BrandVoiceResult, BrandVoiceProfile } from '../types/content.types.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const BRAND_VOICES_FILE = path.join(DATA_DIR, 'brand-voices.json');

/**
 * Ensure data directory and file exist
 */
function ensureDataFile(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(BRAND_VOICES_FILE)) {
    fs.writeFileSync(BRAND_VOICES_FILE, JSON.stringify({ voices: [] }, null, 2));
  }
}

/**
 * Load brand voices from file
 */
function loadBrandVoices(): BrandVoiceProfile[] {
  ensureDataFile();
  const data = fs.readFileSync(BRAND_VOICES_FILE, 'utf-8');
  const parsed = JSON.parse(data);
  return parsed.voices || [];
}

/**
 * Save brand voices to file
 */
function saveBrandVoices(voices: BrandVoiceProfile[]): void {
  ensureDataFile();
  fs.writeFileSync(
    BRAND_VOICES_FILE,
    JSON.stringify({ voices }, null, 2)
  );
}

export const saveBrandVoiceTool: Tool = {
  name: 'save_brand_voice',
  description: `Store brand voice preferences for a client.

Save voice profiles to use for consistent content generation across campaigns.

Required parameters:
- user_id: User ID for multi-tenant support
- client_id: Client identifier
- voice_name: Descriptive name for this voice profile
- tone: Brand tone (professional, casual, witty, authoritative, friendly)

Optional parameters:
- vocabulary_preferences: Array of preferred terms/phrases
- avoid_words: Array of words to avoid
- sample_text: Example text demonstrating the desired voice

Returns:
- voiceProfileId: Generated UUID for the profile
- clientId: Client ID
- voiceName: Voice profile name
- tone: Brand tone
- created: Boolean indicating success

Example:
{
  "user_id": "user-123",
  "client_id": "acme-corp",
  "voice_name": "Acme Corp Professional",
  "tone": "professional",
  "vocabulary_preferences": ["innovative", "cutting-edge", "solutions"],
  "avoid_words": ["cheap", "discount"]
}`,
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User ID (required)' },
      client_id: { type: 'string', description: 'Client identifier' },
      voice_name: { type: 'string', description: 'Voice profile name' },
      tone: {
        type: 'string',
        enum: ['professional', 'casual', 'witty', 'authoritative', 'friendly'],
        description: 'Brand tone',
      },
      vocabulary_preferences: {
        type: 'array',
        items: { type: 'string' },
        description: 'Preferred terms (optional)',
      },
      avoid_words: {
        type: 'array',
        items: { type: 'string' },
        description: 'Words to avoid (optional)',
      },
      sample_text: {
        type: 'string',
        description: 'Example text (optional)',
      },
    },
    required: ['user_id', 'client_id', 'voice_name', 'tone'],
  },
};

export async function handleSaveBrandVoice(args: unknown, userId?: string) {
  const startTime = Date.now();

  try {
    // Validate parameters
    const params = saveBrandVoiceSchema.parse(args) as SaveBrandVoiceParams;

    logger.info('Saving brand voice', {
      userId: params.user_id || userId,
      clientId: params.client_id,
      voiceName: params.voice_name,
      tone: params.tone,
    });

    // Load existing voices
    const voices = loadBrandVoices();

    // Check if voice already exists for this client
    const existingIndex = voices.findIndex(
      v => v.userId === params.user_id && v.clientId === params.client_id && v.voiceName === params.voice_name
    );

    const voiceProfileId = existingIndex >= 0 ? voices[existingIndex].voiceProfileId : randomUUID();
    const now = new Date().toISOString();

    const voiceProfile: BrandVoiceProfile = {
      voiceProfileId,
      userId: params.user_id,
      clientId: params.client_id,
      voiceName: params.voice_name,
      tone: params.tone,
      vocabularyPreferences: params.vocabulary_preferences,
      avoidWords: params.avoid_words,
      sampleText: params.sample_text,
      createdAt: existingIndex >= 0 ? voices[existingIndex].createdAt : now,
      updatedAt: now,
    };

    // Update or add voice profile
    if (existingIndex >= 0) {
      voices[existingIndex] = voiceProfile;
      logger.info('Updated existing brand voice', { voiceProfileId });
    } else {
      voices.push(voiceProfile);
      logger.info('Created new brand voice', { voiceProfileId });
    }

    // Save to file
    saveBrandVoices(voices);

    const duration = Date.now() - startTime;

    logger.info('Brand voice saved successfully', {
      userId: params.user_id || userId,
      durationMs: duration,
      voiceProfileId,
    });

    const result: BrandVoiceResult = {
      voiceProfileId,
      clientId: params.client_id,
      voiceName: params.voice_name,
      tone: params.tone,
      created: true,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              brandVoice: result,
              metadata: {
                isUpdate: existingIndex >= 0,
                generation_time_ms: duration,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    logger.error('save_brand_voice tool failed', {
      error: error.message,
      durationMs: duration,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: error.message,
              tool: 'save_brand_voice',
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}
