/**
 * Get Follow-ups Tool
 * Retrieve pending and overdue follow-up reminders
 */
import { z } from 'zod';
import { db } from '../db/client.js';
import { logger } from '../utils/logger.js';
// Zod schema for input validation
const GetFollowUpsSchema = z.object({
    time_range: z.enum(['today', 'this_week', 'next_week', 'overdue', 'all']).optional(),
    prospect_id: z.string().uuid().optional(),
    completed: z.boolean().optional(),
});
export async function getFollowUpsTool(args, dbConnected, userId) {
    try {
        // Validate input
        const input = GetFollowUpsSchema.parse(args || {});
        const timeRange = input.time_range || 'today';
        const completed = input.completed === undefined ? false : input.completed;
        logger.info('Getting follow-ups', { time_range: timeRange, completed });
        // Build WHERE clause
        const conditions = [];
        const params = [];
        let paramIndex = 1;
        // Completed filter
        conditions.push(`f.completed = $${paramIndex++}`);
        params.push(completed);
        // userId filter
        if (userId) {
            conditions.push(`f.user_id = $${paramIndex++}`);
            params.push(userId);
        }
        // Prospect filter
        if (input.prospect_id) {
            conditions.push(`f.prospect_id = $${paramIndex++}`);
            params.push(input.prospect_id);
        }
        // Time range filter
        switch (timeRange) {
            case 'today':
                conditions.push(`DATE(f.due_date) = CURRENT_DATE`);
                break;
            case 'this_week':
                conditions.push(`f.due_date >= DATE_TRUNC('week', CURRENT_DATE)`);
                conditions.push(`f.due_date < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '1 week'`);
                break;
            case 'next_week':
                conditions.push(`f.due_date >= DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '1 week'`);
                conditions.push(`f.due_date < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '2 weeks'`);
                break;
            case 'overdue':
                conditions.push(`f.due_date < NOW()`);
                break;
            case 'all':
                // No additional time filter
                break;
        }
        const whereClause = `WHERE ${conditions.join(' AND ')}`;
        // Query follow-ups with prospect and contact details
        const query = `
      SELECT
        f.id,
        f.due_date,
        f.reminder_type,
        f.reminder_note,
        f.completed,
        f.completed_at,
        p.id as prospect_id,
        p.company_name,
        p.phone as prospect_phone,
        p.status as prospect_status,
        c.id as contact_id,
        c.full_name as contact_name,
        c.phone as contact_phone,
        c.email as contact_email,
        CASE
          WHEN f.due_date < NOW() THEN EXTRACT(DAY FROM NOW() - f.due_date)::INT
          ELSE 0
        END as days_overdue,
        CASE
          WHEN f.due_date > NOW() THEN EXTRACT(DAY FROM f.due_date - NOW())::INT
          ELSE 0
        END as days_until_due
      FROM follow_ups f
      JOIN prospects p ON f.prospect_id = p.id
      LEFT JOIN contacts c ON f.contact_id = c.id
      ${whereClause}
      ORDER BY f.due_date ASC
    `;
        const result = await db.query(query, params);
        const followUps = result.rows;
        logger.info('Follow-ups retrieved', {
            count: followUps.length,
            time_range: timeRange,
        });
        // Format response
        let responseText = '';
        if (completed) {
            responseText = `✅ **Completed Follow-ups**\n\n`;
        }
        else {
            const rangeLabels = {
                today: "Today's",
                this_week: 'This Week',
                next_week: 'Next Week',
                overdue: 'Overdue',
                all: 'All Pending',
            };
            responseText = `⏰ **${rangeLabels[timeRange]} Follow-ups**\n\n`;
        }
        responseText += `Found ${followUps.length} follow-up${followUps.length !== 1 ? 's' : ''}`;
        if (followUps.length === 0) {
            if (!completed && timeRange === 'overdue') {
                responseText += '\n\n🎉 Great! You have no overdue follow-ups.';
            }
            else {
                responseText += '.\n';
            }
        }
        else {
            responseText += ':\n\n';
            followUps.forEach((f, index) => {
                const typeEmoji = {
                    call: '📞',
                    email: '📧',
                    meeting: '🤝',
                };
                const dueDate = new Date(f.due_date);
                const isOverdue = dueDate < new Date() && !completed;
                responseText += `${index + 1}. ${typeEmoji[f.reminder_type] || '⏰'} **${f.company_name}**`;
                if (isOverdue)
                    responseText += ' 🔴 OVERDUE';
                responseText += '\n';
                responseText += `   Due: ${dueDate.toLocaleString()}`;
                if (f.days_overdue > 0) {
                    responseText += ` (${f.days_overdue} day${f.days_overdue !== 1 ? 's' : ''} overdue)`;
                }
                else if (f.days_until_due > 0 && !completed) {
                    responseText += ` (in ${f.days_until_due} day${f.days_until_due !== 1 ? 's' : ''})`;
                }
                responseText += '\n';
                if (f.reminder_type)
                    responseText += `   Type: ${f.reminder_type}\n`;
                if (f.reminder_note)
                    responseText += `   Note: ${f.reminder_note}\n`;
                if (f.contact_name) {
                    responseText += `   Contact: ${f.contact_name}`;
                    if (f.contact_phone)
                        responseText += ` | ${f.contact_phone}`;
                    if (f.contact_email)
                        responseText += ` | ${f.contact_email}`;
                    responseText += '\n';
                }
                responseText += `   Prospect Phone: ${f.prospect_phone || 'N/A'}\n`;
                responseText += `   Status: ${f.prospect_status}\n`;
                if (completed && f.completed_at) {
                    responseText += `   Completed: ${new Date(f.completed_at).toLocaleString()}\n`;
                }
                responseText += `   Follow-up ID: ${f.id}\n`;
                responseText += `   Prospect ID: ${f.prospect_id}\n`;
                responseText += '\n';
            });
            // Add helpful tips
            if (!completed && followUps.length > 0) {
                responseText += '\n💡 **Tip:** Log an activity to automatically mark the follow-up complete.';
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
        logger.error('Failed to get follow-ups', { error, args });
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
                    text: `❌ Error getting follow-ups: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
            isError: true,
        };
    }
}
//# sourceMappingURL=get-follow-ups.tool.js.map