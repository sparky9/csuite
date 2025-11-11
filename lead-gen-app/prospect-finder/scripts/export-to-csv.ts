import fs from 'fs';
import path from 'path';

interface YellowPagesResult {
  name: string;
  phone: string | null;
  additional_phones: string[];
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  website: string | null;
  category: string | null;
  years_in_business: number | null;
  services: string[];
  bbb_rating: string | null;
  yellow_pages_url: string;
}

function convertToCSV(businesses: YellowPagesResult[]): string {
  // CSV Headers
  const headers = [
    'Company Name',
    'Phone',
    'Additional Phones',
    'Address',
    'City',
    'State',
    'ZIP',
    'Website',
    'Category',
    'Years in Business',
    'Services',
    'BBB Rating',
    'Yellow Pages URL',
    'Notes'
  ];

  const rows = businesses.map(b => [
    b.name || '',
    b.phone || '',
    b.additional_phones.join('; ') || '',
    b.address || '',
    b.city || '',
    b.state || '',
    b.zip_code || '',
    b.website || '',
    b.category || '',
    b.years_in_business?.toString() || '',
    b.services.join('; ') || '',
    b.bbb_rating || '',
    b.yellow_pages_url || '',
    '' // Notes column for Mike to add call notes
  ]);

  // Escape CSV fields (handle commas, quotes)
  const escapeField = (field: string) => {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  };

  const csvRows = [
    headers.map(escapeField).join(','),
    ...rows.map(row => row.map(escapeField).join(','))
  ];

  return csvRows.join('\n');
}

async function main() {
  const inputFile = process.argv[2];

  if (!inputFile) {
    console.error('Usage: npm run export:csv <json-file>');
    console.error('Example: npm run export:csv test-results/yellow-pages-hvac-2025-10-17T18-01-03-522Z.json');
    process.exit(1);
  }

  if (!fs.existsSync(inputFile)) {
    console.error(`File not found: ${inputFile}`);
    process.exit(1);
  }

  // Read JSON
  const jsonData = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));

  // Convert to CSV
  const csv = convertToCSV(jsonData);

  // Output filename
  const outputFile = inputFile.replace('.json', '.csv');
  fs.writeFileSync(outputFile, csv, 'utf-8');

  console.log(`✅ CSV exported successfully!`);
  console.log(`📁 Saved to: ${outputFile}`);
  console.log(`📊 Total prospects: ${jsonData.length}`);
  console.log(`\n💡 Open in Excel or Google Sheets to start calling!`);
}

main().catch(console.error);
