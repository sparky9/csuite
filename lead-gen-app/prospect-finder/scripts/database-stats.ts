/**
 * Database Statistics Script
 *
 * Shows current database statistics: companies, decision makers, scraping jobs, data quality.
 * Run this anytime: npm run db:stats
 */

import dotenv from 'dotenv';
import { db } from '../src/db/client.js';
import { logger } from '../src/utils/logger.js';

dotenv.config();

async function showDatabaseStats() {
  console.log('='.repeat(80));
  console.log('ProspectFinder MCP - Database Statistics');
  console.log('='.repeat(80));
  console.log();

  // Check for DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL not found in environment variables');
    console.error('Add DATABASE_URL to your .env file');
    process.exit(1);
  }

  try {
    // Connect to database
    await db.connect(databaseUrl);

    // Database health
    const health = await db.healthCheck();
    console.log('DATABASE HEALTH');
    console.log(`  Status: ${health.connected ? 'Connected' : 'Disconnected'}`);
    console.log(`  Latency: ${health.latency_ms}ms`);
    console.log(`  Connection Pool: ${health.pool_stats.total} total, ${health.pool_stats.idle} idle, ${health.pool_stats.waiting} waiting`);
    console.log();

    // Company statistics
    const companyStats = await db.queryOne(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE phone IS NOT NULL) as with_phone,
        COUNT(*) FILTER (WHERE email IS NOT NULL) as with_email,
        COUNT(*) FILTER (WHERE website IS NOT NULL) as with_website,
        COUNT(*) FILTER (WHERE linkedin_url IS NOT NULL) as with_linkedin,
        COUNT(*) FILTER (WHERE data_quality_score >= 0.70) as high_quality,
        AVG(data_quality_score) as avg_quality_score,
        AVG(data_completeness_pct) as avg_completeness_pct,
        COUNT(DISTINCT business_category) as unique_industries,
        COUNT(DISTINCT state) as states_covered
      FROM companies
    `);

    console.log('COMPANIES');
    console.log(`  Total: ${companyStats.total}`);
    if (companyStats.total > 0) {
      console.log(`  With Phone: ${companyStats.with_phone} (${((companyStats.with_phone / companyStats.total) * 100).toFixed(1)}%)`);
      console.log(`  With Email: ${companyStats.with_email} (${((companyStats.with_email / companyStats.total) * 100).toFixed(1)}%)`);
      console.log(`  With Website: ${companyStats.with_website} (${((companyStats.with_website / companyStats.total) * 100).toFixed(1)}%)`);
      console.log(`  With LinkedIn: ${companyStats.with_linkedin} (${((companyStats.with_linkedin / companyStats.total) * 100).toFixed(1)}%)`);
      console.log(`  High Quality (70%+): ${companyStats.high_quality} (${((companyStats.high_quality / companyStats.total) * 100).toFixed(1)}%)`);
      console.log(`  Avg Quality Score: ${(companyStats.avg_quality_score * 100).toFixed(1)}%`);
      console.log(`  Avg Completeness: ${companyStats.avg_completeness_pct}%`);
      console.log(`  Unique Industries: ${companyStats.unique_industries}`);
      console.log(`  States Covered: ${companyStats.states_covered}`);
    } else {
      console.log('  Status: No companies in database yet');
    }
    console.log();

    // Top industries
    if (companyStats.total > 0) {
      const topIndustries = await db.query(`
        SELECT
          business_category,
          COUNT(*) as count,
          AVG(data_quality_score) as avg_quality
        FROM companies
        WHERE business_category IS NOT NULL
        GROUP BY business_category
        ORDER BY count DESC
        LIMIT 10
      `);

      if (topIndustries.rows.length > 0) {
        console.log('TOP INDUSTRIES');
        topIndustries.rows.forEach((row, index) => {
          console.log(`  ${index + 1}. ${row.business_category}: ${row.count} companies (avg quality: ${(row.avg_quality * 100).toFixed(0)}%)`);
        });
        console.log();
      }
    }

    // Decision makers
    const dmStats = await db.queryOne(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE email IS NOT NULL) as with_email,
        COUNT(*) FILTER (WHERE phone IS NOT NULL) as with_phone,
        COUNT(*) FILTER (WHERE linkedin_url IS NOT NULL) as with_linkedin,
        COUNT(DISTINCT company_id) as companies_with_dms,
        AVG(confidence_score) as avg_confidence
      FROM decision_makers
    `);

    console.log('DECISION MAKERS');
    console.log(`  Total: ${dmStats.total}`);
    if (dmStats.total > 0) {
      console.log(`  With Email: ${dmStats.with_email} (${((dmStats.with_email / dmStats.total) * 100).toFixed(1)}%)`);
      console.log(`  With Phone: ${dmStats.with_phone} (${((dmStats.with_phone / dmStats.total) * 100).toFixed(1)}%)`);
      console.log(`  With LinkedIn: ${dmStats.with_linkedin} (${((dmStats.with_linkedin / dmStats.total) * 100).toFixed(1)}%)`);
      console.log(`  Companies with DMs: ${dmStats.companies_with_dms}`);
      console.log(`  Avg Confidence: ${(dmStats.avg_confidence * 100).toFixed(1)}%`);
    } else {
      console.log('  Status: No decision makers in database yet');
    }
    console.log();

    // Scraping jobs
    const jobStats = await db.query(`
      SELECT
        job_type,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'running') as running,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        SUM(results_count) as total_results,
        AVG(duration_seconds) FILTER (WHERE duration_seconds IS NOT NULL) as avg_duration
      FROM scraping_jobs
      GROUP BY job_type
      ORDER BY total DESC
    `);

    console.log('SCRAPING JOBS');
    if (jobStats.rows.length > 0) {
      jobStats.rows.forEach((row) => {
        console.log(`  ${row.job_type}:`);
        console.log(`    Total Jobs: ${row.total}`);
        console.log(`    Completed: ${row.completed}, Failed: ${row.failed}, Running: ${row.running}, Pending: ${row.pending}`);
        console.log(`    Results Found: ${row.total_results || 0}`);
        if (row.avg_duration) {
          console.log(`    Avg Duration: ${row.avg_duration.toFixed(1)}s`);
        }
      });
    } else {
      console.log('  Status: No scraping jobs run yet');
    }
    console.log();

    // Quality distribution
    const qualityDist = await db.query(`
      SELECT
        CASE
          WHEN data_quality_score >= 0.80 THEN 'Excellent (80%+)'
          WHEN data_quality_score >= 0.60 THEN 'Good (60-79%)'
          WHEN data_quality_score >= 0.40 THEN 'Fair (40-59%)'
          ELSE 'Poor (<40%)'
        END as quality_tier,
        COUNT(*) as count
      FROM companies
      GROUP BY quality_tier
      ORDER BY MIN(data_quality_score) DESC
    `);

    if (qualityDist.rows.length > 0) {
      console.log('DATA QUALITY DISTRIBUTION');
      qualityDist.rows.forEach((row) => {
        const percentage = companyStats.total > 0
          ? ((row.count / companyStats.total) * 100).toFixed(1)
          : '0.0';
        console.log(`  ${row.quality_tier}: ${row.count} (${percentage}%)`);
      });
      console.log();
    }

    // Callable prospects (high quality with phone)
    const callableCount = await db.queryOne(`
      SELECT COUNT(*) as count
      FROM companies
      WHERE phone IS NOT NULL
        AND data_quality_score >= 0.60
    `);

    console.log('CALLABLE PROSPECTS');
    console.log(`  Ready to Call: ${callableCount.count} companies`);
    console.log(`  (Companies with phone number and 60%+ quality score)`);
    console.log();

    // Recent activity
    const recentActivity = await db.query(`
      SELECT
        'company' as type,
        created_at
      FROM companies
      UNION ALL
      SELECT
        'decision_maker' as type,
        created_at
      FROM decision_makers
      UNION ALL
      SELECT
        'scraping_job' as type,
        created_at
      FROM scraping_jobs
      ORDER BY created_at DESC
      LIMIT 5
    `);

    if (recentActivity.rows.length > 0) {
      console.log('RECENT ACTIVITY (Last 5 Records)');
      recentActivity.rows.forEach((row) => {
        const timeAgo = getTimeAgo(new Date(row.created_at));
        console.log(`  ${row.type}: ${timeAgo}`);
      });
      console.log();
    }

    // Summary
    console.log('='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log();

    if (companyStats.total === 0) {
      console.log('Your database is set up but empty.');
      console.log();
      console.log('Next steps:');
      console.log('1. Configure Claude Desktop MCP (see README.md)');
      console.log('2. Test MCP server: npm run dev');
      console.log('3. In Claude Desktop, ask: "Find HVAC companies in Dallas"');
      console.log('4. You will see mock data until scrapers are implemented (Day 4-6)');
    } else {
      console.log(`You have ${companyStats.total} companies in your database.`);
      console.log(`${callableCount.count} are ready to call (high quality with phone).`);
      console.log();
      console.log('To use this data:');
      console.log('1. Ask Claude: "Show me HVAC companies in Texas"');
      console.log('2. Export prospects: "Export high-quality prospects to CSV"');
      console.log('3. Find decision makers: "Find decision makers at [company name]"');
    }
    console.log();

    await db.disconnect();
    process.exit(0);
  } catch (error) {
    console.error();
    console.error('ERROR: Failed to retrieve database statistics');
    console.error(error);
    console.error();

    await db.disconnect();
    process.exit(1);
  }
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds} seconds ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

// Run stats
showDatabaseStats();
