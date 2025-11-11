/**
 * export_prospects tool implementation
 *
 * Exports prospect data for outreach in various formats (CSV, JSON, Google Sheets).
 * Includes filtering by quality score, industry, location, and decision makers.
 */

import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { db } from '../db/client.js';

const ExportProspectsSchema = z.object({
  company_ids: z.array(z.string()).optional(),
  filters: z
    .object({
      min_quality_score: z.number().min(0).max(1).optional(),
      industries: z.array(z.string()).optional(),
      states: z.array(z.string()).optional(),
      has_email: z.boolean().optional(),
      has_phone: z.boolean().optional(),
      has_decision_makers: z.boolean().optional(),
    })
    .optional(),
  format: z.enum(['csv', 'json', 'google_sheets']),
  include_decision_makers: z.boolean().optional().default(true),
});

export async function exportProspectsTool(args: unknown, dbConnected: boolean, userId?: string) {
  // Validate input
  const params = ExportProspectsSchema.parse(args);

  logger.info('Exporting prospects', params);

  // If database is connected, export real data
  if (dbConnected) {
    try {
      const companies = await queryCompaniesForExport(params, userId);
      const decisionMakers = params.include_decision_makers
        ? await queryDecisionMakersForCompanies(companies.map((c) => c.id), userId)
        : [];

      if (companies.length > 0) {
        return formatExportResponse(companies, decisionMakers, params, true);
      }
    } catch (error) {
      logger.error('Database query failed, falling back to mock data', { error });
    }
  }

  return formatErrorResponse(params);
}

async function queryCompaniesForExport(params: z.infer<typeof ExportProspectsSchema>, userId?: string) {
  const filters = params.filters || {};
  const conditions: string[] = userId ? ['user_id = $1'] : ['1=1'];
  const queryParams: any[] = userId ? [userId] : [];
  let paramIndex = userId ? 2 : 1;

  // Build WHERE clause based on filters
  if (params.company_ids && params.company_ids.length > 0) {
    conditions.push(`id = ANY($${paramIndex}::uuid[])`);
    queryParams.push(params.company_ids);
    paramIndex++;
  }

  if (filters.min_quality_score !== undefined) {
    conditions.push(`data_quality_score >= $${paramIndex}`);
    queryParams.push(filters.min_quality_score);
    paramIndex++;
  }

  if (filters.industries && filters.industries.length > 0) {
    conditions.push(`business_category = ANY($${paramIndex}::text[])`);
    queryParams.push(filters.industries);
    paramIndex++;
  }

  if (filters.states && filters.states.length > 0) {
    conditions.push(`state = ANY($${paramIndex}::text[])`);
    queryParams.push(filters.states);
    paramIndex++;
  }

  if (filters.has_email) {
    conditions.push(`email IS NOT NULL AND email != ''`);
  }

  if (filters.has_phone) {
    conditions.push(`phone IS NOT NULL AND phone != ''`);
  }

  if (filters.has_decision_makers) {
    conditions.push(
      `EXISTS (SELECT 1 FROM decision_makers WHERE decision_makers.company_id = companies.id)`
    );
  }

  const query = `
    SELECT
      id,
      name,
      phone,
      email,
      website,
      address,
      city,
      state,
      zip_code,
      business_category,
      employee_count_estimate,
      revenue_estimate,
      rating,
      review_count,
      data_quality_score,
      google_maps_url,
      linkedin_url
    FROM companies
    WHERE ${conditions.join(' AND ')}
    ORDER BY data_quality_score DESC
    LIMIT 100
  `;

  const result = await db.query(query, queryParams);
  return result.rows;
}

async function queryDecisionMakersForCompanies(companyIds: string[], userId?: string) {
  if (companyIds.length === 0) return [];

  const query = userId
    ? `SELECT
        company_id,
        full_name,
        title,
        email,
        phone,
        linkedin_url,
        confidence_score
      FROM decision_makers
      WHERE company_id = ANY($1::uuid[]) AND user_id = $2
      ORDER BY company_id, confidence_score DESC`
    : `SELECT
        company_id,
        full_name,
        title,
        email,
        phone,
        linkedin_url,
        confidence_score
      FROM decision_makers
      WHERE company_id = ANY($1::uuid[])
      ORDER BY company_id, confidence_score DESC`;

  const params = userId ? [companyIds, userId] : [companyIds];
  const result = await db.query(query, params);

  return result.rows;
}

