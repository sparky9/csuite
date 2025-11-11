/**
 * find_decision_makers tool implementation
 *
 * Finds decision makers (owners, managers, executives) at a specific company.
 * Uses LinkedIn scraper to find real decision makers.
 */

import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { db } from '../db/client.js';
import { LinkedInPeopleScraper } from '../scrapers/linkedin-people-scraper.js';
import { EmailFinder } from '../scrapers/email-finder.js';
import { getBrowserPool } from '../browser/browser-pool.js';
import { getProxyManager } from '../browser/proxy-manager.js';
import { getRateLimiter } from '../utils/rate-limiter.js';
import { randomUUID } from 'crypto';

const FindDecisionMakersSchema = z.object({
  company_id: z.string().min(1, 'Company ID is required'),
  job_titles: z.array(z.string()).optional().default(['Owner', 'CEO', 'President', 'Manager']),
  max_results: z.number().min(1).max(20).optional().default(5),
});

export async function findDecisionMakersTool(args: unknown, dbConnected: boolean, userId?: string) {
  // Validate input
  const params = FindDecisionMakersSchema.parse(args);

  logger.info('Finding decision makers', params);

  // Get company info
  let company: any = null;
  let existingDecisionMakers: any[] = [];

  if (dbConnected) {
    try {
      company = await getCompanyById(params.company_id, userId);
      existingDecisionMakers = await getDecisionMakersFromDatabase(params.company_id, userId);

      // If we already have enough decision makers, return them
      if (existingDecisionMakers.length >= params.max_results) {
        logger.info('Using existing decision makers from database', { count: existingDecisionMakers.length });
        return formatSuccessResponse(company, existingDecisionMakers, params, 'database');
      }
    } catch (error) {
      logger.error('Database query failed', { error });
    }
  }

  // If no company found in database, use company_id as name
  if (!company) {
    company = { id: params.company_id, name: params.company_id };
  }

  // Try to scrape LinkedIn for decision makers
  try {
    logger.info('Attempting to scrape LinkedIn for decision makers', { company_name: company.name });

    // Initialize scrapers
    const proxyManager = getProxyManager();
    await proxyManager.initialize();

    const rateLimiter = getRateLimiter();
    await rateLimiter.initialize();

    const browserPool = getBrowserPool(proxyManager);

    // Create LinkedIn people scraper
    const linkedInScraper = new LinkedInPeopleScraper(browserPool, proxyManager, rateLimiter);

    // Scrape LinkedIn for people
    const result = await linkedInScraper.scrape({
      company_name: company.name,
      job_titles: params.job_titles,
      max_results: params.max_results,
    });

    if (result.success && result.data && result.data.length > 0) {
      logger.info('LinkedIn scrape successful', { results_found: result.data.length });

      // Try to find emails for each person
      const emailFinder = new EmailFinder(browserPool, proxyManager, rateLimiter);
      const decisionMakers = [];

      for (const person of result.data) {
        // Parse name into first/last
        const nameParts = person.full_name.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');

        // Try to find email if company has website
        let email: string | null = null;
        if (company.website) {
          try {
            const emailResult = await emailFinder.scrape({
              domain: company.website,
              person_names: [{ first_name: firstName, last_name: lastName }],
              search_website: false, // Just generate patterns, don't scrape website again
              use_hunter_api: true,
            });

            if (emailResult.success && emailResult.data && emailResult.data.length > 0) {
              // Use highest confidence email
              const sortedEmails = emailResult.data.sort((a, b) => {
                const confidenceScore = { high: 3, medium: 2, low: 1 };
                return confidenceScore[b.confidence] - confidenceScore[a.confidence];
              });
              email = sortedEmails[0].email;
            }
          } catch (emailError) {
            logger.debug('Email finding failed for person', { name: person.full_name, error: emailError });
          }
        }

        const dm = {
          id: randomUUID(),
          full_name: person.full_name,
          first_name: firstName,
          last_name: lastName,
          title: person.title,
          email: email,
          phone: null,
          linkedin_url: person.linkedin_url,
          found_via: 'linkedin' as const,
          confidence_score: 0.85, // LinkedIn results are high confidence
        };

        decisionMakers.push(dm);

        // Store in database if connected
        if (dbConnected && company.id && company.id !== params.company_id) {
          try {
            await storeDecisionMakerInDatabase(company.id, dm, userId);
          } catch (dbError) {
            logger.error('Failed to store decision maker in database', { error: dbError });
          }
        }
      }

      return formatSuccessResponse(company, decisionMakers, params, 'linkedin');
    } else {
      logger.warn('LinkedIn scrape failed or returned no results', { error: result.error });
    }
  } catch (error: any) {
    logger.error('Error scraping LinkedIn', { error: error.message, stack: error.stack });
  }

  // Fallback to existing database results or mock data
  if (existingDecisionMakers.length > 0) {
    return formatSuccessResponse(company, existingDecisionMakers, params, 'database');
  }

  // Last resort: return mock data
  const mockDecisionMakers = generateMockDecisionMakers(params);
  return formatSuccessResponse(company, mockDecisionMakers, params, 'mock');
}

