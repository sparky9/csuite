/**
 * Transform Clegg living room images with maximum preservation
 *
 * This script uses the transform_image tool with low strength to:
 * 1. Add high-end furniture for young professional couple
 * 2. Change wall color to warm champagne gold (#C4B896)
 * 3. Preserve all existing room structure, windows, flooring, and perspective
 */

import { ImageStudio } from './src/core/stager.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config();

const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;
if (!REPLICATE_TOKEN) {
  throw new Error('REPLICATE_API_TOKEN not found in environment');
}

// Define the exact gold color from the sample image
const GOLD_COLOR = 'warm champagne gold color (#C4B896 hex, muted beige-gold tone)';

// Create a very specific prompt that emphasizes preservation
const TRANSFORMATION_PROMPT = `Add elegant high-end modern furniture suitable for a young professional couple living room. Paint the walls ${GOLD_COLOR}. CRITICAL: Preserve the exact existing room structure - keep the same windows (style, size, position), same hardwood flooring, same ceiling with chandelier, same wall positions, same room dimensions, and same camera perspective. Only add furniture and change wall paint color. Do not alter, modify, or change the windows, room layout, flooring pattern, or viewing angle in any way.`;

// Negative prompt to reinforce what NOT to change
const NEGATIVE_PROMPT = 'different windows, altered perspective, changed room layout, modified floor, different ceiling, relocated walls, different camera angle, architectural changes, structural modifications';

async function main() {
  console.log('Starting Clegg living room transformation with maximum preservation...\n');
  console.log('Gold color target:', GOLD_COLOR);
  console.log('Transformation strength: 0.55 (lower = more preservation)\n');

  const studio = new ImageStudio(REPLICATE_TOKEN);

  // Validate API token first (skip if it fails, try to continue anyway)
  console.log('Validating Replicate API token...');
  try {
    const isValid = await studio.validateApiToken();
    if (isValid) {
      console.log('Token validated successfully!\n');
    } else {
      console.log('API token validation returned false, but continuing...\n');
    }
  } catch (error) {
    console.log('API token validation failed, but continuing anyway...\n');
  }

  // Define input and output paths
  const inputFolder = path.join(__dirname, 'images');
  const outputFolder = path.join(__dirname, 'data', 'staged');

  const images = [
    {
      input: path.join(inputFolder, 'clegg - 2.jpg'),
      output: path.join(outputFolder, 'clegg-2-preserved.jpg'),
      name: 'Clegg-2'
    },
    {
      input: path.join(inputFolder, 'clegg - 3.jpg'),
      output: path.join(outputFolder, 'clegg-3-preserved.jpg'),
      name: 'Clegg-3'
    }
  ];

  const results = [];

  // Process each image sequentially to monitor progress
  for (const image of images) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing: ${image.name}`);
    console.log(`Input:  ${image.input}`);
    console.log(`Output: ${image.output}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      const startTime = Date.now();

      const result = await studio.transformImageFile({
        inputPath: image.input,
        outputPath: image.output,
        prompt: TRANSFORMATION_PROMPT,
        negativePrompt: NEGATIVE_PROMPT,
        strength: 0.55,  // Lower strength = more preservation of original
        imageResolution: 1024,
        webAssets: true,
        numSamples: 1,
        // Use SDXL img2img model which supports strength parameter
        model: 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
      });

      const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log(`\n${image.name} completed successfully!`);
      console.log(`  Output path: ${result.outputPath}`);
      console.log(`  Cost: $${result.cost.toFixed(4)}`);
      console.log(`  Processing time: ${processingTime}s`);
      console.log(`  Replicate URL: ${result.replicateUrl}`);

      if (result.webVariants && result.webVariants.length > 0) {
        console.log(`  Web variants generated: ${result.webVariants.length}`);
      }

      results.push({
        name: image.name,
        success: true,
        cost: result.cost,
        processingTime,
        outputPath: result.outputPath,
        webVariants: result.webVariants
      });

    } catch (error: any) {
      console.error(`\nError processing ${image.name}:`, error.message);
      results.push({
        name: image.name,
        success: false,
        error: error.message
      });
    }
  }

  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('TRANSFORMATION SUMMARY');
  console.log(`${'='.repeat(60)}\n`);

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const totalCost = successful.reduce((sum, r) => sum + (r.cost || 0), 0);

  console.log(`Total images processed: ${results.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);
  console.log(`Total cost: $${totalCost.toFixed(4)}`);

  if (successful.length > 0) {
    console.log('\nSuccessful transformations:');
    successful.forEach(r => {
      console.log(`  - ${r.name}: ${r.outputPath}`);
      if (r.webVariants && r.webVariants.length > 0) {
        console.log(`    Web variants: ${r.webVariants.length} files`);
      }
    });
  }

  if (failed.length > 0) {
    console.log('\nFailed transformations:');
    failed.forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('PRESERVATION CHECKLIST');
  console.log('='.repeat(60) + '\n');
  console.log('Please verify the transformed images maintain:');
  console.log('  [ ] Same camera angle/perspective');
  console.log('  [ ] Same window style, size, and position');
  console.log('  [ ] Same hardwood flooring pattern');
  console.log('  [ ] Same wall positions and room dimensions');
  console.log('  [ ] Same ceiling height and chandelier');
  console.log('  [ ] Same room layout and structure');
  console.log('  [ ] Consistent gold wall color between both images');
  console.log('  [ ] High-end furniture added appropriately');
  console.log('\nIf any preservation issues exist, try:');
  console.log('  1. Lower strength value (0.45 or 0.40)');
  console.log('  2. More explicit preservation keywords in prompt');
  console.log('  3. Different AI model if available\n');

  console.log('Transformation complete!\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
