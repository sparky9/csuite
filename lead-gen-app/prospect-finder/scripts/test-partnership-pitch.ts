/**
 * Test script for generate_partnership_pitch tool
 *
 * Usage: npm run test:partnership-pitch
 */

import { generatePartnershipPitchTool } from '../src/tools/generate-partnership-pitch.tool.js';
import { logger } from '../src/utils/logger.js';

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('PARTNERSHIP PITCH GENERATION TEST');
  console.log('='.repeat(80) + '\n');

  // Test parameters
  const testParams = {
    partnerCompany: 'Cloud Hosting Solutions',
    partnerIndustry: 'web hosting',
    proposedCollaboration: 'referral program with commission sharing',
  };

  logger.info('Testing generate_partnership_pitch tool', testParams);
  console.log('Test Parameters:', JSON.stringify(testParams, null, 2));
  console.log('\nGenerating partnership pitch...\n');

  try {
    const result = await generatePartnershipPitchTool(testParams);

    // Parse the response
    if (result.content && result.content[0] && 'text' in result.content[0]) {
      const pitch = JSON.parse(result.content[0].text);

      console.log('='.repeat(80));
      console.log('GENERATED PARTNERSHIP PITCH');
      console.log('='.repeat(80) + '\n');

      console.log('SUBJECT LINE:');
      console.log('-'.repeat(80));
      console.log(pitch.subject);
      console.log('');

      console.log('EMAIL BODY:');
      console.log('-'.repeat(80));
      console.log(pitch.emailBody);
      console.log('');

      console.log('PROPOSED TERMS:');
      console.log('-'.repeat(80));
      if (pitch.proposedTerms && pitch.proposedTerms.length > 0) {
        pitch.proposedTerms.forEach((term: string, idx: number) => {
          console.log(`${idx + 1}. ${term}`);
        });
      } else {
        console.log('No proposed terms generated');
      }
      console.log('');

      if (pitch.note) {
        console.log('NOTE:');
        console.log('-'.repeat(80));
        console.log(pitch.note);
        console.log('');
      }

      console.log('='.repeat(80));
      console.log('TEST COMPLETED SUCCESSFULLY');
      console.log('='.repeat(80) + '\n');

      // Check if it's mock data
      if (pitch.note && pitch.note.includes('MOCK DATA')) {
        console.log('⚠️  Note: This is mock data. Set ANTHROPIC_API_KEY for AI-generated pitches.\n');
      }
    } else if (result.isError) {
      console.error('\n' + '='.repeat(80));
      console.error('TEST FAILED');
      console.error('='.repeat(80));
      console.error('Error:', result.content[0] && 'text' in result.content[0] ? result.content[0].text : 'Unknown error');
      console.error('');
      process.exit(1);
    } else {
      console.error('Unexpected response format:', result);
    }
  } catch (error) {
    logger.error('Partnership pitch test failed', { error });
    console.error('\n' + '='.repeat(80));
    console.error('TEST FAILED');
    console.error('='.repeat(80));
    console.error('Error:', error instanceof Error ? error.message : String(error));
    console.error('');
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error('Test script failed', { error });
  console.error('Test script failed:', error);
  process.exit(1);
});
