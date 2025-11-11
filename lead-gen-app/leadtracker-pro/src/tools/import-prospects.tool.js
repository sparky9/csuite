/**
 * Import Prospects Tool
 * Import prospects from ProspectFinder JSON exports
 */
import { z } from 'zod';
import { promises as fs } from 'fs';
import { db } from '../db/client.js';
import { logger } from '../utils/logger.js';
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
export async function importProspectsTool(args, dbConnected, userId) {
    try {
        // Validate input
        const input = ImportProspectsSchema.parse(args);
        const defaultStatus = input.default_status || 'new';
        const defaultTags = input.default_tags || [];
        const sourceLabel = input.source_label || 'Imported from ProspectFinder';
        logger.info('Starting import', { file: input.json_file_path });
        // Read and parse JSON file
        let fileContent;
        try {
            fileContent = await fs.readFile(input.json_file_path, 'utf-8');
        }
        catch (error) {
            throw new Error(`Failed to read file: ${error instanceof Error ? error.message : String(error)}`);
        }
        let companies;
        try {
            const parsed = JSON.parse(fileContent);
            // Handle both array and object with companies property
            companies = Array.isArray(parsed) ? parsed : parsed.companies || [];
        }
        catch (error) {
            throw new Error('Invalid JSON format');
        }
        if (!Array.isArray(companies) || companies.length === 0) {
            throw new Error('No companies found in JSON file');
        }
        logger.info('Parsed companies', { count: companies.length });
        // Import prospects one by one
        const result = {
            imported_count: 0,
            skipped_count: 0,
            errors: [],
        };
        for (const company of companies) {
            try {
                // Validate company has minimum required data
                if (!company.name || company.name.trim() === '') {
                    result.errors.push({
                        company_name: 'Unknown',
                        error: 'Missing company name',
                    });
                    result.skipped_count++;
                    continue;
                }
                // Check if prospect already exists (by ProspectFinder company_id or name match)
                const existingQuery = userId
                    ? `SELECT id FROM prospects
             WHERE (prospect_finder_company_id = $1 OR (company_name = $2 AND phone = $3))
               AND user_id = $4`
                    : `SELECT id FROM prospects
             WHERE prospect_finder_company_id = $1
                OR (company_name = $2 AND phone = $3)`;
                const existingParams = userId
                    ? [company.id, company.name, company.phone || null, userId]
                    : [company.id, company.name, company.phone || null];
                const existingProspect = await db.queryOne(existingQuery, existingParams);
                if (existingProspect) {
                    logger.debug('Skipping duplicate prospect', { company_name: company.name });
                    result.skipped_count++;
                    continue;
                }
                // Use transaction for prospect + contacts
                await db.transaction(async (client) => {
                    // Insert prospect
                    const prospectQuery = userId
                        ? `INSERT INTO prospects (
                company_name, phone, email, website, address,
                city, state, zip_code, source, tags,
                status, prospect_finder_company_id, user_id
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
              RETURNING id`
                        : `INSERT INTO prospects (
                company_name, phone, email, website, address,
                city, state, zip_code, source, tags,
                status, prospect_finder_company_id
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
              RETURNING id`;
                    const prospectParams = userId
                        ? [
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
                            userId,
                        ]
                        : [
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
                    const prospectResult = await client.query(prospectQuery, prospectParams);
                    const prospectId = prospectResult.rows[0].id;
                    // Import decision makers as contacts
                    if (company.decision_makers && Array.isArray(company.decision_makers)) {
                        for (const dm of company.decision_makers) {
                            if (dm.name && dm.name.trim() !== '') {
                                const contactQuery = userId
                                    ? `INSERT INTO contacts (
                      prospect_id, full_name, title, phone, email,
                      linkedin_url, prospect_finder_decision_maker_id, user_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
                                    : `INSERT INTO contacts (
                      prospect_id, full_name, title, phone, email,
                      linkedin_url, prospect_finder_decision_maker_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`;
                                const contactParams = userId
                                    ? [
                                        prospectId,
                                        dm.name,
                                        dm.title || null,
                                        dm.phone || null,
                                        dm.email || null,
                                        dm.linkedin || null,
                                        dm.id || null,
                                        userId,
                                    ]
                                    : [
                                        prospectId,
                                        dm.name,
                                        dm.title || null,
                                        dm.phone || null,
                                        dm.email || null,
                                        dm.linkedin || null,
                                        dm.id || null,
                                    ];
                                await client.query(contactQuery, contactParams);
                            }
                        }
                    }
                });
                result.imported_count++;
            }
            catch (error) {
                logger.error('Failed to import company', { company_name: company.name, error });
                result.errors.push({
                    company_name: company.name,
                    error: error instanceof Error ? error.message : String(error),
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
    }
    catch (error) {
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
//# sourceMappingURL=import-prospects.tool.js.map