/**
 * Transform Clegg living room images with MAXIMUM preservation (v2)
 *
 * Version 2: Using even lower strength (0.35) for better preservation
 * Previous attempt at 0.55 still changed too much
 */

import { ImageStudio } from './src/core/stager.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config();

const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;
if (!REPLICATE_TOKEN) {
  throw new Error('REPLICATE_API_TOKEN not found in environment');
}

// Ultra-specific preservation prompt with stronger emphasis
const TRANSFORMATION_PROMPT = `Interior design: Add minimal elegant modern furniture (sofa, coffee table, side chair). Paint walls soft champagne gold (#C4B896). CRITICAL PRESERVATION REQUIREMENTS: Keep exact same camera angle and perspective. Keep exact same window positions, size, style, and frames - do not change windows at all. Keep exact same hardwood floor pattern. Keep exact same wall positions and room shape. Keep exact same ceiling and light fixtures. Keep exact same architectural details. Only add furniture and change wall paint - nothing else.`;

const NEGATIVE_PROMPT = 'changed windows, different window style, altered perspective, different camera angle, modified room layout, changed floor, different ceiling, moved walls, architectural changes, structural modifications, different window placement, window redesign';

async function main() {
  console.log('Starting Clegg transformation v2 with ULTRA preservation...\n');
  console.log('Strategy: Lower strength (0.35) + stronger preservation keywords\n');

  const studio = new ImageStudio(REPLICATE_TOKEN);

  try {
    const isValid = await studio.validateApiToken();
    if (isValid) {
      console.log('Token validated\n');
    }
  } catch (error) {
    console.log('Continuing without validation\n');
  }

  const inputFolder = path.join(__dirname, 'images');
  const outputFolder = path.join(__dirname, 'data', 'staged');

  const images = [
    {
      input: path.join(inputFolder, 'clegg - 2.jpg'),
      output: path.join(outputFolder, 'clegg-2-preserved-v2.jpg'),
      name: 'Clegg-2-v2'
    },
    {
      input: path.join(inputFolder, 'clegg - 3.jpg'),
      output: path.join(outputFolder, 'clegg-3-preserved-v2.jpg'),
      name: 'Clegg-3-v2'
    }
  ];

  const results = [];

  for (const image of images) {
    console.log(`${'='.repeat(60)}`);
    console.log(`Processing: ${image.name}`);
    console.log(`Strength: 0.35 (much lower for preservation)`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      const startTime = Date.now();

      const result = await studio.transformImageFile({
        inputPath: image.input,
        outputPath: image.output,
        prompt: TRANSFORMATION_PROMPT,
        negativePrompt: NEGATIVE_PROMPT,
        strength: 0.35,  // Much lower = maximum preservation
        imageResolution: 1024,
        webAssets: true,
        numSamples: 1,
        model: 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
      });

      const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log(`${image.name} completed!`);
      console.log(`  Cost: $${result.cost.toFixed(4)}`);
      console.log(`  Time: ${processingTime}s\n`);

      results.push({
        name: image.name,
        success: true,
        cost: result.cost,
        outputPath: result.outputPath,
      });

    } catch (error: any) {
      console.error(`Error: ${error.message}\n`);
      results.push({
        name: image.name,
        success: false,
        error: error.message
      });
    }
  }

  const successful = results.filter(r => r.success);
  const totalCost = successful.reduce((sum, r) => sum + (r.cost || 0), 0);

  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Successful: ${successful.length}/2`);
  console.log(`Total cost: $${totalCost.toFixed(4)}`);

  if (successful.length > 0) {
    console.log('\nOutputs:');
    successful.forEach(r => {
      console.log(`  - ${r.outputPath}`);
    });
  }

  console.log('\nNote: Compare v2 results with v1 to see if lower strength');
  console.log('preserved the structure better. If still not satisfactory,');
  console.log('we may need to use a different approach (ControlNet, inpainting, etc.)\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