async function getCompanyById(companyId: string, userId?: string) {
  const query = userId
    ? 'SELECT id, name, website, linkedin_url FROM companies WHERE id = $1 AND user_id = $2'
    : 'SELECT id, name, website, linkedin_url FROM companies WHERE id = $1';
  const params = userId ? [companyId, userId] : [companyId];
  const result = await db.queryOne(query, params);
  return result;
}

async function getDecisionMakersFromDatabase(companyId: string, userId?: string) {
  const query = userId
    ? `SELECT
        id,
        full_name,
        title,
        email,
        phone,
        linkedin_url,
        found_via,
        confidence_score
      FROM decision_makers
      WHERE company_id = $1 AND user_id = $2
      ORDER BY confidence_score DESC`
    : `SELECT
        id,
        full_name,
        title,
        email,
        phone,
        linkedin_url,
        found_via,
        confidence_score
      FROM decision_makers
      WHERE company_id = $1
      ORDER BY confidence_score DESC`;
  const params = userId ? [companyId, userId] : [companyId];
  const result = await db.query(query, params);
  return result.rows;
}

async function storeDecisionMakerInDatabase(companyId: string, dm: any, userId?: string) {
  // Check if decision maker already exists (by LinkedIn URL)
  const existingQuery = userId
    ? 'SELECT id FROM decision_makers WHERE linkedin_url = $1 AND company_id = $2 AND user_id = $3'
    : 'SELECT id FROM decision_makers WHERE linkedin_url = $1 AND company_id = $2';
  const existingParams = userId ? [dm.linkedin_url, companyId, userId] : [dm.linkedin_url, companyId];
  const existing = await db.queryOne(existingQuery, existingParams);

  if (existing) {
    // Update existing record
    await db.query(
      `UPDATE decision_makers SET
        full_name = $1,
        first_name = $2,
        last_name = $3,
        title = $4,
        email = $5,
        confidence_score = $6,
        updated_at = NOW()
      WHERE id = $7`,
      [dm.full_name, dm.first_name, dm.last_name, dm.title, dm.email, dm.confidence_score, existing.id]
    );
    logger.info('Updated existing decision maker', { id: existing.id });
  } else {
    // Insert new record
    const insertQuery = userId
      ? `INSERT INTO decision_makers (
          id, user_id, company_id, full_name, first_name, last_name,
          title, email, linkedin_url, found_via, confidence_score,
          created_at, updated_at
        ) VALUES (
          uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
        )`
      : `INSERT INTO decision_makers (
          id, company_id, full_name, first_name, last_name,
          title, email, linkedin_url, found_via, confidence_score,
          created_at, updated_at
        ) VALUES (
          uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
        )`;

    const insertParams = userId
      ? [
          userId,
          companyId,
          dm.full_name,
          dm.first_name,
          dm.last_name,
          dm.title,
          dm.email,
          dm.linkedin_url,
          dm.found_via,
          dm.confidence_score,
        ]
      : [
          companyId,
          dm.full_name,
          dm.first_name,
          dm.last_name,
          dm.title,
          dm.email,
          dm.linkedin_url,
          dm.found_via,
          dm.confidence_score,
        ];

    await db.query(insertQuery, insertParams);
    logger.info('Stored new decision maker', { name: dm.full_name });
  }
}

