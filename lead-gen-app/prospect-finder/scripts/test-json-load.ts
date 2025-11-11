/**
 * Test script to verify complementary industries JSON loads correctly
 */

import complementaryIndustriesData from '../src/data/complementary-industries.json' with { type: 'json' };

console.log('\n' + '='.repeat(80));
console.log('JSON LOADING TEST - Complementary Industries');
console.log('='.repeat(80) + '\n');

const COMPLEMENTARY_INDUSTRIES: Record<string, string[]> = complementaryIndustriesData as Record<string, string[]>;

// Validate that data loaded successfully
if (!COMPLEMENTARY_INDUSTRIES || Object.keys(COMPLEMENTARY_INDUSTRIES).length === 0) {
  console.error('❌ FAILED: Data file is empty or invalid');
  process.exit(1);
}

console.log('✅ JSON data loaded successfully!');
console.log(`Total industries in mapping: ${Object.keys(COMPLEMENTARY_INDUSTRIES).length}`);
console.log('');

// Test a few lookups
const testIndustries = ['web design', 'hvac', 'accounting', 'photography'];

console.log('Testing industry lookups:');
console.log('-'.repeat(80));

for (const industry of testIndustries) {
  const complementaries = COMPLEMENTARY_INDUSTRIES[industry];
  if (complementaries && complementaries.length > 0) {
    console.log(`\n✅ ${industry}:`);
    complementaries.forEach((comp, idx) => {
      console.log(`   ${idx + 1}. ${comp}`);
    });
  } else {
    console.log(`\n❌ ${industry}: No complementary industries found`);
  }
}

console.log('\n' + '='.repeat(80));
console.log('TEST COMPLETED SUCCESSFULLY');
console.log('='.repeat(80) + '\n');
