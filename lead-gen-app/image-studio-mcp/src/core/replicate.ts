/**
 * Replicate API wrapper for Image Studio
 */

import Replicate from 'replicate';
import sharp from 'sharp';
import path from 'node:path';
import {
  DEFAULT_OPTIONS,
  DEFAULT_PROMPT_MODEL,
  DEFAULT_STAGING_MODEL,
  DEFAULT_TRANSFORM_MODEL,
  COST_PER_IMAGE_STAGING,
  COST_PER_IMAGE_PROMPT,
  COST_PER_IMAGE_TRANSFORM,
  type ReplicateModelIdentifier,
} from '../config/constants.js';
import { getStylePrompt } from '../utils/stylePresets.js';
import type {
  PromptGenerationOptions,
  StagingOptions,
  TransformOptions,
} from '../types/index.js';

export interface ReplicateGenerationResult {
  url: string;
  cost: number;
  processingTime: number;
}

export class ReplicateClient {
  private client: Replicate;

  constructor(apiToken: string) {
    if (!apiToken) {
      throw new Error('REPLICATE_API_TOKEN is required');
    }
    this.client = new Replicate({ auth: apiToken });
  }

  private resolveModel(
    model: string | undefined,
    fallback: ReplicateModelIdentifier,
  ): ReplicateModelIdentifier {
    return (model ?? fallback) as ReplicateModelIdentifier;
  }

  private normaliseOutput(output: unknown): string {
    if (typeof output === 'string') {
      return output;
    }
    if (Array.isArray(output) && output.length > 0) {
      const first = output[0];
      if (typeof first === 'string') {
        return first;
      }
    }
    throw new Error('Unexpected Replicate output format');
  }

  async stageImage(
    imageBuffer: Buffer,
    sourcePath: string,
    options: StagingOptions,
  ): Promise<ReplicateGenerationResult> {
    const start = Date.now();
    const prompt = this.buildStagingPrompt(options);
    const payload = await this.prepareImagePayload(imageBuffer, sourcePath);
    const identifier = DEFAULT_STAGING_MODEL;
    const input = this.buildStagingInput(identifier, prompt, options, payload);

    const result = await this.client.run(identifier, { input });

    const processingTime = (Date.now() - start) / 1000;
    const url = this.normaliseOutput(result);

    return {
      url,
      cost: (options.numSamples ?? DEFAULT_OPTIONS.numSamples) * COST_PER_IMAGE_STAGING,
      processingTime,
    };
  }

  async generateFromPrompt(
    options: PromptGenerationOptions,
  ): Promise<ReplicateGenerationResult> {
    const start = Date.now();
    const model = this.resolveModel(options.model, DEFAULT_PROMPT_MODEL);

    const result = await this.client.run(model, {
      input: {
        prompt: options.prompt,
        ...(options.imageResolution ? { image_resolution: options.imageResolution } : {}),
        ...(options.numSamples ? { num_outputs: options.numSamples } : {}),
        ...(options.seed ? { seed: options.seed } : {}),
        ...(options.negativePrompt ? { negative_prompt: options.negativePrompt } : {}),
      },
    });

    const processingTime = (Date.now() - start) / 1000;
    const url = this.normaliseOutput(result);
    const samples = options.numSamples ?? 1;

    return {
      url,
      cost: samples * COST_PER_IMAGE_PROMPT,
      processingTime,
    };
  }

  async transformImage(
    imageBuffer: Buffer,
    sourcePath: string,
    options: TransformOptions,
  ): Promise<ReplicateGenerationResult> {
    const start = Date.now();
    const model = this.resolveModel(options.model, DEFAULT_TRANSFORM_MODEL);
    const payload = await this.prepareImagePayload(imageBuffer, sourcePath);

    const result = await this.client.run(model, {
      input: {
        image: payload.dataUri,
        ...(options.prompt ? { prompt: options.prompt } : {}),
        ...(options.imageResolution ? { image_resolution: options.imageResolution } : {}),
        ...(options.numSamples ? { num_outputs: options.numSamples } : {}),
        ...(options.seed ? { seed: options.seed } : {}),
        ...(options.negativePrompt ? { negative_prompt: options.negativePrompt } : {}),
        ...(options.strength ? { strength: options.strength } : {}),
      },
    });

    const processingTime = (Date.now() - start) / 1000;
    const url = this.normaliseOutput(result);
    const samples = options.numSamples ?? 1;

    return {
      url,
      cost: samples * COST_PER_IMAGE_TRANSFORM,
      processingTime,
    };
  }

