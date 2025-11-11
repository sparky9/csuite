/**
 * Search Prospects Tool
 * Search and filter prospects with flexible criteria
 */
import { z } from 'zod';
import { db } from '../db/client.js';
import { logger } from '../utils/logger.js';
// Zod schema for input validation
const SearchProspectsSchema = z.object({
    status: z.enum([
        'new',
        'contacted',
        'qualified',
        'meeting_scheduled',
        'proposal_sent',
        'negotiating',
        'closed_won',
        'closed_lost',
        'on_hold',
    ]).optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    tags: z.array(z.string()).optional(),
    source: z.string().optional(),
    has_follow_up: z.boolean().optional(),
    search_query: z.string().optional(),
    limit: z.number().int().positive().max(500).optional(),
    offset: z.number().int().nonnegative().optional(),
});
export async function searchProspectsTool(args, dbConnected, userId) {
    try {
        // Validate input
        const input = SearchProspectsSchema.parse(args);
        const limit = input.limit || 50;
        const offset = input.offset || 0;
        logger.info('Searching prospects', { filters: input, userId });
        // Build WHERE clause dynamically
        const conditions = [];
        const params = [];
        let paramIndex = 1;
        // Add userId filter if provided
        if (userId) {
            conditions.push(`p.user_id = $${paramIndex++}`);
            params.push(userId);
        }
        if (input.status) {
            conditions.push(`p.status = $${paramIndex++}`);
            params.push(input.status);
        }
        if (input.city) {
            conditions.push(`p.city ILIKE $${paramIndex++}`);
            params.push(`%${input.city}%`);
        }
        if (input.state) {
            conditions.push(`p.state = $${paramIndex++}`);
            params.push(input.state.toUpperCase());
        }
        if (input.tags && input.tags.length > 0) {
            conditions.push(`p.tags && $${paramIndex++}::text[]`);
            params.push(input.tags);
        }
        if (input.source) {
            conditions.push(`p.source ILIKE $${paramIndex++}`);
            params.push(`%${input.source}%`);
        }
        if (input.has_follow_up !== undefined) {
            if (input.has_follow_up) {
                conditions.push(`p.next_follow_up IS NOT NULL`);
            }
            else {
                conditions.push(`p.next_follow_up IS NULL`);
            }
        }
        if (input.search_query) {
            conditions.push(`(
        p.company_name ILIKE $${paramIndex} OR
        p.phone ILIKE $${paramIndex} OR
        p.email ILIKE $${paramIndex}
      )`);
            params.push(`%${input.search_query}%`);
            paramIndex++;
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM prospects p ${whereClause}`;
        const countResult = await db.queryOne(countQuery, params);
        const totalCount = parseInt(countResult?.total || '0', 10);
        // Get prospects with details
        params.push(limit, offset);
        const query = `
      SELECT
        p.*,
        COUNT(DISTINCT c.id) as contact_count,
        COUNT(DISTINCT a.id) as activity_count,
        MAX(a.activity_date) as last_activity_date,
        COUNT(DISTINCT f.id) FILTER (WHERE f.completed = FALSE) as pending_follow_ups
      FROM prospects p
      LEFT JOIN contacts c ON p.id = c.prospect_id
      LEFT JOIN activities a ON p.id = a.prospect_id
      LEFT JOIN follow_ups f ON p.id = f.prospect_id
      ${whereClause}
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
        const result = await db.query(query, params);
        const prospects = result.rows;
        logger.info('Search completed', {
            total_found: totalCount,
            returned: prospects.length,
        });
        // Format response
        const hasMore = offset + prospects.length < totalCount;
        const currentPage = Math.floor(offset / limit) + 1;
        let responseText = `🔍 **Search Results**\n\nFound ${totalCount} prospect${totalCount !== 1 ? 's' : ''}`;
        if (totalCount === 0) {
            responseText += '\n\nNo prospects match your search criteria.';
        }
        else {
            responseText += ` (showing ${offset + 1}-${offset + prospects.length})\n\n`;
            prospects.forEach((p, index) => {
                const statusEmoji = {
                    new: '🆕',
                    contacted: '📞',
                    qualified: '✅',
                    meeting_scheduled: '📅',
                    proposal_sent: '📄',
                    negotiating: '🤝',
                    closed_won: '🎉',
                    closed_lost: '❌',
                    on_hold: '⏸️',
                };
                responseText += `${index + 1 + offset}. **${p.company_name}** ${statusEmoji[p.status] || ''}\n`;
                responseText += `   ID: ${p.id}\n`;
                responseText += `   Status: ${p.status}`;
                if (p.phone)
                    responseText += ` | Phone: ${p.phone}`;
                if (p.email)
                    responseText += ` | Email: ${p.email}`;
                responseText += '\n';
                if (p.city && p.state)
                    responseText += `   Location: ${p.city}, ${p.state}\n`;
                if (p.tags && p.tags.length > 0)
                    responseText += `   Tags: ${p.tags.join(', ')}\n`;
                if (p.deal_value)
                    responseText += `   Deal Value: $${p.deal_value.toLocaleString()}\n`;
                responseText += `   Contacts: ${p.contact_count} | Activities: ${p.activity_count}`;
                if (p.pending_follow_ups > 0)
                    responseText += ` | ⏰ Follow-ups: ${p.pending_follow_ups}`;
                responseText += '\n';
                if (p.last_activity_date) {
                    responseText += `   Last Activity: ${new Date(p.last_activity_date).toLocaleDateString()}\n`;
                }
                responseText += '\n';
            });
            if (hasMore) {
                responseText += `\n📄 Page ${currentPage} of ${Math.ceil(totalCount / limit)}`;
                responseText += `\nUse offset=${offset + limit} to see more results.`;
            }
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
        logger.error('Failed to search prospects', { error, args });
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
                    text: `❌ Error searching prospects: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
            isError: true,
        };
    }
}
//# sourceMappingURL=search-prospects.tool.js.map