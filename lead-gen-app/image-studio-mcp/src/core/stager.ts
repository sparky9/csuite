/**
 * High-level orchestration for Image Studio operations
 */

import path from 'node:path';
import { ReplicateClient } from './replicate.js';
import { ImageProcessor } from '../utils/imageProcessor.js';
import type {
  BatchImageConfig,
  BatchStagingOptions,
  BatchStagingResult,
  GeneratedImageResult,
  PromptGenerationOptions,
  StageExecutionContext,
  StagingOptions,
  StagingResult,
  TransformOptions,
} from '../types/index.js';
import {
  MAX_CONCURRENT,
  ANALYTICS_DB_PATH,
  AUTO_WEB_EXPORT,
  WEB_EXPORT_SIZES,
  REVISION_STORE_PATH,
} from '../config/constants.js';
import { createBeforeAfter } from '../utils/comparison.js';
import { ensureDirectory } from '../utils/validator.js';
import { AnalyticsStore } from '../analytics/analyticsStore.js';
import {
  RevisionStore,
  type RevisionIndexEntry,
  type RevisionRecord,
  type RevisionRecordInput,
} from '../workflow/revisionStore.js';
import { randomUUID } from 'node:crypto';
import { resolveIntegrationSettings } from '../config/integration.js';
import { recordBookkeepingExpense, recordProjectAssetLink } from '../integration/index.js';

export class ImageStudio {
  private replicate: ReplicateClient;
  private imageProcessor: ImageProcessor;
  private analytics?: AnalyticsStore;
  private revisions?: RevisionStore;

  constructor(
    replicateToken: string,
    analyticsDbPath: string = ANALYTICS_DB_PATH,
    revisionDir: string = REVISION_STORE_PATH,
  ) {
    this.replicate = new ReplicateClient(replicateToken);
    this.imageProcessor = new ImageProcessor();
    this.analytics = new AnalyticsStore(analyticsDbPath);
    this.revisions = new RevisionStore(revisionDir);
  }

  async stageImageFile(
    inputPath: string,
    outputPath: string,
    options: StagingOptions,
    createComparison = false,
    context?: StageExecutionContext,
  ): Promise<StagingResult> {
    const resolvedInput = path.resolve(inputPath);
    const resolvedOutput = path.resolve(outputPath);
    await ensureDirectory(path.dirname(resolvedOutput));
    const imageBuffer = await this.imageProcessor.readImage(resolvedInput);
    const { url, cost, processingTime } = await this.replicate.stageImage(
      imageBuffer,
      resolvedInput,
      options,
    );
    const stagedBuffer = await this.imageProcessor.downloadImage(url);
    await this.imageProcessor.saveImage(stagedBuffer, resolvedOutput);

    let comparisonPath: string | undefined;
    if (createComparison) {
      const folder = path.dirname(resolvedOutput);
      comparisonPath = await createBeforeAfter(resolvedInput, resolvedOutput, folder);
    }

    const shouldGenerateWeb = (options.webAssets ?? AUTO_WEB_EXPORT) && WEB_EXPORT_SIZES.length > 0;
    let webVariants: string[] | undefined;
    if (shouldGenerateWeb) {
      try {
        webVariants = await this.imageProcessor.generateWebVariants(
          stagedBuffer,
          resolvedOutput,
          WEB_EXPORT_SIZES,
        );
      } catch (error) {
        console.error('Failed to generate web variants', error);
      }
    }

    const analyticsMetadata: Record<string, unknown> = {
      createComparison,
      comparisonPath,
      webAssets: shouldGenerateWeb,
    };
    if (webVariants?.length) {
      analyticsMetadata.webVariants = webVariants;
    }
    const stageMetadata: Record<string, unknown> = context?.metadata ? { ...context.metadata } : {};
    if (Object.keys(stageMetadata).length > 0) {
      Object.assign(analyticsMetadata, stageMetadata);
    }

    const result: StagingResult = {
      originalPath: resolvedInput,
      stagedPath: resolvedOutput,
      style: options.style,
      cost,
      processingTime,
      replicateUrl: url,
      comparisonPath,
      webVariants,
    };

    const getMetadataString = (key: string): string | undefined => {
      const value = stageMetadata[key];
      if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      }
      return undefined;
    };

