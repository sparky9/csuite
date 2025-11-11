#!/usr/bin/env node
/**
 * Command-line interface for Image Studio MCP
 */
import { Command } from 'commander';
import dotenv from 'dotenv';
import path from 'node:path';
import { ImageStudio } from './core/stager.js';
import { listAvailableStyles, STYLE_PRESETS } from './utils/stylePresets.js';
import { ensureDirectory, ensureFileExists } from './utils/validator.js';
import { saveCustomStyle, removeCustomStyle, listCustomStyles } from './utils/styleLibrary.js';
import { AnalyticsStore } from './analytics/analyticsStore.js';
import { ANALYTICS_DB_PATH, REVISION_STORE_PATH } from './config/constants.js';
import { loadBatchTemplate, writeBatchTemplateSkeleton } from './utils/batchTemplate.js';
import type { BatchStagingOptions } from './types/index.js';
import { RevisionStore, type RevisionIndexEntry } from './workflow/revisionStore.js';

dotenv.config();

const program = new Command();

function getToken(): string {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error('REPLICATE_API_TOKEN environment variable not set');
  }
  return token;
}

function parseNumberOption(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function parseOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

const resolveWebAssetsOption = (options: { webAssets?: boolean; skipWebAssets?: boolean }): boolean | undefined => {
  if (options.skipWebAssets) {
    return false;
  }
  if (options.webAssets) {
    return true;
  }
  return undefined;
};

const currentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const resolveMonth = (value?: string): string => {
  const month = value ?? currentMonth();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error(`Invalid month format: ${month}. Expected YYYY-MM.`);
  }
  return month;
};

const getAnalyticsStore = (): AnalyticsStore => new AnalyticsStore(ANALYTICS_DB_PATH);
const getRevisionStore = (): RevisionStore => new RevisionStore(REVISION_STORE_PATH);

const normaliseTags = (value: unknown): string[] | undefined => {
  if (!value) {
    return undefined;
  }
  const items = Array.isArray(value) ? value : [value];
  return items
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
};

const printStyles = (options?: { custom?: boolean; builtin?: boolean }) => {
  const onlyCustom = options?.custom && !options?.builtin;
  const onlyBuiltin = options?.builtin && !options?.custom;
  const showBuiltin = onlyCustom ? false : true;
  const showCustom = onlyBuiltin ? false : true;

  if (showBuiltin) {
    console.log('\nBuilt-in style presets:\n');
    Object.entries(STYLE_PRESETS).forEach(([key, style]) => {
      console.log(`  • ${key}: ${style.name} - ${style.description}`);
    });
  }

  if (showCustom) {
    const customs = listCustomStyles();
    if (customs.length === 0) {
      console.log('\nNo custom styles saved yet. Use "image-studio styles add" to create one.');
    } else {
      console.log('\nCustom style presets:\n');
      customs.forEach((style) => {
        const details = style.description ? ` - ${style.description}` : '';
        console.log(`  • ${style.key}: ${style.name}${details}`);
      });
    }
  }

  if (!showBuiltin && !showCustom) {
    console.log('\nNo styles to display.');
  }
  console.log('');
};

const printAssetInfo = (result: { webVariants?: string[]; revisionId?: string }) => {
  if (result.webVariants && result.webVariants.length > 0) {
    console.log('  Web variants:');
    result.webVariants.forEach((variant) => {
      console.log(`    • ${variant}`);
    });
  }

  if (result.revisionId) {
    console.log(`  Revision: ${result.revisionId}`);
  }
};

const formatRevisionLine = (entry: RevisionIndexEntry): string => {
  const timestamp = new Date(entry.timestamp).toISOString();
  const fragments = [`${timestamp}`, entry.operation, path.basename(entry.outputPath)];
  if (entry.webVariants?.length) {
    fragments.push(`${entry.webVariants.length} web variants`);
  }
  const batchId = entry.metadata?.['batchId'];
  if (typeof batchId === 'string' && batchId.length > 0) {
    fragments.push(`batch ${batchId}`);
  }
  return fragments.join(' • ');
};

program
  .name('image-studio')
  .description('Omni-purpose AI image generator, transformer, and virtual staging CLI')
  .version('1.0.0');