  async validateToken(): Promise<boolean> {
    try {
      const [modelPart] = DEFAULT_PROMPT_MODEL.split(':');
      const [owner, name] = modelPart.split('/');
      if (!owner || !name) {
        throw new Error('Invalid default prompt model identifier');
      }
      await this.client.models.get(owner, name);
      return true;
    } catch (error) {
      return false;
    }
  }

  private async prepareImagePayload(
    buffer: Buffer,
    sourcePath: string,
  ): Promise<{ dataUri: string; width?: number; height?: number }> {
    const metadata = await sharp(buffer).metadata();
    const ext = path.extname(sourcePath).toLowerCase();
    const mime = this.resolveMime(ext);
    const base64 = buffer.toString('base64');
    return {
      dataUri: `data:${mime};base64,${base64}`,
      width: metadata.width,
      height: metadata.height,
    };
  }

  private resolveMime(ext: string): string {
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.webp':
        return 'image/webp';
      case '.png':
      default:
        return 'image/png';
    }
  }

  private buildStagingPrompt(options: StagingOptions): string {
    const base = getStylePrompt(options.style ?? 'ikea_modern');
    const guard =
      'Photorealistic result. Preserve the existing flooring, ceiling height, wall positions, and room layout exactly as the source photo. Only introduce furniture and decor.';
    const furnishing =
      'Furnish the room with a natural, complete arrangement appropriate for the space (seating, tables, accent pieces, lighting), avoiding sparse layouts.';
    const negative = options.negativePrompt ? ` Avoid: ${options.negativePrompt}.` : '';
    return `${base}. ${guard} ${furnishing}${negative}`.trim();
  }

  private buildStagingInput(
    identifier: string,
    prompt: string,
    options: StagingOptions,
    payload: { dataUri: string; width?: number; height?: number },
  ): Record<string, unknown> {
    if (this.usesSeedreamModel(identifier)) {
      const seedream = this.resolveSeedreamSettings(options, payload);
      return {
        prompt,
        image_input: [payload.dataUri],
        enhance_prompt: false,
        sequential_image_generation: 'disabled',
        aspect_ratio: 'match_input_image',
        max_images: 1,
        ...seedream,
      };
    }

    return {
      image: payload.dataUri,
      prompt,
      image_resolution: options.imageResolution ?? DEFAULT_OPTIONS.imageResolution,
      num_samples: options.numSamples ?? DEFAULT_OPTIONS.numSamples,
      prompt_strength: options.promptStrength ?? DEFAULT_OPTIONS.promptStrength,
      ...(options.seed ? { seed: options.seed } : {}),
      ...(options.negativePrompt ? { negative_prompt: options.negativePrompt } : {}),
    };
  }

  private usesSeedreamModel(identifier: string): boolean {
    return identifier.startsWith('bytedance/seedream-4');
  }

  private resolveSeedreamSettings(
    options: StagingOptions,
    payload: { width?: number; height?: number },
  ): Record<string, unknown> {
    const width = payload.width ?? 2048;
    const height = payload.height ?? 2048;

    if (width >= 1024 && width <= 4096 && height >= 1024 && height <= 4096) {
      return {
        size: 'custom',
        width,
        height,
      };
    }

    const target = options.imageResolution ?? DEFAULT_OPTIONS.imageResolution;
    if (target > 2048) {
      return { size: '4K' };
    }
    if (target <= 1024) {
      return { size: '1K' };
    }
    return { size: '2K' };
  }
}
