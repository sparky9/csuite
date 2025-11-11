/**
 * Import Prospects Tool
 * Import prospects from ProspectFinder JSON exports
 */

import { z } from 'zod';
import { promises as fs } from 'fs';
import { db } from '../db/client.js';
import { logger } from '../utils/logger.js';
import type { ImportProspectsInput, ImportResult } from '../types/leadtracker.types.js';

// Zod schema for input validation
const ImportProspectsSchema = z.object({
  json_file_path: z.string().min(1, 'File path is required'),
  default_status: z
    .enum([
      'new',
      'contacted',
      'qualified',
      'meeting_scheduled',
      'proposal_sent',
      'negotiating',
      'closed_won',
      'closed_lost',
      'on_hold',
    ])
    .optional(),
  default_tags: z.array(z.string()).optional(),
  source_label: z.string().optional(),
});

// Expected structure from ProspectFinder export
interface ProspectFinderCompany {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  rating?: number;
  decision_makers?: Array<{
    id: string;
    name: string;
    title?: string;
    phone?: string;
    email?: string;
    linkedin?: string;
  }>;
}

export async function importProspectsTool(args: any, _dbConnected?: boolean, userId?: string) {
  try {
    // Validate input
    const input = ImportProspectsSchema.parse(args) as ImportProspectsInput;

    const defaultStatus = input.default_status || 'new';
    const defaultTags = input.default_tags || [];
    const sourceLabel = input.source_label || 'Imported from ProspectFinder';

    logger.info('Starting import', { file: input.json_file_path });

    // Read and parse JSON file
    let fileContent: string;
    try {
      fileContent = await fs.readFile(input.json_file_path, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read file: ${error instanceof Error ? error.message : String(error)}`);
    }

    let companies: ProspectFinderCompany[];
    try {
      const parsed = JSON.parse(fileContent);
      // Handle both array and object with companies property
      companies = Array.isArray(parsed) ? parsed : parsed.companies || [];
    } catch (error) {
      throw new Error('Invalid JSON format');
    }

    if (!Array.isArray(companies) || companies.length === 0) {
      throw new Error('No companies found in JSON file');
    }

    logger.info('Parsed companies', { count: companies.length });

    // Prepare data for batch import
    const result: ImportResult = {
      imported_count: 0,
      skipped_count: 0,
      errors: [],
    };

    // Filter and validate companies
    const validCompanies: ProspectFinderCompany[] = [];
    for (const company of companies) {
      if (!company.name || company.name.trim() === '') {
        result.errors.push({
          company_name: 'Unknown',
          error: 'Missing company name',
        });
        result.skipped_count++;
        continue;
      }
      validCompanies.push(company);
    }

    if (validCompanies.length === 0) {
      logger.info('No valid companies to import');
    } else {
      // Check for duplicates in batch
      const companyIds = validCompanies.map((c) => c.id).filter((id) => id);
      const companyNames = validCompanies.map((c) => c.name);

      const existingQuery = userId
        ? `SELECT prospect_finder_company_id, company_name, phone
           FROM prospects
           WHERE (prospect_finder_company_id = ANY($1::uuid[])
              OR company_name = ANY($2::text[]))
             AND user_id = $3`
        : `SELECT prospect_finder_company_id, company_name, phone
           FROM prospects
           WHERE prospect_finder_company_id = ANY($1::uuid[])
              OR company_name = ANY($2::text[])`;

      const existingParams = userId
        ? [companyIds, companyNames, userId]
        : [companyIds, companyNames];

      const existingResult = await db.query(existingQuery, existingParams);
      const existingSet = new Set<string>();

      existingResult.rows.forEach((row: any) => {
        if (row.prospect_finder_company_id) {
          existingSet.add(`id:${row.prospect_finder_company_id}`);
        }
        if (row.company_name && row.phone) {
          existingSet.add(`name:${row.company_name}:${row.phone}`);
        }
      });

      // Filter out duplicates
      const newCompanies = validCompanies.filter((company) => {
        const isDuplicate =
          (company.id && existingSet.has(`id:${company.id}`)) ||
          (company.phone && existingSet.has(`name:${company.name}:${company.phone}`));

        if (isDuplicate) {
          result.skipped_count++;
          logger.debug('Skipping duplicate prospect', { company_name: company.name });
        }
        return !isDuplicate;
      });

      // Batch insert prospects and contacts
      if (newCompanies.length > 0) {
        await db.transaction(async (client) => {
          // Build batch insert query for prospects
          const prospectValues: any[] = [];
          const prospectPlaceholders: string[] = [];
          let paramIndex = 1;

          newCompanies.forEach((company) => {
            const baseParams = [
              company.name,
              company.phone || null,
              company.email || null,
              company.website || null,
              company.address || null,
              company.city || null,
              company.state || null,
              company.zip || null,
              sourceLabel,
              defaultTags,
              defaultStatus,
              company.id || null,
            ];

            const params = userId ? [...baseParams, userId] : baseParams;
            prospectValues.push(...params);

            const placeholders = params.map((_, i) => `$${paramIndex + i}`);
            paramIndex += params.length;
            prospectPlaceholders.push(`(${placeholders.join(', ')})`);
          });

          const prospectColumns = userId
            ? 'company_name, phone, email, website, address, city, state, zip_code, source, tags, status, prospect_finder_company_id, user_id'
            : 'company_name, phone, email, website, address, city, state, zip_code, source, tags, status, prospect_finder_company_id';

          const prospectQuery = `
            INSERT INTO prospects (${prospectColumns})
            VALUES ${prospectPlaceholders.join(', ')}
            RETURNING id, company_name
          `;

          const prospectResult = await client.query(prospectQuery, prospectValues);
          result.imported_count = prospectResult.rowCount || 0;

          // Build batch insert for contacts
          const contactValues: any[] = [];
          const contactPlaceholders: string[] = [];
          paramIndex = 1;

          prospectResult.rows.forEach((row: any, index: number) => {
            const company = newCompanies[index];
            const prospectId = row.id;

            if (company.decision_makers && Array.isArray(company.decision_makers)) {
              company.decision_makers.forEach((dm) => {
                if (dm.name && dm.name.trim() !== '') {
                  const baseParams = [
                    prospectId,
                    dm.name,
                    dm.title || null,
                    dm.phone || null,
                    dm.email || null,
                    dm.linkedin || null,
                    dm.id || null,
                  ];

                  const params = userId ? [...baseParams, userId] : baseParams;
                  contactValues.push(...params);

                  const placeholders = params.map((_, i) => `$${paramIndex + i}`);
                  paramIndex += params.length;
                  contactPlaceholders.push(`(${placeholders.join(', ')})`);
                }
              });
            }
          });

          // Insert contacts if any
          if (contactPlaceholders.length > 0) {
            const contactColumns = userId
              ? 'prospect_id, full_name, title, phone, email, linkedin_url, prospect_finder_decision_maker_id, user_id'
              : 'prospect_id, full_name, title, phone, email, linkedin_url, prospect_finder_decision_maker_id';

            const contactQuery = `
              INSERT INTO contacts (${contactColumns})
              VALUES ${contactPlaceholders.join(', ')}
            `;

            await client.query(contactQuery, contactValues);
          }
        });
      }
    }

    logger.info('Import completed', {
      imported: result.imported_count,
      skipped: result.skipped_count,
      errors: result.errors.length,
    });

    // Format response
    let responseText = `📥 **Import Complete**\n\n`;
    responseText += `✅ Imported: ${result.imported_count} prospect${result.imported_count !== 1 ? 's' : ''}\n`;
    responseText += `⏭️ Skipped: ${result.skipped_count} (duplicates)\n`;

    if (result.errors.length > 0) {
      responseText += `❌ Errors: ${result.errors.length}\n\n`;
      responseText += `**Errors:**\n`;
      result.errors.slice(0, 10).forEach((err, index) => {
        responseText += `${index + 1}. ${err.company_name}: ${err.error}\n`;
      });
      if (result.errors.length > 10) {
        responseText += `... and ${result.errors.length - 10} more errors\n`;
      }
    }

    responseText += `\n**Import Settings:**\n`;
    responseText += `Source: ${sourceLabel}\n`;
    responseText += `Default Status: ${defaultStatus}\n`;
    if (defaultTags.length > 0) {
      responseText += `Tags: ${defaultTags.join(', ')}\n`;
    }

    if (result.imported_count > 0) {
      responseText += `\n💡 Use search_prospects to view your imported prospects.`;
    }

    return {
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to import prospects', { error, args });

    if (error instanceof z.ZodError) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Validation error: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `❌ Error importing prospects: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
