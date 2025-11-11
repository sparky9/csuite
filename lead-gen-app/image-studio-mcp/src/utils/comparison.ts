import path from 'node:path';
import { ImageProcessor } from './imageProcessor.js';

const imageProcessor = new ImageProcessor();

export async function createBeforeAfter(
  originalPath: string,
  generatedPath: string,
  outputFolder: string,
  suffix = 'comparison',
): Promise<string> {
  const filename = path.basename(originalPath);
  const comparisonPath = path.join(outputFolder, `${suffix}_${filename}`);
  await imageProcessor.createComparison(originalPath, generatedPath, comparisonPath);
  return comparisonPath;
}