program
  .command('stage')
  .description('Stage a single image with furniture and decor')
  .requiredOption('-i, --input <path>', 'Input image path')
  .requiredOption('-o, --output <path>', 'Output image path')
  .option('-s, --style <style>', 'Style preset or custom prompt', 'ikea_modern')
  .option('-r, --resolution <size>', 'Image resolution (512, 768, 1024)', '768')
  .option('--prompt-strength <value>', 'Prompt strength (0.5-1.0)', '0.8')
  .option('-n, --num-samples <count>', 'Number of variations to generate', '1')
  .option('--negative <text>', 'Negative prompt to avoid elements')
  .option('--seed <value>', 'Deterministic seed value')
  .option('--comparisons', 'Create before/after comparison image', false)
  .option('--web-assets', 'Generate multi-size WebP exports for the output', false)
  .option('--skip-web-assets', 'Disable web exports regardless of defaults', false)
  .action(async (options) => {
    try {
      const token = getToken();
      const studio = new ImageStudio(token);
      await ensureFileExists(options.input);
      await ensureDirectory(path.dirname(options.output));

      const webAssetsPreference = resolveWebAssetsOption(options);
      const result = await studio.stageImageFile(
        options.input,
        options.output,
        {
          style: options.style,
          imageResolution: parseNumberOption(options.resolution, 768),
          promptStrength: parseNumberOption(options.promptStrength, 0.8),
          numSamples: parseNumberOption(options.numSamples ?? options['num-samples'], 1),
          negativePrompt: options.negative,
          seed: parseOptionalNumber(options.seed),
          ...(webAssetsPreference !== undefined ? { webAssets: webAssetsPreference } : {}),
        },
        Boolean(options.comparisons),
      );

      console.log('✓ Stage complete');
      console.log(`  Output: ${result.stagedPath}`);
      if (result.comparisonPath) {
        console.log(`  Comparison: ${result.comparisonPath}`);
      }
      console.log(`  Style: ${result.style}`);
      console.log(`  Cost: $${result.cost.toFixed(4)}`);
      console.log(`  Time: ${result.processingTime.toFixed(1)}s`);
      printAssetInfo(result);
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exitCode = 1;
    }
  });

program
  .command('generate')
  .description('Generate images from text prompt')
  .requiredOption('-p, --prompt <text>', 'Prompt describing the desired image')
  .requiredOption('-o, --output <path>', 'Output image path')
  .option('-m, --model <id>', 'Replicate model ID to use')
  .option('-r, --resolution <size>', 'Image resolution (default 768)', '768')
  .option('-n, --num-samples <count>', 'Number of samples to request', '1')
  .option('--negative <text>', 'Negative prompt to avoid elements')
  .option('--seed <value>', 'Deterministic seed value')
  .option('--web-assets', 'Generate multi-size WebP exports for the output', false)
  .option('--skip-web-assets', 'Disable web exports regardless of defaults', false)
  .action(async (options) => {
    try {
      const studio = new ImageStudio(getToken());
      const webAssetsPreference = resolveWebAssetsOption(options);
      const result = await studio.generateFromPrompt({
        prompt: options.prompt,
        outputPath: options.output,
        model: options.model,
        imageResolution: parseNumberOption(options.resolution, 768),
        numSamples: parseNumberOption(options.numSamples ?? options['num-samples'], 1),
        negativePrompt: options.negative,
        seed: parseOptionalNumber(options.seed),
        ...(webAssetsPreference !== undefined ? { webAssets: webAssetsPreference } : {}),
      });

      console.log('✓ Generation complete');
      console.log(`  Output: ${result.outputPath}`);
      console.log(`  Cost: $${result.cost.toFixed(4)}`);
      console.log(`  Time: ${result.processingTime.toFixed(1)}s`);
      printAssetInfo(result);
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exitCode = 1;
    }
  });

