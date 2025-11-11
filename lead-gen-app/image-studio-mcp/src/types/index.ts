/**
 * Core type definitions for Image Studio MCP
 */

export type StylePreset =
  | 'ikea_modern'
  | 'high_end'
  | 'sparse_professional'
  | 'cozy_traditional'
  | 'industrial_loft'
  | 'minimalist_contemporary'
  | 'bohemian_eclectic'
  | 'mid_century_modern'
  | 'farmhouse_rustic'
  | 'custom'
  | string;

export interface BaseGenerationOptions {
  style?: StylePreset;
  negativePrompt?: string;
  imageResolution?: 512 | 768 | 1024 | number;
  numSamples?: number;
  seed?: number;
  webAssets?: boolean;
}

export interface PromptGenerationOptions extends BaseGenerationOptions {
  prompt: string;
  outputPath: string;
  model?: string;
}

export interface TransformOptions extends BaseGenerationOptions {
  prompt?: string;
  inputPath: string;
  outputPath: string;
  strength?: number;
  model?: string;
}

export interface StagingOptions extends BaseGenerationOptions {
  style: StylePreset;
  promptStrength?: number;
}

export interface StagingResult {
  originalPath: string;
  stagedPath: string;
  style: string;
  cost: number;
  processingTime: number;
  replicateUrl?: string;
  comparisonPath?: string;
  webVariants?: string[];
  revisionId?: string;
  bookkeepingTransactionId?: string;
  bookkeepingExpenseId?: string;
  projectAssetId?: string;
}

export interface GeneratedImageResult {
  outputPath: string;
  prompt: string;
  cost: number;
  processingTime: number;
  replicateUrl?: string;
  webVariants?: string[];
  revisionId?: string;
}

export interface BatchImageConfig extends Partial<Omit<StagingOptions, 'style'>> {
  inputPath: string;
  outputPath?: string;
  style?: StylePreset;
  createComparison?: boolean;
  webAssets?: boolean;
  metadata?: Record<string, unknown>;
  integration?: StageIntegrationOverrides;
}

export interface BatchStagingOptions extends StagingOptions {
  inputFolder: string;
  outputFolder: string;
  createComparisons?: boolean;
  perImage?: BatchImageConfig[];
  webAssets?: boolean;
  integration?: StageIntegrationOverrides;
}

export interface BatchStagingResult {
  totalImages: number;
  successCount: number;
  failedCount: number;
  results: StagingResult[];
  totalCost: number;
  totalTime: number;
}

export interface ImageStudioConfig {
  replicateToken: string;
  defaultPromptModel: string;
  defaultTransformModel: string;
  defaultStagingModel: string;
}

export interface BookkeepingIntegrationOptions {
  enabled?: boolean;
  userId?: string;
  category?: string;
  notes?: string;
  currency?: string;
  description?: string;
  brand?: string;
  databaseUrl?: string;
}

export interface TaskManagerIntegrationOptions {
  enabled?: boolean;
  userId?: string;
  projectId?: string;
  label?: string;
  description?: string;
  brand?: string;
  databaseUrl?: string;
}

export interface StageIntegrationOverrides {
  bookkeeping?: BookkeepingIntegrationOptions;
  taskManager?: TaskManagerIntegrationOptions;
}

export interface StageExecutionContext {
  metadata?: Record<string, unknown>;
  integration?: StageIntegrationOverrides;
}