    const integrationSettings = resolveIntegrationSettings(context?.integration);
    const integrationMetadata: Record<string, unknown> = {};
    const revisionId = randomUUID();
    const projectId = getMetadataString('projectId');

    if (integrationSettings.bookkeeping.enabled && cost > 0) {
      const description =
        getMetadataString('bookkeepingDescription') ??
        integrationSettings.bookkeeping.description ??
        `Image staging (${path.basename(resolvedInput)})`;
      const notesParts = [
        getMetadataString('bookkeepingNotes'),
        projectId ? `project=${projectId}` : undefined,
        `revision=${revisionId}`,
      ].filter(Boolean);
      const categoryOverride = getMetadataString('bookkeepingCategory');
      const currencyOverride = getMetadataString('bookkeepingCurrency');
      const userOverride = getMetadataString('bookkeepingUserId');
      const receiptUrl = getMetadataString('receiptUrl');

      const expenseResult = await recordBookkeepingExpense(integrationSettings.bookkeeping, {
        amount: cost,
        description,
        category: categoryOverride,
        notes: notesParts.length > 0 ? notesParts.join(' | ') : undefined,
        currency: currencyOverride,
        userId: userOverride,
        receiptUrl,
      });

      if (expenseResult) {
        if (expenseResult.expenseId) {
          result.bookkeepingExpenseId = expenseResult.expenseId;
          integrationMetadata.bookkeepingExpenseId = expenseResult.expenseId;
        }
        if (expenseResult.transactionId) {
          result.bookkeepingTransactionId = expenseResult.transactionId;
          integrationMetadata.bookkeepingTransactionId = expenseResult.transactionId;
        }
        integrationMetadata.bookkeepingAmount = expenseResult.amount ?? cost;
        const resolvedCurrency =
          expenseResult.currency ?? currencyOverride ?? integrationSettings.bookkeeping.currency;
        if (resolvedCurrency) {
          integrationMetadata.bookkeepingCurrency = resolvedCurrency;
        }
        const resolvedCategory =
          expenseResult.category ?? categoryOverride ?? integrationSettings.bookkeeping.category;
        if (resolvedCategory) {
          integrationMetadata.bookkeepingCategory = resolvedCategory;
        }
      }
    }

    if (integrationSettings.taskManager.enabled) {
      const assetLabel =
        getMetadataString('assetLabel') ??
        integrationSettings.taskManager.label ??
        `Staged asset: ${path.basename(resolvedOutput)}`;
      const assetDescription =
        getMetadataString('assetDescription') ??
        integrationSettings.taskManager.description ??
        `Staged using style ${options.style}`;
      const brandOverride =
        getMetadataString('taskManagerBrand') ??
        getMetadataString('brand') ??
        integrationSettings.taskManager.brand;
      const currencyOverride =
        getMetadataString('projectCurrency') ??
        (typeof integrationMetadata.bookkeepingCurrency === 'string'
          ? (integrationMetadata.bookkeepingCurrency as string)
          : integrationSettings.bookkeeping.currency);
      const userOverride = getMetadataString('taskManagerUserId') ?? getMetadataString('userId');

      const assetResult = await recordProjectAssetLink(integrationSettings.taskManager, {
        label: assetLabel,
        description: assetDescription,
        sourcePath: resolvedInput,
        outputPath: resolvedOutput,
        revisionId,
        cost: cost > 0 ? cost : undefined,
        currency: currencyOverride,
        brand: brandOverride,
        metadata: Object.keys(stageMetadata).length > 0 ? stageMetadata : undefined,
        userId: userOverride,
        projectId,
      });

      if (assetResult) {
        result.projectAssetId = assetResult.assetId;
        integrationMetadata.projectAssetId = assetResult.assetId;
        integrationMetadata.projectId = assetResult.projectId;
      } else if (projectId) {
        integrationMetadata.projectId = projectId;
      }
    } else if (projectId) {
      integrationMetadata.projectId = projectId;
    }