program
  .command('transform')
  .description('Transform an existing image (restyle, relight, seasonal change)')
  .requiredOption('-i, --input <path>', 'Input image path to transform')
  .requiredOption('-o, --output <path>', 'Output image path')
  .option('-p, --prompt <text>', 'Transformation prompt')
  .option('-m, --model <id>', 'Custom Replicate model ID')
  .option('-r, --resolution <size>', 'Image resolution (default 768)', '768')
  .option('-n, --num-samples <count>', 'Number of variations to generate', '1')
  .option('-s, --strength <value>', 'Transformation strength (0-1)', '0.8')
  .option('--negative <text>', 'Negative prompt to avoid elements')
  .option('--seed <value>', 'Deterministic seed value')
  .option('--web-assets', 'Generate multi-size WebP exports for the output', false)
  .option('--skip-web-assets', 'Disable web exports regardless of defaults', false)
  .action(async (options) => {
    try {
      const studio = new ImageStudio(getToken());
      const webAssetsPreference = resolveWebAssetsOption(options);
      const result = await studio.transformImageFile({
        inputPath: options.input,
        outputPath: options.output,
        prompt: options.prompt,
        model: options.model,
        imageResolution: parseNumberOption(options.resolution, 768),
        numSamples: parseNumberOption(options.numSamples ?? options['num-samples'], 1),
        strength: parseNumberOption(options.strength, 0.8),
        negativePrompt: options.negative,
        seed: parseOptionalNumber(options.seed),
        ...(webAssetsPreference !== undefined ? { webAssets: webAssetsPreference } : {}),
      });

      console.log('✓ Transformation complete');
      console.log(`  Output: ${result.outputPath}`);
      console.log(`  Cost: $${result.cost.toFixed(4)}`);
      console.log(`  Time: ${result.processingTime.toFixed(1)}s`);
      printAssetInfo(result);
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exitCode = 1;
    }
  });

const batchCommand = program
  .command('batch')
  .description('Stage all images in a folder with optional comparisons')
  .requiredOption('-i, --input <folder>', 'Input folder containing images')
  .requiredOption('-o, --output <folder>', 'Output folder for staged images')
  .option('-s, --style <style>', 'Style preset or custom prompt', 'ikea_modern')
  .option('-c, --comparisons', 'Create before/after comparisons', false)
  .option('-r, --resolution <size>', 'Image resolution (default 768)', '768')
  .option('--prompt-strength <value>', 'Prompt strength (0.5-1.0)', '0.8')
  .option('-n, --num-samples <count>', 'Number of variations to generate', '1')
  .option('--negative <text>', 'Negative prompt to avoid elements')
  .option('--seed <value>', 'Deterministic seed value')
  .option('-t, --template <path>', 'CSV template file with per-image overrides')
  .option('--web-assets', 'Generate multi-size WebP exports for each output', false)
  .option('--skip-web-assets', 'Disable web exports regardless of defaults', false);

batchCommand.action(async (options) => {
    try {
      const studio = new ImageStudio(getToken());
      const inputFolder = path.resolve(options.input);
      const outputFolder = path.resolve(options.output);
      await ensureDirectory(outputFolder);

      let perImage = undefined as Awaited<ReturnType<typeof loadBatchTemplate>> | undefined;
      if (options.template) {
        const templatePath = path.resolve(options.template);
        await ensureFileExists(templatePath);
        perImage = await loadBatchTemplate(templatePath, inputFolder, outputFolder);
      }

      const webAssetsPreference = resolveWebAssetsOption(options);

      const batchOptions: BatchStagingOptions = {
        inputFolder,
        outputFolder,
        style: options.style,
        createComparisons: Boolean(options.comparisons),
        imageResolution: parseNumberOption(options.resolution, 768),
        promptStrength: parseNumberOption(options.promptStrength, 0.8),
        numSamples: parseNumberOption(options.numSamples ?? options['num-samples'], 1),
        negativePrompt: options.negative,
        seed: parseOptionalNumber(options.seed),
      };

      if (perImage && perImage.length > 0) {
        batchOptions.perImage = perImage;
      }
      if (webAssetsPreference !== undefined) {
        batchOptions.webAssets = webAssetsPreference;
      }

      const result = await studio.processBatch(batchOptions);

      console.log('✓ Batch staging complete');
      console.log(`  Total images: ${result.totalImages}`);
      console.log(`  Successful: ${result.successCount}`);
      console.log(`  Failed: ${result.failedCount}`);
      console.log(`  Total cost: $${result.totalCost.toFixed(4)}`);
      console.log(`  Total time: ${result.totalTime.toFixed(1)}s`);
      if (perImage?.length) {
        console.log(`  Template rows applied: ${perImage.length}`);
      }
      const webVariantCount = result.results.reduce(
        (sum, item) => sum + (item.webVariants?.length ?? 0),
        0,
      );
      if (webVariantCount > 0) {
        console.log(`  Web variants generated: ${webVariantCount}`);
      }
      const revisionsTracked = result.results.filter((item) => item.revisionId).length;
      if (revisionsTracked > 0) {
        console.log(`  Revisions captured: ${revisionsTracked}`);
      }
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exitCode = 1;
    }
  });

