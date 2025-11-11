/**
 * get_scraping_stats tool implementation
 *
 * Returns statistics about scraping jobs, data quality, and system performance.
 * Useful for monitoring progress and troubleshooting.
 */
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { db } from '../db/client.js';
const GetScrapingStatsSchema = z.object({
    time_range: z.enum(['today', 'week', 'month', 'all']).optional().default('all'),
});
export async function getScrapingStatsTool(args, dbConnected, userId) {
    // Validate input
    const params = GetScrapingStatsSchema.parse(args);
    logger.info('Getting scraping stats', params);
    // If database is connected, get real stats
    if (dbConnected) {
        try {
            const dbHealth = await db.healthCheck();
            const companyStats = await getCompanyStats(params.time_range, userId);
            const jobStats = await getJobStats(params.time_range, userId);
            const qualityStats = await getQualityStats(userId);
            return formatSuccessResponse({
                database: dbHealth,
                companies: companyStats,
                jobs: jobStats,
                quality: qualityStats,
            }, params, true);
        }
        catch (error) {
            logger.error('Database query failed, falling back to mock data', { error });
        }
    }
    // Return mock data
    const mockStats = generateMockStats();
    return formatSuccessResponse(mockStats, params, false);
}
async function getCompanyStats(timeRange, userId) {
    const timeFilter = getTimeFilter(timeRange);
    const whereConditions = [];
    if (userId)
        whereConditions.push(`user_id = '${userId}'`);
    if (timeFilter)
        whereConditions.push(`created_at >= NOW() - INTERVAL '${timeFilter}'`);
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const query = `
    SELECT
      COUNT(*) as total_companies,
      COUNT(*) FILTER (WHERE phone IS NOT NULL) as companies_with_phone,
      COUNT(*) FILTER (WHERE email IS NOT NULL) as companies_with_email,
      COUNT(*) FILTER (WHERE data_quality_score >= 0.70) as high_quality_companies,
      COUNT(DISTINCT business_category) as unique_industries,
      AVG(data_quality_score) as avg_quality_score
    FROM companies
    ${whereClause}
  `;
    const result = await db.queryOne(query);
    return result;
}
async function getJobStats(timeRange, userId) {
    const timeFilter = getTimeFilter(timeRange);
    const whereConditions = [];
    if (userId)
        whereConditions.push(`user_id = '${userId}'`);
    if (timeFilter)
        whereConditions.push(`created_at >= NOW() - INTERVAL '${timeFilter}'`);
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const query = `
    SELECT
      job_type,
      COUNT(*) as total_jobs,
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      COUNT(*) FILTER (WHERE status = 'failed') as failed,
      COUNT(*) FILTER (WHERE status = 'running') as running,
      COUNT(*) FILTER (WHERE rate_limit_hit = true) as rate_limited,
      SUM(results_count) as total_results,
      AVG(duration_seconds) as avg_duration_seconds
    FROM scraping_jobs
    ${whereClause}
    GROUP BY job_type
  `;
    const result = await db.query(query);
    return result.rows;
}
async function getQualityStats(userId) {
    const whereClause = userId ? `WHERE user_id = '${userId}'` : '';
    const query = `
    SELECT
      CASE
        WHEN data_quality_score >= 0.80 THEN 'Excellent (80%+)'
        WHEN data_quality_score >= 0.60 THEN 'Good (60-79%)'
        WHEN data_quality_score >= 0.40 THEN 'Fair (40-59%)'
        ELSE 'Poor (<40%)'
      END as quality_tier,
      COUNT(*) as company_count
    FROM companies
    ${whereClause}
    GROUP BY quality_tier
    ORDER BY MIN(data_quality_score) DESC
  `;
    const result = await db.query(query);
    return result.rows;
}
function getTimeFilter(timeRange) {
    switch (timeRange) {
        case 'today':
            return '1 day';
        case 'week':
            return '7 days';
        case 'month':
            return '30 days';
        case 'all':
        default:
            return null;
    }
}
function generateMockStats() {
    return {
        database: {
            connected: false,
            latency_ms: -1,
            pool_stats: { total: 0, idle: 0, waiting: 0 },
        },
        companies: {
            total_companies: 0,
            companies_with_phone: 0,
            companies_with_email: 0,
            high_quality_companies: 0,
            unique_industries: 0,
            avg_quality_score: 0,
        },
        jobs: [],
        quality: [],
    };
}
function formatSuccessResponse(stats, params, fromDatabase) {
    const dataSource = fromDatabase ? 'database' : 'system status (database not configured)';
    let resultsText = `ProspectFinder System Statistics\n\n`;
    resultsText += `Data Source: ${dataSource}\n`;
    resultsText += `Time Range: ${params.time_range}\n`;
    resultsText += `Generated: ${new Date().toISOString()}\n\n`;
    resultsText += `${'='.repeat(80)}\n\n`;
    // Database Health
    resultsText += `DATABASE HEALTH\n`;
    if (stats.database.connected) {
        resultsText += `  Status: Connected\n`;
        resultsText += `  Latency: ${stats.database.latency_ms}ms\n`;
        resultsText += `  Connection Pool: ${stats.database.pool_stats.total} total, ${stats.database.pool_stats.idle} idle, ${stats.database.pool_stats.waiting} waiting\n`;
    }
    else {
        resultsText += `  Status: Not Connected\n`;
        resultsText += `  Action Required: Add DATABASE_URL to .env file\n`;
    }
    resultsText += `\n`;
    // Company Statistics
    if (fromDatabase && stats.companies.total_companies > 0) {
        resultsText += `COMPANY DATABASE\n`;
        resultsText += `  Total Companies: ${stats.companies.total_companies}\n`;
        resultsText += `  With Phone: ${stats.companies.companies_with_phone} (${((stats.companies.companies_with_phone / stats.companies.total_companies) * 100).toFixed(1)}%)\n`;
        resultsText += `  With Email: ${stats.companies.companies_with_email} (${((stats.companies.companies_with_email / stats.companies.total_companies) * 100).toFixed(1)}%)\n`;
        resultsText += `  High Quality (70%+): ${stats.companies.high_quality_companies} (${((stats.companies.high_quality_companies / stats.companies.total_companies) * 100).toFixed(1)}%)\n`;
        resultsText += `  Unique Industries: ${stats.companies.unique_industries}\n`;
        resultsText += `  Average Quality Score: ${(stats.companies.avg_quality_score * 100).toFixed(1)}%\n`;
        resultsText += `\n`;
    }
    else if (fromDatabase) {
        resultsText += `COMPANY DATABASE\n`;
        resultsText += `  Status: Empty - no companies scraped yet\n`;
        resultsText += `  Next Steps: Run Google Maps scraper (available Day 4)\n`;
        resultsText += `\n`;
    }
    // Scraping Jobs
    if (fromDatabase && stats.jobs.length > 0) {
        resultsText += `SCRAPING JOBS\n`;
        stats.jobs.forEach((job) => {
            resultsText += `  ${job.job_type}:\n`;
            resultsText += `    Total: ${job.total_jobs} jobs\n`;
            resultsText += `    Completed: ${job.completed}\n`;
            resultsText += `    Failed: ${job.failed}\n`;
            resultsText += `    Running: ${job.running}\n`;
            resultsText += `    Rate Limited: ${job.rate_limited}\n`;
            resultsText += `    Results Found: ${job.total_results || 0}\n`;
            if (job.avg_duration_seconds) {
                resultsText += `    Avg Duration: ${job.avg_duration_seconds.toFixed(1)}s\n`;
            }
            resultsText += `\n`;
        });
    }
    else if (fromDatabase) {
        resultsText += `SCRAPING JOBS\n`;
        resultsText += `  Status: No scraping jobs run yet\n`;
        resultsText += `  Next Steps: Scrapers will be available in Day 4-6\n`;
        resultsText += `\n`;
    }
    // Quality Distribution
    if (fromDatabase && stats.quality.length > 0) {
        resultsText += `DATA QUALITY DISTRIBUTION\n`;
        stats.quality.forEach((tier) => {
            resultsText += `  ${tier.quality_tier}: ${tier.company_count} companies\n`;
        });
        resultsText += `\n`;
    }
    if (!fromDatabase) {
        resultsText += `${'='.repeat(80)}\n`;
        resultsText += `\nSYSTEM NOT YET CONFIGURED\n\n`;
        resultsText += `To start collecting prospect data:\n`;
        resultsText += `1. Get Neon database credentials (sign up at neon.tech)\n`;
        resultsText += `2. Add DATABASE_URL to .env file\n`;
        resultsText += `3. Run 'npm run db:setup' to create tables\n`;
        resultsText += `4. Run scrapers to populate data (Day 4-6 implementation)\n`;
        resultsText += `\n`;
        resultsText += `Once configured, this tool will show:\n`;
        resultsText += `  - Total prospects in database\n`;
        resultsText += `  - Data quality metrics\n`;
        resultsText += `  - Scraping job success rates\n`;
        resultsText += `  - Rate limiting status\n`;
        resultsText += `  - System performance metrics\n`;
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
//# sourceMappingURL=get-scraping-stats.tool.js.map