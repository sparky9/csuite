/**
 * Add Prospect Tool
 * Create a new prospect in the CRM
 */
import { z } from 'zod';
import { db } from '../db/client.js';
import { logger } from '../utils/logger.js';
// Zod schema for input validation
const AddProspectSchema = z.object({
    company_name: z.string().min(1, 'Company name is required'),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    website: z.string().url().optional().or(z.literal('')),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().max(10).optional(),
    zip_code: z.string().max(20).optional(),
    source: z.string().optional(),
    tags: z.array(z.string()).optional(),
    deal_value: z.number().positive().optional(),
    notes: z.string().optional(),
    prospect_finder_company_id: z.string().uuid().optional(),
});
export async function addProspectTool(args, dbConnected, userId) {
    try {
        // Validate input
        const input = AddProspectSchema.parse(args);
        logger.info('Adding new prospect', { company_name: input.company_name, userId });
        // Insert prospect with optional userId
        const insertQuery = userId
            ? `INSERT INTO prospects (
        company_name, phone, email, website, address,
        city, state, zip_code, source, tags,
        deal_value, prospect_finder_company_id, user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`
            : `INSERT INTO prospects (
        company_name, phone, email, website, address,
        city, state, zip_code, source, tags,
        deal_value, prospect_finder_company_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`;
        const insertParams = userId
            ? [
                input.company_name,
                input.phone || null,
                input.email || null,
                input.website || null,
                input.address || null,
                input.city || null,
                input.state || null,
                input.zip_code || null,
                input.source || null,
                input.tags || [],
                input.deal_value || null,
                input.prospect_finder_company_id || null,
                userId,
            ]
            : [
                input.company_name,
                input.phone || null,
                input.email || null,
                input.website || null,
                input.address || null,
                input.city || null,
                input.state || null,
                input.zip_code || null,
                input.source || null,
                input.tags || [],
                input.deal_value || null,
                input.prospect_finder_company_id || null,
            ];
        const prospect = await db.queryOne(insertQuery, insertParams);
        if (!prospect) {
            throw new Error('Failed to create prospect');
        }
        // If notes provided, create initial activity
        if (input.notes) {
            await db.query(`INSERT INTO activities (
          prospect_id, activity_type, notes
        ) VALUES ($1, $2, $3)`, [prospect.id, 'note', input.notes]);
        }
        logger.info('Prospect added successfully', {
            prospect_id: prospect.id,
            company_name: prospect.company_name,
        });
        return {
            content: [
                {
                    type: 'text',
                    text: `✅ Prospect created successfully!

**${prospect.company_name}**
ID: ${prospect.id}
Status: ${prospect.status}
${prospect.phone ? `Phone: ${prospect.phone}` : ''}
${prospect.email ? `Email: ${prospect.email}` : ''}
${prospect.city && prospect.state ? `Location: ${prospect.city}, ${prospect.state}` : ''}
${prospect.tags && prospect.tags.length > 0 ? `Tags: ${prospect.tags.join(', ')}` : ''}
${prospect.deal_value ? `Deal Value: $${prospect.deal_value.toLocaleString()}` : ''}
${input.notes ? `\nInitial note added.` : ''}

Added at: ${new Date(prospect.created_at).toLocaleString()}`,
                },
            ],
        };
    }
    catch (error) {
        logger.error('Failed to add prospect', { error, args });
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
                    text: `❌ Error adding prospect: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
            isError: true,
        };
    }
}
//# sourceMappingURL=add-prospect.tool.js.map