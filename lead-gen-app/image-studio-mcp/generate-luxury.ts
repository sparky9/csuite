/**
 * Generate luxury staged versions of clegg-2 and clegg-3
 * With warm champagne-gold walls and upscale young couple aesthetic
 */

import { ImageStudio } from './src/core/stager.js';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config();

const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;
if (!REPLICATE_TOKEN) {
  console.error('Error: REPLICATE_API_TOKEN not found in .env');
  process.exit(1);
}

// Custom luxury style prompt for young professional couple
const LUXURY_YOUNG_COUPLE_STYLE = `
luxury modern living room, warm champagne gold painted walls,
high-end contemporary furniture in rich textures,
sophisticated young professional couple aesthetic,
upscale West Elm and Article style furniture,
plush velvet sofa in deep jewel tones,
elegant brass and gold metal accents,
modern abstract art on walls,
designer lighting fixtures,
tasteful decorative objects,
cozy yet refined ambiance,
natural light, professional staging,
high-end interior design photography,
luxurious but not gaudy, warm inviting atmosphere
`.trim().replace(/\s+/g, ' ');

async function main() {
  console.log('Initializing Image Studio...');
  const studio = new ImageStudio(REPLICATE_TOKEN);

  // Validate API token (skip if it fails, try to continue anyway)
  try {
    const isValid = await studio.validateApiToken();
    if (isValid) {
      console.log('API token validated successfully');
    } else {
      console.log('API token validation returned false, but continuing...');
    }
  } catch (error) {
    console.log('API token validation failed, but continuing anyway...');
  }
  console.log('');

  // Define paths
  const baseDir = __dirname;
  const inputClegg2 = path.join(baseDir, 'images', 'clegg - 2.jpg');
  const inputClegg3 = path.join(baseDir, 'images', 'clegg - 3.jpg');
  const outputClegg2 = path.join(baseDir, 'data', 'staged', 'clegg-2-luxury.jpg');
  const outputClegg3 = path.join(baseDir, 'data', 'staged', 'clegg-3-luxury.jpg');

  console.log('='.repeat(60));
  console.log('TASK 1: Generating clegg-2-luxury.jpg');
  console.log('='.repeat(60));
  console.log('Input:', inputClegg2);
  console.log('Output:', outputClegg2);
  console.log('Style: Luxury young couple with champagne-gold walls');
  console.log('');

  try {
    const result1 = await studio.stageImageFile(
      inputClegg2,
      outputClegg2,
      {
        style: LUXURY_YOUNG_COUPLE_STYLE,
        imageResolution: 1024,
        promptStrength: 0.85,
        numSamples: 1,
        webAssets: true,
      },
      true, // create comparison
    );

    console.log('SUCCESS!');
    console.log('  Staged image saved:', result1.stagedPath);
    console.log('  Comparison board:', result1.comparisonPath || 'N/A');
    console.log('  Cost: $' + result1.cost.toFixed(4));
    console.log('  Processing time:', result1.processingTime.toFixed(2), 'seconds');
    if (result1.webVariants && result1.webVariants.length > 0) {
      console.log('  Web variants:', result1.webVariants.length, 'files');
    }
    console.log('');
  } catch (error) {
    console.error('FAILED to generate clegg-2-luxury.jpg');
    console.error(error);
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('TASK 2: Generating clegg-3-luxury.jpg');
  console.log('='.repeat(60));
  console.log('Input:', inputClegg3);
  console.log('Output:', outputClegg3);
  console.log('Style: Same luxury style with window area focus');
  console.log('');

  // For clegg-3, we want to maintain the same style but emphasize the window area
  const CLEGG3_STYLE = `
${LUXURY_YOUNG_COUPLE_STYLE},
focus on window area with elegant window treatments,
sophisticated curtains or roman shades,
cozy seating near window, reading nook aesthetic,
maintain consistent champagne gold walls and upscale furniture style
`.trim().replace(/\s+/g, ' ');

  try {
    const result2 = await studio.stageImageFile(
      inputClegg3,
      outputClegg3,
      {
        style: CLEGG3_STYLE,
        imageResolution: 1024,
        promptStrength: 0.85,
        numSamples: 1,
        webAssets: true,
      },
      true, // create comparison
    );

    console.log('SUCCESS!');
    console.log('  Staged image saved:', result2.stagedPath);
    console.log('  Comparison board:', result2.comparisonPath || 'N/A');
    console.log('  Cost: $' + result2.cost.toFixed(4));
    console.log('  Processing time:', result2.processingTime.toFixed(2), 'seconds');
    if (result2.webVariants && result2.webVariants.length > 0) {
      console.log('  Web variants:', result2.webVariants.length, 'files');
    }
    console.log('');
  } catch (error) {
    console.error('FAILED to generate clegg-3-luxury.jpg');
    console.error(error);
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('GENERATION COMPLETE!');
  console.log('='.repeat(60));
  console.log('Both luxury living room images have been generated successfully.');
  console.log('');
  console.log('Outputs:');
  console.log('  1. clegg-2-luxury.jpg - Main living room with gold walls');
  console.log('  2. clegg-3-luxury.jpg - Window area with matching style');
  console.log('');
  console.log('Check the data/staged/ folder for your new images!');
}

main().catch(console.error);