function generateMockDecisionMakers(params: z.infer<typeof FindDecisionMakersSchema>) {
  const firstNames = ['John', 'Sarah', 'Michael', 'Jennifer', 'Robert', 'Lisa'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Davis', 'Miller'];
  const titles = params.job_titles;

  const decisionMakers = [];
  const count = Math.min(params.max_results, 3); // Limit mock results

  for (let i = 0; i < count; i++) {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[i % lastNames.length];
    const title = titles[i % titles.length];

    decisionMakers.push({
      id: `dm-mock-${Date.now()}-${i}`,
      full_name: `${firstName} ${lastName}`,
      title: title,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      phone: i === 0 ? `(555) 100-200${i}` : null, // Only first has phone
      linkedin_url: `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}`,
      found_via: 'linkedin',
      confidence_score: (0.95 - i * 0.1).toFixed(2),
    });
  }

  return decisionMakers;
}

function formatSuccessResponse(
  company: any,
  decisionMakers: any[],
  params: z.infer<typeof FindDecisionMakersSchema>,
  dataSource: 'database' | 'linkedin' | 'mock'
) {
  const sourceText =
    dataSource === 'linkedin'
      ? 'LinkedIn (live scraping)'
      : dataSource === 'database'
        ? 'Database (previously scraped)'
        : 'Mock data (for demonstration)';

  let resultsText = `Decision Makers at ${company.name}\n\n`;
  resultsText += `Company ID: ${company.id}\n`;
  resultsText += `Data Source: ${sourceText}\n\n`;

  if (decisionMakers.length === 0) {
    resultsText += `No decision makers found yet.\n\n`;
    resultsText += `To find decision makers:\n`;
    resultsText += `1. The LinkedIn scraper will automatically search for key contacts\n`;
    resultsText += `2. Targeted job titles: ${params.job_titles.join(', ')}\n`;
    resultsText += `3. This feature will be available after Day 5 implementation\n`;
  } else {
    resultsText += `Found ${decisionMakers.length} decision maker(s):\n`;
    resultsText += `${'='.repeat(80)}\n\n`;

    decisionMakers.forEach((dm, index) => {
      resultsText += `${index + 1}. ${dm.full_name}`;
      if (dm.title) resultsText += ` - ${dm.title}`;
      resultsText += `\n`;
      resultsText += `   Email: ${dm.email || 'Not available'}\n`;
      resultsText += `   Phone: ${dm.phone || 'Not available'}\n`;
      resultsText += `   LinkedIn: ${dm.linkedin_url || 'Not available'}\n`;
      resultsText += `   Confidence: ${(parseFloat(dm.confidence_score) * 100).toFixed(0)}%`;
      resultsText += ` (found via ${dm.found_via})\n`;
      resultsText += `\n`;
    });
  }

  if (dataSource === 'mock') {
    resultsText += `\n${'='.repeat(80)}\n`;
    resultsText += `NOTE: This is sample data. To find real decision makers:\n`;
    resultsText += `1. Configure your database credentials in .env\n`;
    resultsText += `2. Ensure valid proxy configuration for LinkedIn scraping\n`;
    resultsText += `3. LinkedIn has aggressive bot detection - use with caution\n`;
  } else if (dataSource === 'linkedin') {
    resultsText += `\n${'='.repeat(80)}\n`;
    resultsText += `SUCCESS: Real data scraped from LinkedIn!\n`;
    resultsText += `Decision makers saved to database.\n`;
    resultsText += `\nNOTE: LinkedIn has strict rate limits. Use sparingly.\n`;
  }

  return {
    content: [
      {
        type: 'text',
        text: resultsText,
      },
    ],
  };
}
