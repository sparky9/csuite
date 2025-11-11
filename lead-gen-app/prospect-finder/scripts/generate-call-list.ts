import fs from 'fs';

interface Business {
  name: string;
  phone: string | null;
  website: string | null;
  years_in_business: number | null;
  bbb_rating: string | null;
  services: string[];
  [key: string]: any;
}

interface ScoredBusiness extends Business {
  priority_score: number;
  priority_reasons: string[];
}

function scoreProspect(business: Business): ScoredBusiness {
  let score = 0;
  const reasons: string[] = [];

  // Has phone (required)
  if (business.phone) {
    score += 10;
  } else {
    score = 0; // Can't call without phone
  }

  // Has website (shows professionalism)
  if (business.website) {
    score += 5;
    reasons.push('Has website');
  }

  // Years in business (established = more likely to need services)
  if (business.years_in_business) {
    if (business.years_in_business >= 10) {
      score += 8;
      reasons.push(`${business.years_in_business}+ years established`);
    } else if (business.years_in_business >= 5) {
      score += 5;
      reasons.push('5+ years in business');
    } else {
      score += 2;
      reasons.push('New business');
    }
  }

  // BBB Rating
  if (business.bbb_rating) {
    score += 3;
    reasons.push('BBB rated');
  }

  // Services listed (shows detail-oriented)
  if (business.services && business.services.length > 0) {
    score += business.services.length;
    reasons.push(`${business.services.length} services listed`);
  }

  return {
    ...business,
    priority_score: score,
    priority_reasons: reasons
  };
}

async function main() {
  const inputFile = process.argv[2];

  if (!inputFile) {
    console.error('Usage: npm run call-list <json-file>');
    process.exit(1);
  }

  const businesses: Business[] = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));

  // Score and sort
  const scored = businesses
    .map(scoreProspect)
    .filter(b => b.phone) // Only callable prospects
    .sort((a, b) => b.priority_score - a.priority_score);

  console.log(`\n📞 PRIORITIZED CALL LIST`);
  console.log(`Total prospects: ${scored.length}\n`);

  // Top 20
  scored.slice(0, 20).forEach((b, idx) => {
    console.log(`${idx + 1}. ${b.name} (Score: ${b.priority_score})`);
    console.log(`   📞 ${b.phone}`);
    if (b.priority_reasons.length > 0) {
      console.log(`   ⭐ ${b.priority_reasons.join(', ')}`);
    }
    console.log('');
  });

  // Save full list
  const outputFile = inputFile.replace('.json', '-call-list.json');
  fs.writeFileSync(outputFile, JSON.stringify(scored, null, 2));
  console.log(`Full call list saved to: ${outputFile}`);
}

main().catch(console.error);
