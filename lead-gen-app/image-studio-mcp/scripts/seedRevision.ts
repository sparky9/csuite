import path from 'node:path';
import { RevisionStore } from '../src/workflow/revisionStore.js';
import { REVISION_STORE_PATH } from '../src/config/constants.js';

const store = new RevisionStore(REVISION_STORE_PATH);

const now = new Date().toISOString();

const sampleId = await store.record({
  operation: 'stage_image',
  inputPath: path.resolve('data', 'sample-input.png'),
  outputPath: path.resolve('data', 'sample-output.png'),
  prompt: 'staging seed run',
  style: 'ikea_modern',
  comparisonPath: path.resolve('data', 'sample-comparison.png'),
  webVariants: [path.resolve('data', 'sample-output-512.webp')],
  replicateUrl: 'https://replicate.com/mock/run',
  cost: 0,
  processingTime: 0,
  metadata: {
    seeded: true,
    note: 'Revision seeded locally for CLI validation',
    batchId: 'seed-batch',
    timestamp: now,
  },
});

console.log(`Seeded revision ${sampleId}`);
