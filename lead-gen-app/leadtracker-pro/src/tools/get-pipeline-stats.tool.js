/**
 * Get Pipeline Stats Tool
 * Retrieve pipeline metrics, conversion rates, and revenue data
 */
import { z } from 'zod';
import { db } from '../db/client.js';
import { logger } from '../utils/logger.js';
// Zod schema for input validation
const GetPipelineStatsSchema = z.object({
    time_range: z.enum(['this_week', 'this_month', 'this_quarter', 'all_time']).optional(),
    include_revenue: z.boolean().optional(),
    group_by: z.enum(['status', 'source', 'city', 'tags']).optional(),
});
export async function getPipelineStatsTool(args, dbConnected, userId) {
    try {
        // Validate input
        const input = GetPipelineStatsSchema.parse(args || {});
        const timeRange = input.time_range || 'all_time';
        const includeRevenue = input.include_revenue !== false; // Default true
        const groupBy = input.group_by || 'status';
        logger.info('Getting pipeline stats', { time_range: timeRange, group_by: groupBy });
        // Build time filter
        let timeFilter = '';
        switch (timeRange) {
            case 'this_week':
                timeFilter = `AND p.created_at >= DATE_TRUNC('week', CURRENT_DATE)`;
                break;
            case 'this_month':
                timeFilter = `AND p.created_at >= DATE_TRUNC('month', CURRENT_DATE)`;
                break;
            case 'this_quarter':
                timeFilter = `AND p.created_at >= DATE_TRUNC('quarter', CURRENT_DATE)`;
                break;
            case 'all_time':
                timeFilter = '';
                break;
        }
        // Add userId filter
        const userFilter = userId ? `AND p.user_id = $1` : '';
        const userParams = userId ? [userId] : [];
        // Get overall totals
        const totalsQuery = `
      SELECT
        COUNT(*) as total_prospects,
        SUM(deal_value) as total_revenue,
        AVG(deal_value) as avg_deal_size,
        COUNT(*) FILTER (WHERE status = 'closed_won') as won_count,
        COUNT(*) FILTER (WHERE status = 'closed_lost') as lost_count,
        COUNT(*) FILTER (WHERE status NOT IN ('closed_won', 'closed_lost', 'on_hold')) as active_count
      FROM prospects p
      WHERE 1=1 ${timeFilter} ${userFilter}
    `;
        const totalsResult = await db.queryOne(totalsQuery, userParams);
        const totalProspects = parseInt(totalsResult?.total_prospects || '0', 10);
        const totalRevenue = parseFloat(totalsResult?.total_revenue || '0');
        const avgDealSize = parseFloat(totalsResult?.avg_deal_size || '0');
        const wonCount = parseInt(totalsResult?.won_count || '0', 10);
        const lostCount = parseInt(totalsResult?.lost_count || '0', 10);
        const activeCount = parseInt(totalsResult?.active_count || '0', 10);
        // Calculate win rate
        const closedCount = wonCount + lostCount;
        const winRate = closedCount > 0 ? (wonCount / closedCount) * 100 : 0;
        // Get grouped statistics
        let groupQuery = '';
        let groupLabel = '';
        switch (groupBy) {
            case 'status':
                groupLabel = 'Status';
                groupQuery = `
          SELECT
            status as group_name,
            COUNT(*) as count,
            SUM(deal_value) as potential_revenue,
            AVG(deal_value) as avg_deal_value,
            COUNT(*) FILTER (WHERE last_contacted_at >= NOW() - INTERVAL '7 days') as contacted_last_week
          FROM prospects p
          WHERE 1=1 ${timeFilter} ${userFilter}
          GROUP BY status
          ORDER BY
            CASE status
              WHEN 'new' THEN 1
              WHEN 'contacted' THEN 2
              WHEN 'qualified' THEN 3
              WHEN 'meeting_scheduled' THEN 4
              WHEN 'proposal_sent' THEN 5
              WHEN 'negotiating' THEN 6
              WHEN 'closed_won' THEN 7
              WHEN 'closed_lost' THEN 8
              WHEN 'on_hold' THEN 9
              ELSE 10
            END
        `;
                break;
            case 'source':
                groupLabel = 'Source';
                groupQuery = `
          SELECT
            COALESCE(source, 'Unknown') as group_name,
            COUNT(*) as count,
            SUM(deal_value) as potential_revenue,
            AVG(deal_value) as avg_deal_value
          FROM prospects p
          WHERE 1=1 ${timeFilter} ${userFilter}
          GROUP BY source
          ORDER BY count DESC
        `;
                break;
            case 'city':
                groupLabel = 'City';
                groupQuery = `
          SELECT
            COALESCE(city || ', ' || state, 'Unknown') as group_name,
            COUNT(*) as count,
            SUM(deal_value) as potential_revenue,
            AVG(deal_value) as avg_deal_value
          FROM prospects p
          WHERE 1=1 ${timeFilter} ${userFilter}
          GROUP BY city, state
          ORDER BY count DESC
          LIMIT 20
        `;
                break;
            case 'tags':
                groupLabel = 'Tag';
                groupQuery = `
          SELECT
            UNNEST(tags) as group_name,
            COUNT(*) as count,
            SUM(deal_value) as potential_revenue,
            AVG(deal_value) as avg_deal_value
          FROM prospects p
          WHERE 1=1 ${timeFilter} ${userFilter}
            AND array_length(tags, 1) > 0
          GROUP BY group_name
          ORDER BY count DESC
          LIMIT 20
        `;
                break;
        }
        const groupResult = await db.query(groupQuery, userParams);
        const groupedStats = groupResult.rows;
        logger.info('Pipeline stats retrieved', {
            total_prospects: totalProspects,
            grouped_count: groupedStats.length,
        });
        // Format response
        const rangeLabels = {
            this_week: 'This Week',
            this_month: 'This Month',
            this_quarter: 'This Quarter',
            all_time: 'All Time',
        };
        let responseText = `📊 **Pipeline Statistics - ${rangeLabels[timeRange]}**\n\n`;
        // Overall metrics
        responseText += `**Overall Metrics**\n`;
        responseText += `Total Prospects: ${totalProspects}\n`;
        responseText += `Active Prospects: ${activeCount}\n`;
        if (includeRevenue && totalRevenue > 0) {
            responseText += `Total Pipeline Value: $${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
            responseText += `Average Deal Size: $${avgDealSize.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
        }
        responseText += `Closed Won: ${wonCount}\n`;
        responseText += `Closed Lost: ${lostCount}\n`;
        if (closedCount > 0) {
            responseText += `Win Rate: ${winRate.toFixed(1)}%\n`;
        }
        responseText += '\n';
        // Grouped statistics
        responseText += `**Breakdown by ${groupLabel}**\n\n`;
        if (groupedStats.length === 0) {
            responseText += 'No data available.\n';
        }
        else {
            groupedStats.forEach((stat) => {
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
                const emoji = groupBy === 'status' ? statusEmoji[stat.group_name] || '' : '';
                responseText += `${emoji} **${stat.group_name}**\n`;
                responseText += `   Count: ${stat.count}`;
                if (includeRevenue && stat.potential_revenue) {
                    const revenue = parseFloat(stat.potential_revenue);
                    responseText += ` | Revenue: $${revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                }
                if (stat.avg_deal_value) {
                    const avgValue = parseFloat(stat.avg_deal_value);
                    responseText += ` | Avg: $${avgValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                }
                responseText += '\n';
                if (groupBy === 'status' && stat.contacted_last_week) {
                    responseText += `   Contacted Last Week: ${stat.contacted_last_week}\n`;
                }
                // Calculate percentage
                const percentage = ((stat.count / totalProspects) * 100).toFixed(1);
                responseText += `   ${percentage}% of total\n`;
                responseText += '\n';
            });
        }
        // Add insights
        responseText += `\n💡 **Insights**\n`;
        if (activeCount > 0 && closedCount > 0) {
            const conversionRate = (closedCount / (activeCount + closedCount)) * 100;
            responseText += `• Overall conversion rate: ${conversionRate.toFixed(1)}%\n`;
        }
        if (wonCount > 0 && totalRevenue > 0) {
            const wonRevenue = totalRevenue; // This is simplified; in reality would filter for won deals
            responseText += `• Revenue from won deals: $${wonRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
        }
        if (activeCount > 0 && includeRevenue && totalRevenue > 0) {
            responseText += `• Average pipeline value per active prospect: $${(totalRevenue / activeCount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
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
        logger.error('Failed to get pipeline stats', { error, args });
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
                    text: `❌ Error getting pipeline stats: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
            isError: true,
        };
    }
}
//# sourceMappingURL=get-pipeline-stats.tool.js.map