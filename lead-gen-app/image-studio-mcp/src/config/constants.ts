/**
 * Configuration constants for Image Studio MCP
 */

import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();

export type ReplicateModelIdentifier =
  | `${string}/${string}`
  | `${string}/${string}:${string}`;

const asModelIdentifier = (value: string): ReplicateModelIdentifier =>
  value as ReplicateModelIdentifier;

export const DEFAULT_STAGING_MODEL: ReplicateModelIdentifier = asModelIdentifier(
  process.env.IMAGE_STUDIO_MODEL_STAGING ??
    'bytedance/seedream-4:b2d15affd5864f968fd20331de1e1e5d510ab7853f90a7d0836984871224a9fc',
);

export const DEFAULT_PROMPT_MODEL: ReplicateModelIdentifier = asModelIdentifier(
  process.env.IMAGE_STUDIO_MODEL_PROMPT ?? 'stability-ai/stable-diffusion-xl-base-1.0',
);

export const DEFAULT_TRANSFORM_MODEL: ReplicateModelIdentifier = asModelIdentifier(
  process.env.IMAGE_STUDIO_MODEL_TRANSFORM ??
    'stability-ai/stable-diffusion-xl-refiner-1.0',
);

export const SUPPORTED_IMAGE_FORMATS = ['.jpg', '.jpeg', '.png', '.webp'];

export const IMAGE_RESOLUTIONS = {
  SMALL: 512,
  MEDIUM: 768,
  LARGE: 1024,
} as const;

export const DEFAULT_OPTIONS = {
  imageResolution: IMAGE_RESOLUTIONS.MEDIUM,
  numSamples: Number(process.env.DEFAULT_SAMPLES ?? 5), // Generate 5 variations by default (only $0.0315 total for staging)
  promptStrength: 1.0,
};
export const COST_PER_IMAGE_STAGING = 0.0063;
export const COST_PER_IMAGE_PROMPT = 0.0085;
export const COST_PER_IMAGE_TRANSFORM = 0.0071;

export const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT_REQUESTS ?? 3);

export const ANALYTICS_DB_PATH =
  process.env.IMAGE_STUDIO_ANALYTICS_DB ??
  path.resolve(process.cwd(), 'data', 'image-studio-analytics.db');

export const STYLE_LIBRARY_PATH =
  process.env.IMAGE_STUDIO_STYLE_LIBRARY ??
  path.resolve(process.cwd(), 'data', 'custom-styles.json');

const defaultWebSizes = [512, 768, 1024];
const parseWebSizes = (value?: string): number[] => {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => !Number.isNaN(item) && item > 0);
};

const parsedWebSizes = parseWebSizes(process.env.IMAGE_STUDIO_WEB_SIZES);
export const WEB_EXPORT_SIZES: number[] = parsedWebSizes.length ? parsedWebSizes : defaultWebSizes;

export const AUTO_WEB_EXPORT = process.env.IMAGE_STUDIO_AUTO_WEB === 'false' ? false : true;

export const REVISION_STORE_PATH =
  process.env.IMAGE_STUDIO_REVISION_DIR ??
  path.resolve(process.cwd(), 'data', 'revisions');
