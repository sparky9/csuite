import fs from 'fs';
import { logger } from '../src/utils/logger.js';

interface Business {
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  [key: string]: any;
}

function normalizePhone(phone: string | null): string {
  if (!phone) return '';
  return phone.replace(/\D/g, ''); // Remove all non-digits
}

function normalizeString(str: string | null): string {
  if (!str) return '';
  return str.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

function isDuplicate(b1: Business, b2: Business): boolean {
  // Exact phone match
  const phone1 = normalizePhone(b1.phone);
  const phone2 = normalizePhone(b2.phone);
  if (phone1 && phone2 && phone1 === phone2) {
    return true;
  }

  // Name + city match
  const name1 = normalizeString(b1.name);
  const name2 = normalizeString(b2.name);
  const city1 = normalizeString(b1.city);
  const city2 = normalizeString(b2.city);

  if (name1 === name2 && city1 === city2) {
    return true;
  }

  return false;
}

function deduplicate(businesses: Business[]): Business[] {
  const unique: Business[] = [];
  const seen = new Set<string>();

  for (const business of businesses) {
    let isDupe = false;

    for (const existing of unique) {
      if (isDuplicate(business, existing)) {
        isDupe = true;
        break;
      }
    }

    if (!isDupe) {
      unique.push(business);
    }
  }

  return unique;
}

async function main() {
  const inputFile = process.argv[2];

  if (!inputFile) {
    console.error('Usage: npm run dedupe <json-file>');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
  console.log(`Original count: ${data.length}`);

  const deduped = deduplicate(data);
  console.log(`After deduplication: ${deduped.length}`);
  console.log(`Removed: ${data.length - deduped.length} duplicates`);

  // Save
  const outputFile = inputFile.replace('.json', '-deduped.json');
  fs.writeFileSync(outputFile, JSON.stringify(deduped, null, 2));
  console.log(`Saved to: ${outputFile}`);
}

main().catch(console.error);
