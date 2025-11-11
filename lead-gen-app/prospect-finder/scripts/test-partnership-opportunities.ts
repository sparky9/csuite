/**
 * Test script for find_partnership_opportunities tool
 *
 * Usage: npm run test:partnership-opportunities
 */

import { findPartnershipOpportunitiesTool } from '../src/tools/find-partnership-opportunities.tool.js';
import { logger } from '../src/utils/logger.js';

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('PARTNERSHIP OPPORTUNITIES TEST');
  console.log('='.repeat(80) + '\n');

  // Test parameters
  const testParams = {
    userId: 'test-user-001',
    yourIndustry: 'web design',
    location: 'Dallas, TX',
    maxResults: 5, // Keep it small for testing
  };

  logger.info('Testing find_partnership_opportunities tool', testParams);
  console.log('Test Parameters:', JSON.stringify(testParams, null, 2));
  console.log('\nSearching for partnership opportunities...\n');

  try {
    const result = await findPartnershipOpportunitiesTool(testParams, false);

    // Parse the response
    if (result.content && result.content[0] && 'text' in result.content[0]) {
      const response = JSON.parse(result.content[0].text);

      console.log('='.repeat(80));
      console.log('RESULTS');
      console.log('='.repeat(80));

      console.log(`\nTotal Opportunities Found: ${response.opportunities.length}`);
      console.log(`User Industry: ${response.summary.userIndustry}`);
      console.log(`Location: ${response.summary.location}`);
      console.log(`\nComplementary Industries Searched:`);
      response.summary.complementaryIndustries.forEach((industry: string, idx: number) => {
        console.log(`  ${idx + 1}. ${industry}`);
      });

      console.log('\n' + '-'.repeat(80));
      console.log('PARTNERSHIP OPPORTUNITIES');
      console.log('-'.repeat(80) + '\n');

      response.opportunities.forEach((opp: any, idx: number) => {
        console.log(`${idx + 1}. ${opp.companyName}`);
        console.log(`   Industry: ${opp.industry}`);
        console.log(`   Synergy: ${opp.synergy}`);
        console.log(`   Website: ${opp.website || 'N/A'}`);
        console.log(`   Phone: ${opp.phone || 'N/A'}`);
        console.log(`   Address: ${opp.address || 'N/A'}`);
        if (opp.rating) {
          console.log(`   Rating: ${opp.rating}/5.0`);
        }
        console.log('');
      });

      console.log('='.repeat(80));
      console.log('TEST COMPLETED SUCCESSFULLY');
      console.log('='.repeat(80) + '\n');
    } else {
      console.error('Unexpected response format:', result);
    }
  } catch (error) {
    logger.error('Partnership opportunities test failed', { error });
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