    if (Object.keys(integrationMetadata).length > 0) {
      Object.assign(analyticsMetadata, integrationMetadata);
    }

    const storedRevisionId = await this.recordRevision({
      id: revisionId,
      operation: 'stage_image',
      inputPath: resolvedInput,
      outputPath: resolvedOutput,
      style: typeof options.style === 'string' ? options.style : undefined,
      comparisonPath,
      webVariants,
      replicateUrl: url,
      cost,
      processingTime,
      metadata: analyticsMetadata,
    });
    if (storedRevisionId) {
      result.revisionId = storedRevisionId;
      analyticsMetadata.revisionId = storedRevisionId;
    }

    this.safeLog({
      operation: 'stage_image',
      prompt: options.style,
      style: typeof options.style === 'string' ? options.style : undefined,
      model: undefined,
      inputPath: resolvedInput,
      outputPath: resolvedOutput,
      cost,
      processingTime,
      metadata: analyticsMetadata,
    });

    return result;
  }

  async generateFromPrompt(options: PromptGenerationOptions): Promise<GeneratedImageResult> {
    const resolvedOutput = path.resolve(options.outputPath);
    await ensureDirectory(path.dirname(resolvedOutput));
    const { url, cost, processingTime } = await this.replicate.generateFromPrompt(options);
    const buffer = await this.imageProcessor.downloadImage(url);
    await this.imageProcessor.saveImage(buffer, resolvedOutput);

    const shouldGenerateWeb = (options.webAssets ?? AUTO_WEB_EXPORT) && WEB_EXPORT_SIZES.length > 0;
    let webVariants: string[] | undefined;
    if (shouldGenerateWeb) {
      try {
        webVariants = await this.imageProcessor.generateWebVariants(
          buffer,
          resolvedOutput,
          WEB_EXPORT_SIZES,
        );
      } catch (error) {
        console.error('Failed to generate web variants', error);
      }
    }

    const analyticsMetadata: Record<string, unknown> = {
      webAssets: shouldGenerateWeb,
    };
    if (webVariants?.length) {
      analyticsMetadata.webVariants = webVariants;
    }

    const result: GeneratedImageResult = {
      outputPath: resolvedOutput,
      prompt: options.prompt,
      cost,
      processingTime,
      replicateUrl: url,
      webVariants,
    };

    this.safeLog({
      operation: 'generate_image',
      prompt: options.prompt,
      style: options.style,
      model: options.model,
      outputPath: resolvedOutput,
      cost,
      processingTime,
      metadata: analyticsMetadata,
    });

    const revisionId = await this.recordRevision({
      operation: 'generate_image',
      outputPath: resolvedOutput,
      prompt: options.prompt,
      style: typeof options.style === 'string' ? options.style : undefined,
      webVariants,
      replicateUrl: url,
      cost,
      processingTime,
      metadata: analyticsMetadata,
    });
    if (revisionId) {
      result.revisionId = revisionId;
    }

    return result;
  }

  async transformImageFile(options: TransformOptions): Promise<GeneratedImageResult> {
    const resolvedInput = path.resolve(options.inputPath);
    const resolvedOutput = path.resolve(options.outputPath);
    const imageBuffer = await this.imageProcessor.readImage(resolvedInput);
    const { url, cost, processingTime } = await this.replicate.transformImage(
      imageBuffer,
      resolvedInput,
      options,
    );
    const transformedBuffer = await this.imageProcessor.downloadImage(url);
    await this.imageProcessor.saveImage(transformedBuffer, resolvedOutput);

    const shouldGenerateWeb = (options.webAssets ?? AUTO_WEB_EXPORT) && WEB_EXPORT_SIZES.length > 0;
    let webVariants: string[] | undefined;
    if (shouldGenerateWeb) {
      try {
        webVariants = await this.imageProcessor.generateWebVariants(
          transformedBuffer,
          resolvedOutput,
          WEB_EXPORT_SIZES,
        );
      } catch (error) {
        console.error('Failed to generate web variants', error);
      }
    }

    const analyticsMetadata: Record<string, unknown> = {
      strength: options.strength,
      webAssets: shouldGenerateWeb,
    };
    if (webVariants?.length) {
      analyticsMetadata.webVariants = webVariants;
    }

    const result: GeneratedImageResult = {
      outputPath: resolvedOutput,
      prompt: options.prompt ?? options.style ?? 'transformation',
      cost,
      processingTime,
      replicateUrl: url,
      webVariants,
    };

    this.safeLog({
      operation: 'transform_image',
      prompt: options.prompt,
      style: options.style,
      model: options.model,
      inputPath: resolvedInput,
      outputPath: resolvedOutput,
      cost,
      processingTime,
      metadata: analyticsMetadata,
    });

    const revisionId = await this.recordRevision({
      operation: 'transform_image',
      inputPath: resolvedInput,
      outputPath: resolvedOutput,
      prompt: options.prompt ?? options.style ?? 'transformation',
      style: typeof options.style === 'string' ? options.style : undefined,
      webVariants,
      replicateUrl: url,
      cost,
      processingTime,
      metadata: analyticsMetadata,
    });
    if (revisionId) {
      result.revisionId = revisionId;
    }

    return result;
  }

  async generateVariations(
    inputPath: string,
    outputFolder: string,
    styles: string[],
    overrides: Partial<Omit<StagingOptions, 'style'>> = {},
  ): Promise<StagingResult[]> {
    const results: StagingResult[] = [];
    const resolvedInput = path.resolve(inputPath);
    const resolvedOutputFolder = path.resolve(outputFolder);
    const extension = path.extname(resolvedInput);
    const basename = path.basename(resolvedInput, extension);

    for (const style of styles) {
      const outputPath = path.join(resolvedOutputFolder, `${basename}_${style}${extension}`);
      const result = await this.stageImageFile(
        resolvedInput,
        outputPath,
        {
          style,
          ...overrides,
        },
        false,
        {
          metadata: {
            variation: true,
            variationStyle: style,
          },
        },
      );
      results.push(result);
    }

    return results;
  }

  async processBatch(options: BatchStagingOptions): Promise<BatchStagingResult> {
    const start = Date.now();
    const discovered = await this.imageProcessor.getImageFiles(options.inputFolder);
    const resolvedDiscovered = discovered.map((file) => path.resolve(file));

    const perImageMap = new Map<string, BatchImageConfig>();
    const templateOrder: string[] = [];

    if (options.perImage && options.perImage.length > 0) {
      for (const entry of options.perImage) {
        const resolvedInput = path.resolve(entry.inputPath);
        const resolvedOutput = entry.outputPath ? path.resolve(entry.outputPath) : undefined;
        const normalized: BatchImageConfig = {
          ...entry,
          inputPath: resolvedInput,
          ...(resolvedOutput ? { outputPath: resolvedOutput } : {}),
        };
        if (!perImageMap.has(resolvedInput)) {
          templateOrder.push(resolvedInput);
        }
        perImageMap.set(resolvedInput, normalized);
      }
    }

    const templateSet = new Set(templateOrder);
    const queueBase =
      templateOrder.length > 0
        ? [...templateOrder, ...resolvedDiscovered.filter((file) => !templateSet.has(file))]
        : resolvedDiscovered;

    const queue = Array.from(new Set(queueBase));

    if (queue.length === 0) {
      throw new Error(`No images found in ${options.inputFolder}`);
    }

    const results: StagingResult[] = [];
    const failed: string[] = [];
    const batchId = randomUUID();
    const resolvedOutputFolder = path.resolve(options.outputFolder);

    for (let i = 0; i < queue.length; i += MAX_CONCURRENT) {
      const batch = queue.slice(i, i + MAX_CONCURRENT);
      const batchResults = await Promise.all(
        batch.map(async (inputPath) => {
          const config = perImageMap.get(inputPath);
          const outputPath =
            config?.outputPath ?? path.join(resolvedOutputFolder, path.basename(inputPath));
          const comparisonFlag = config?.createComparison ?? options.createComparisons ?? false;
          const stagingOptions: StagingOptions = {
            style: config?.style ?? options.style,
            imageResolution: config?.imageResolution ?? options.imageResolution,
            promptStrength: config?.promptStrength ?? options.promptStrength,
            numSamples: config?.numSamples ?? options.numSamples,
            negativePrompt: config?.negativePrompt ?? options.negativePrompt,
            seed: config?.seed ?? options.seed,
            webAssets: config?.webAssets ?? options.webAssets,
          };

          const revisionMetadata: Record<string, unknown> = {
            batch: true,
            batchId,
            fromTemplate: Boolean(config),
          };
          if (config?.outputPath) {
            revisionMetadata.customOutput = true;
          }

          try {
            const staged = await this.stageImageFile(
              inputPath,
              outputPath,
              stagingOptions,
              comparisonFlag,
              { metadata: revisionMetadata },
            );

            const analyticMetadata: Record<string, unknown> = {
              ...revisionMetadata,
              createComparison: comparisonFlag,
              webAssets: Boolean(staged.webVariants && staged.webVariants.length > 0),
            };
            if (staged.webVariants?.length) {
              analyticMetadata.webVariants = staged.webVariants;
            }

            this.safeLog({
              operation: 'batch_stage',
              prompt: stagingOptions.style,
              style: stagingOptions.style,
              inputPath,
              outputPath,
              cost: staged.cost,
              processingTime: staged.processingTime,
              metadata: analyticMetadata,
            });
            return staged;
          } catch (error) {
            failed.push(inputPath);
            return null;
          }
        }),
      );

      results.push(...(batchResults.filter(Boolean) as StagingResult[]));
    }

    const totalTime = (Date.now() - start) / 1000;
    const totalCost = results.reduce((sum, item) => sum + item.cost, 0);

    return {
      totalImages: queue.length,
      successCount: results.length,
      failedCount: failed.length,
      results,
      totalCost,
      totalTime,
    };
  }

  async validateApiToken(): Promise<boolean> {
    return this.replicate.validateToken();
  }

  getMonthlySummary(month: string) {
    return this.analytics?.getMonthlySummary(month);
  }

  exportMonthlyCsv(month: string, outputPath: string): void {
    this.analytics?.exportMonthlyCsv(month, outputPath);
  }

  async listRevisions(options?: { limit?: number; operation?: string }): Promise<RevisionIndexEntry[]> {
    if (!this.revisions) {
      return [];
    }
    const entries = await this.revisions.list(options?.limit);
    if (options?.operation) {
      return entries.filter((entry) => entry.operation === options.operation);
    }
    return entries;
  }

  async getRevision(id: string): Promise<RevisionRecord | undefined> {
    if (!this.revisions) {
      return undefined;
    }
    return this.revisions.get(id);
  }

  private async recordRevision(
    record: RevisionRecordInput & { id?: string; timestamp?: string },
  ): Promise<string | undefined> {
    if (!this.revisions) {
      return undefined;
    }
    try {
      return await this.revisions.record(record);
    } catch (error) {
      console.error('Failed to record revision entry', error);
      return undefined;
    }
  }

  private safeLog(event: Parameters<AnalyticsStore['logEvent']>[0]): void {
    if (!this.analytics) {
      return;
    }
    try {
      this.analytics.logEvent(event);
    } catch (error) {
      console.error('Failed to record analytics event', error);
    }
  }
}