program
  .command('batch-template')
  .description('Generate a CSV template skeleton for batch staging overrides')
  .argument('[output]', 'Destination for the template file', 'data/batch-template.csv')
  .action(async (output) => {
    try {
      const destination = path.resolve(output);
      await writeBatchTemplateSkeleton(destination);
      console.log(`✓ Batch template written to ${destination}`);
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exitCode = 1;
    }
  });

const revisionsCommand = program
  .command('revisions')
  .description('Inspect generated asset revisions');

revisionsCommand
  .command('list')
  .description('List recently recorded revisions')
  .option('-l, --limit <count>', 'Number of entries to display', '20')
  .option('-o, --operation <name>', 'Filter by operation (stage_image, transform_image, etc.)')
  .option('--json', 'Output raw JSON for automation', false)
  .action(async (options) => {
    try {
      const store = getRevisionStore();
  const limitCandidate = parseNumberOption(options.limit, 20);
  const limit = limitCandidate > 0 ? limitCandidate : undefined;
  const entries = await store.list(limit);
      const filtered = options.operation
        ? entries.filter((entry) => entry.operation === options.operation)
        : entries;

      if (options.json) {
        console.log(JSON.stringify(filtered, null, 2));
        return;
      }

      if (filtered.length === 0) {
        console.log('No revisions recorded yet.');
        return;
      }

      console.log(`Showing ${filtered.length} revision${filtered.length === 1 ? '' : 's'}:\n`);
      filtered.forEach((entry) => {
        console.log(`  ${entry.id} :: ${formatRevisionLine(entry)}`);
      });
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exitCode = 1;
    }
  });

revisionsCommand
  .command('view')
  .description('Display full metadata for a revision by ID')
  .argument('<id>', 'Revision identifier returned from staging commands')
  .option('--json', 'Output raw JSON')
  .action(async (id, options) => {
    try {
      const store = getRevisionStore();
      const record = await store.get(id);
      if (!record) {
        console.error(`No revision found with id ${id}`);
        process.exitCode = 1;
        return;
      }

      if (options?.json) {
        console.log(JSON.stringify(record, null, 2));
        return;
      }

      console.log(`Revision ${record.id}`);
      console.log(`  Timestamp: ${new Date(record.timestamp).toISOString()}`);
      console.log(`  Operation: ${record.operation}`);
      if (record.prompt) {
        console.log(`  Prompt: ${record.prompt}`);
      }
      if (record.style) {
        console.log(`  Style: ${record.style}`);
      }
      if (record.inputPath) {
        console.log(`  Input: ${record.inputPath}`);
      }
      console.log(`  Output: ${record.outputPath}`);
      console.log(`  Cost: $${record.cost.toFixed(4)}`);
      console.log(`  Duration: ${record.processingTime.toFixed(2)}s`);
      if (record.replicateUrl) {
        console.log(`  Replicate: ${record.replicateUrl}`);
      }
      if (record.comparisonPath) {
        console.log(`  Comparison: ${record.comparisonPath}`);
      }
      if (record.webVariants?.length) {
        console.log('  Web variants:');
        record.webVariants.forEach((variant) => console.log(`    • ${variant}`));
      }
      if (record.metadata && Object.keys(record.metadata).length > 0) {
        console.log('  Metadata:');
        Object.entries(record.metadata).forEach(([key, value]) => {
          console.log(`    • ${key}: ${JSON.stringify(value)}`);
        });
      }
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exitCode = 1;
    }
  });

