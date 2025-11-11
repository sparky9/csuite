import fs from 'fs';

async function main() {
  const inputFile = process.argv[2];

  if (!inputFile) {
    console.error('Usage: npm run stats <json-file>');
    process.exit(1);
  }

  const businesses = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));

  console.log('\n📊 PROSPECT STATISTICS\n');
  console.log(`Total Prospects: ${businesses.length}\n`);

  // Completeness
  const withPhone = businesses.filter((b: any) => b.phone).length;
  const withWebsite = businesses.filter((b: any) => b.website).length;
  const withAddress = businesses.filter((b: any) => b.address).length;
  const withYears = businesses.filter((b: any) => b.years_in_business).length;

  console.log('Data Completeness:');
  console.log(`  Phone: ${withPhone} (${(withPhone/businesses.length*100).toFixed(1)}%)`);
  console.log(`  Website: ${withWebsite} (${(withWebsite/businesses.length*100).toFixed(1)}%)`);
  console.log(`  Address: ${withAddress} (${(withAddress/businesses.length*100).toFixed(1)}%)`);
  console.log(`  Years in Business: ${withYears} (${(withYears/businesses.length*100).toFixed(1)}%)`);

  // Categories
  const categories: Record<string, number> = {};
  businesses.forEach((b: any) => {
    if (b.category) {
      categories[b.category] = (categories[b.category] || 0) + 1;
    }
  });

  console.log('\nTop Categories:');
  Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count}`);
    });

  // Locations
  const locations: Record<string, number> = {};
  businesses.forEach((b: any) => {
    const loc = `${b.city}, ${b.state}`;
    locations[loc] = (locations[loc] || 0) + 1;
  });

  console.log('\nTop Locations:');
  Object.entries(locations)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([loc, count]) => {
      console.log(`  ${loc}: ${count}`);
    });
}

main().catch(console.error);