function formatExportResponse(
  companies: any[],
  decisionMakers: any[],
  params: z.infer<typeof ExportProspectsSchema>,
  fromDatabase: boolean
) {
  const dataSource = fromDatabase ? 'database' : 'mock data (database not configured)';

  let resultsText = `Prospect Export\n\n`;
  resultsText += `Data Source: ${dataSource}\n`;
  resultsText += `Format: ${params.format.toUpperCase()}\n`;
  resultsText += `Companies: ${companies.length}\n`;

  if (params.include_decision_makers) {
    resultsText += `Decision Makers: ${decisionMakers.length}\n`;
  }

  // Show applied filters
  if (params.filters) {
    resultsText += `\nFilters Applied:\n`;
    const filters = params.filters;
    if (filters.min_quality_score !== undefined) {
      resultsText += `  - Min Quality Score: ${(filters.min_quality_score * 100).toFixed(0)}%\n`;
    }
    if (filters.industries && filters.industries.length > 0) {
      resultsText += `  - Industries: ${filters.industries.join(', ')}\n`;
    }
    if (filters.states && filters.states.length > 0) {
      resultsText += `  - States: ${filters.states.join(', ')}\n`;
    }
    if (filters.has_email) resultsText += `  - Has Email: Required\n`;
    if (filters.has_phone) resultsText += `  - Has Phone: Required\n`;
    if (filters.has_decision_makers) resultsText += `  - Has Decision Makers: Required\n`;
  }

  resultsText += `\n${'='.repeat(80)}\n\n`;

  // Generate preview based on format
  if (params.format === 'csv') {
    resultsText += formatCSVPreview(companies, decisionMakers, params.include_decision_makers);
  } else if (params.format === 'json') {
    resultsText += formatJSONPreview(companies, decisionMakers, params.include_decision_makers);
  } else if (params.format === 'google_sheets') {
    resultsText += formatGoogleSheetsPreview(companies);
  }

  if (!fromDatabase) {
    resultsText += `\n\n${'='.repeat(80)}\n`;
    resultsText += `NOTE: This is sample data. To export real prospects:\n`;
    resultsText += `1. Configure database credentials in .env\n`;
    resultsText += `2. Populate database using scrapers (Day 4-6)\n`;
    resultsText += `3. Export will generate actual files for CRM import\n`;
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

function formatCSVPreview(companies: any[], decisionMakers: any[], includeDecisionMakers: boolean) {
  let csv = 'CSV Preview (first 3 rows):\n\n';

  // CSV Header
  csv += 'Company Name,Phone,Email,Website,Address,City,State,Zip,Category,Employees,Revenue,Rating,Quality Score';
  if (includeDecisionMakers) {
    csv += ',Decision Maker,Title,DM Email,DM Phone';
  }
  csv += '\n';

  // CSV Rows (limit to 3 for preview)
  companies.slice(0, 3).forEach((company) => {
    const dm = decisionMakers.find((d) => d.company_id === company.id);

    csv += `"${company.name}",`;
    csv += `"${company.phone || ''}",`;
    csv += `"${company.email || ''}",`;
    csv += `"${company.website || ''}",`;
    csv += `"${company.address || ''}",`;
    csv += `"${company.city || ''}",`;
    csv += `"${company.state || ''}",`;
    csv += `"${company.zip_code || ''}",`;
    csv += `"${company.business_category || ''}",`;
    csv += `"${company.employee_count_estimate || ''}",`;
    csv += `"${company.revenue_estimate || ''}",`;
    csv += `"${company.rating || ''}",`;
    csv += `"${(company.data_quality_score * 100).toFixed(0)}%"`;

    if (includeDecisionMakers && dm) {
      csv += `,"${dm.full_name}",`;
      csv += `"${dm.title || ''}",`;
      csv += `"${dm.email || ''}",`;
      csv += `"${dm.phone || ''}"`;
    } else if (includeDecisionMakers) {
      csv += ',,,';
    }

    csv += '\n';
  });

  csv += `\n... (${companies.length} total rows)\n`;
  return csv;
}

function formatJSONPreview(companies: any[], decisionMakers: any[], includeDecisionMakers: boolean) {
  let json = 'JSON Preview (first 2 records):\n\n';

  const preview = companies.slice(0, 2).map((company) => {
    const companyData: any = {
      id: company.id,
      name: company.name,
      phone: company.phone,
      email: company.email,
      website: company.website,
      address: {
        street: company.address,
        city: company.city,
        state: company.state,
        zip: company.zip_code,
      },
      business: {
        category: company.business_category,
        employees: company.employee_count_estimate,
        revenue: company.revenue_estimate,
      },
      metrics: {
        rating: company.rating,
        review_count: company.review_count,
        quality_score: company.data_quality_score,
      },
    };

    if (includeDecisionMakers) {
      companyData.decision_makers = decisionMakers
        .filter((dm) => dm.company_id === company.id)
        .map((dm) => ({
          name: dm.full_name,
          title: dm.title,
          email: dm.email,
          phone: dm.phone,
          confidence: dm.confidence_score,
        }));
    }

    return companyData;
  });

  json += JSON.stringify(preview, null, 2);
  json += `\n\n... (${companies.length} total records)\n`;
  return json;
}

function formatGoogleSheetsPreview(companies: any[]) {
  let preview = 'Google Sheets Export:\n\n';
  preview += `This will create a new Google Sheet with ${companies.length} prospects.\n`;
  preview += `Sheet will include tabs for:\n`;
  preview += `  - Companies (main data)\n`;
  preview += `  - Decision Makers (linked by Company ID)\n`;
  preview += `  - Call Log (template for tracking outreach)\n\n`;
  preview += `Note: Google Sheets integration requires OAuth setup (Day 7-8).\n`;
  return preview;
}

function formatErrorResponse(params: z.infer<typeof ExportProspectsSchema>) {
  let errorText = `Export Failed - No Prospects Available\n\n`;
  errorText += `Error: Unable to export prospects. No data available.\n\n`;
  errorText += `This usually means:\n`;
  errorText += `1. Database is not configured (missing DATABASE_URL in .env)\n`;
  errorText += `2. No prospects have been scraped and stored yet\n`;
  errorText += `3. Filtering criteria returned no results\n\n`;
  errorText += `Requested Format: ${params.format.toUpperCase()}\n`;

  if (params.filters) {
    errorText += `\nApplied Filters (may have been too restrictive):\n`;
    const filters = params.filters;
    if (filters.min_quality_score !== undefined) {
      errorText += `  - Min Quality Score: ${(filters.min_quality_score * 100).toFixed(0)}%\n`;
    }
    if (filters.industries && filters.industries.length > 0) {
      errorText += `  - Industries: ${filters.industries.join(', ')}\n`;
    }
    if (filters.states && filters.states.length > 0) {
      errorText += `  - States: ${filters.states.join(', ')}\n`;
    }
    if (filters.has_email) errorText += `  - Has Email: Required\n`;
    if (filters.has_phone) errorText += `  - Has Phone: Required\n`;
    if (filters.has_decision_makers) errorText += `  - Has Decision Makers: Required\n`;
  }

  errorText += `\n\nTo export real prospects:\n`;
  errorText += `1. Set up database (Neon free tier: https://neon.tech)\n`;
  errorText += `2. Add DATABASE_URL to .env file\n`;
  errorText += `3. Run prospect scraping with Yellow Pages or Google Maps\n`;
  errorText += `4. Try export again\n`;

  return {
    content: [
      {
        type: 'text',
        text: errorText,
      },
    ],
  };
}
