import { execSync } from 'child_process';

const presets: Record<string, { industry: string; locations: string[]; count: number }> = {
  'hvac-texas': { industry: 'hvac', locations: ['Dallas, TX', 'Houston, TX', 'Austin, TX'], count: 30 },
  'plumbing-fl': { industry: 'plumbing', locations: ['Miami, FL', 'Tampa, FL', 'Orlando, FL'], count: 30 },
  'electrical-az': { industry: 'electrical contractor', locations: ['Phoenix, AZ', 'Tucson, AZ'], count: 30 },
  'roofing-ca': { industry: 'roofing contractor', locations: ['Los Angeles, CA', 'San Diego, CA'], count: 30 }
};

async function main() {
  const preset = process.argv[2];

  if (!preset || !presets[preset]) {
    console.log('Available quick searches:');
    Object.keys(presets).forEach(key => {
      console.log(`  - ${key}`);
    });
    console.log('\nUsage: npm run quick-search <preset>');
    console.log('Example: npm run quick-search hvac-texas');
    process.exit(1);
  }

  const config = presets[preset];
  console.log(`Running quick search: ${preset}`);
  console.log(`Industry: ${config.industry}`);
  console.log(`Locations: ${config.locations.join(', ')}`);

  for (const location of config.locations) {
    console.log(`\nSearching: ${config.industry} in ${location}...`);
    execSync(
      `npm run test:yellow-pages -- "${config.industry}" "${location}" ${config.count}`,
      { stdio: 'inherit' }
    );
  }

  console.log('\n✅ Quick search complete!');
  console.log('Check test-results/ folder for JSON files');
}

main().catch(console.error);
