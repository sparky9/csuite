import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import type { BatchImageConfig } from '../types/index.js';

const truthy = new Set(['true', '1', 'yes', 'y', 'on']);
const falsy = new Set(['false', '0', 'no', 'n', 'off']);

const INPUT_FIELDS = ['input', 'input_path', 'source'];
const OUTPUT_FIELDS = ['output', 'output_path', 'target', 'destination'];
const STYLE_FIELDS = ['style', 'style_key', 'preset'];
const COMPARISON_FIELDS = ['comparison', 'create_comparison', 'comparison_image', 'comparisons'];
const WEB_ASSET_FIELDS = ['web_assets', 'web', 'exports'];
const PROMPT_STRENGTH_FIELDS = ['prompt_strength', 'promptstrength'];
const RESOLUTION_FIELDS = ['resolution', 'image_resolution', 'size'];
const NUM_SAMPLES_FIELDS = ['num_samples', 'samples'];
const NEGATIVE_PROMPT_FIELDS = ['negative_prompt', 'negative'];
const SEED_FIELDS = ['seed'];

const normalise = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

const parseBoolean = (value: string): boolean | undefined => {
  const lowered = value.toLowerCase();
  if (truthy.has(lowered)) {
    return true;
  }
  if (falsy.has(lowered)) {
    return false;
  }
  return undefined;
};

const parseNumber = (value: string): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const pick = (row: Record<string, string>, fields: string[]): string | undefined => {
  for (const field of fields) {
    const matched = Object.keys(row).find((key) => key.toLowerCase() === field);
    if (matched) {
      const value = normalise(row[matched]);
      if (value !== undefined) {
        return value;
      }
    }
  }
  return undefined;
};

export const BATCH_TEMPLATE_HEADER = 'input,output,style,comparison,web_assets,prompt_strength,resolution,num_samples,negative_prompt,seed';

export const BATCH_TEMPLATE_SAMPLE = `${BATCH_TEMPLATE_HEADER}\nimages/living-room.jpg,output/living-room-staged.jpg,ikea_modern,true,,0.85,1024,1,,\nimages/den.jpg,,minimalist_contemporary,false,true,0.75,768,1,remove clutter,12345`;

export async function loadBatchTemplate(
  templatePath: string,
  baseInputFolder: string,
  baseOutputFolder: string,
): Promise<BatchImageConfig[]> {
  const absoluteTemplate = path.resolve(templatePath);
  const [content] = await Promise.all([fs.readFile(absoluteTemplate, 'utf-8')]);
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  return records.map((row, index) => {
    const rowNumber = index + 2; // header is row 1

    const inputValue = pick(row, INPUT_FIELDS);
    if (!inputValue) {
      throw new Error(`CSV row ${rowNumber} is missing an input path.`);
    }

    const resolvedInput = path.isAbsolute(inputValue)
      ? inputValue
      : path.resolve(baseInputFolder, inputValue);

    const outputValue = pick(row, OUTPUT_FIELDS);
    const resolvedOutput = outputValue
      ? path.isAbsolute(outputValue)
        ? outputValue
        : path.resolve(baseOutputFolder, outputValue)
      : undefined;

    const style = pick(row, STYLE_FIELDS);
    const comparisonValue = pick(row, COMPARISON_FIELDS);
    const webAssetValue = pick(row, WEB_ASSET_FIELDS);
    const promptStrengthValue = pick(row, PROMPT_STRENGTH_FIELDS);
    const resolutionValue = pick(row, RESOLUTION_FIELDS);
    const samplesValue = pick(row, NUM_SAMPLES_FIELDS);
    const negativePrompt = pick(row, NEGATIVE_PROMPT_FIELDS);
    const seedValue = pick(row, SEED_FIELDS);

    const config: BatchImageConfig = {
      inputPath: resolvedInput,
    };

    if (resolvedOutput) {
      config.outputPath = resolvedOutput;
    }
    if (style) {
      config.style = style;
    }
    if (comparisonValue) {
      const parsed = parseBoolean(comparisonValue);
      if (parsed !== undefined) {
        config.createComparison = parsed;
      }
    }
    if (webAssetValue) {
      const parsed = parseBoolean(webAssetValue);
      if (parsed !== undefined) {
        config.webAssets = parsed;
      }
    }
    if (promptStrengthValue) {
      const parsed = parseNumber(promptStrengthValue);
      if (parsed !== undefined) {
        config.promptStrength = parsed;
      }
    }
    if (resolutionValue) {
      const parsed = parseNumber(resolutionValue);
      if (parsed !== undefined) {
        config.imageResolution = parsed;
      }
    }
    if (samplesValue) {
      const parsed = parseNumber(samplesValue);
      if (parsed !== undefined) {
        config.numSamples = parsed;
      }
    }
    if (negativePrompt) {
      config.negativePrompt = negativePrompt;
    }
    if (seedValue) {
      const parsed = parseNumber(seedValue);
      if (parsed !== undefined) {
        config.seed = parsed;
      }
    }

    return config;
  });
}

export async function writeBatchTemplateSkeleton(outputPath: string): Promise<void> {
  const resolved = path.resolve(outputPath);
  const sample = `${BATCH_TEMPLATE_SAMPLE}\n`;
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await fs.writeFile(resolved, sample, 'utf-8');
}