const stylesCommand = program
  .command('styles')
  .description('List or manage style presets')
  .option('--custom', 'Show only custom styles', false)
  .option('--builtin', 'Show only built-in styles', false)
  .action((cmdOptions) => {
    try {
      printStyles(cmdOptions);
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exitCode = 1;
    }
  });

stylesCommand
  .command('add')
  .description('Create or update a custom style preset')
  .requiredOption('-k, --key <key>', 'Unique key (used with --style)')
  .requiredOption('-p, --prompt <prompt>', 'Prompt text describing the style')
  .option('-n, --name <name>', 'Display name')
  .option('-d, --description <text>', 'Short description')
  .option('-t, --tag <tag...>', 'Optional tags (repeat flag for multiple)')
  .action((options) => {
    try {
      const style = saveCustomStyle({
        key: options.key,
        name: options.name,
        prompt: options.prompt,
        description: options.description,
        tags: normaliseTags(options.tag),
      });
      console.log(`✓ Saved custom style "${style.name}" (key: ${style.key})`);
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exitCode = 1;
    }
  });

stylesCommand
  .command('remove')
  .description('Delete a custom style preset by key')
  .argument('<key>', 'Style key to remove')
  .action((key) => {
    try {
      const removed = removeCustomStyle(key);
      if (removed) {
        console.log(`✓ Removed custom style "${key}"`);
      } else {
        console.error(`No custom style found with key "${key}"`);
        process.exitCode = 1;
      }
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exitCode = 1;
    }
  });

program
  .command('validate')
  .description('Validate the configured Replicate API token')
  .action(async () => {
    try {
      const studio = new ImageStudio(getToken());
      const valid = await studio.validateApiToken();
      if (valid) {
        console.log('✓ Replicate token validated successfully');
      } else {
        console.error('Token check failed. Verify your REPLICATE_API_TOKEN.');
        process.exitCode = 1;
      }
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exitCode = 1;
    }
  });

const analytics = program
  .command('analytics')
  .description('Cost analytics and reporting for Image Studio generations');

analytics
  .command('summary')
  .description('Display total spend and usage for a given month (YYYY-MM)')
  .option('-m, --month <YYYY-MM>', 'Month to summarize (defaults to current month)')
  .option('-l, --listing-price <amount>', 'Listing price to compare against')
  .action((options) => {
    try {
      const month = resolveMonth(options.month);
      const listingPrice = parseOptionalNumber(options.listingPrice ?? options['listing-price']);
      const store = getAnalyticsStore();
      const summary = store.getMonthlySummary(month);

      console.log(`\nAnalytics summary for ${summary.month}`);
      console.log(`Total events: ${summary.totalEvents}`);
      console.log(`Total spend: $${summary.totalCost.toFixed(2)}`);
      console.log('By operation:');
      summary.byOperation.forEach((item) => {
        console.log(
          `  • ${item.operation}: ${item.count} events | $${item.totalCost.toFixed(2)} total | avg $${item.averageCost.toFixed(4)}`,
        );
      });

      if (listingPrice !== undefined) {
        const roi = listingPrice > 0 ? ((listingPrice - summary.totalCost) / listingPrice) * 100 : 0;
        console.log(`\nListing price: $${listingPrice.toFixed(2)}`);
        console.log(`Staging ROI (listing vs spend): ${roi.toFixed(2)}%`);
      }

      console.log('');
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exitCode = 1;
    }
  });

analytics
  .command('export')
  .description('Export monthly analytics data to CSV')
  .requiredOption('-o, --output <path>', 'Destination CSV file path')
  .option('-m, --month <YYYY-MM>', 'Month to export (defaults to current month)')
  .action((options) => {
    try {
      const month = resolveMonth(options.month);
      const outputPath = options.output as string;
      const absolute = path.resolve(outputPath);
      const store = getAnalyticsStore();
      store.exportMonthlyCsv(month, absolute);
      console.log(`✓ Exported analytics for ${month} to ${absolute}`);
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exitCode = 1;
    }
  });

program.parseAsync().catch((error: any) => {
  console.error(`Fatal CLI error: ${error.message}`);
  process.exit(1);
});
