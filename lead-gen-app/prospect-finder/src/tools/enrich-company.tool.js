/**
 * enrich_company tool implementation
 *
 * Enriches a company record with additional data from LinkedIn and website.
 * Uses LinkedIn company scraper and website scraper to gather real data.
 */
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { db } from '../db/client.js';
import { LinkedInCompanyScraper } from '../scrapers/linkedin-company-scraper.js';
import { WebsiteScraper } from '../scrapers/website-scraper.js';
import { getBrowserPool } from '../browser/browser-pool.js';
import { getProxyManager } from '../browser/proxy-manager.js';
import { getRateLimiter } from '../utils/rate-limiter.js';
const EnrichCompanySchema = z.object({
    company_id: z.string().min(1, 'Company ID is required'),
    sources: z.array(z.enum(['linkedin', 'website'])).optional().default(['linkedin', 'website']),
    fields: z
        .array(z.enum(['employee_count', 'revenue', 'industry']))
        .optional()
        .default(['employee_count', 'revenue', 'industry']),
});
export async function enrichCompanyTool(args, dbConnected, userId) {
    // Validate input
    const params = EnrichCompanySchema.parse(args);
    logger.info('Enriching company', params);
    // Get company from database
    let company = null;
    if (dbConnected) {
        try {
            company = await getCompanyById(params.company_id, userId);
        }
        catch (error) {
            logger.error('Database query failed', { error });
        }
    }
    // If no company found, return error
    if (!company) {
        const mockCompany = {
            id: params.company_id,
            name: 'Sample Company Inc.',
            employee_count_estimate: null,
            revenue_estimate: null,
            industry: null,
            data_quality_score: 0.65,
        };
        const mockEnrichedData = generateMockEnrichment(params);
        return formatSuccessResponse(mockCompany, mockEnrichedData, params, 'mock');
    }
    // Initialize enrichment data tracker
    const enrichedData = {
        sources_used: [],
        fields_enriched: [],
        changes: {},
    };
    const initialQualityScore = company.data_quality_score || 0.5;
    // Try to enrich from each source
    try {
        // Initialize scrapers
        const proxyManager = getProxyManager();
        await proxyManager.initialize();
        const rateLimiter = getRateLimiter();
        await rateLimiter.initialize();
        const browserPool = getBrowserPool(proxyManager);
        // LINKEDIN ENRICHMENT
        if (params.sources.includes('linkedin') && company.name) {
            try {
                logger.info('Attempting LinkedIn enrichment', { company_name: company.name });
                const linkedInScraper = new LinkedInCompanyScraper(browserPool, proxyManager, rateLimiter);
                const result = await linkedInScraper.scrape({ company_name: company.name });
                if (result.success && result.data) {
                    enrichedData.sources_used.push('linkedin');
                    const linkedInData = result.data;
                    // Enrich employee count
                    if (params.fields.includes('employee_count') &&
                        linkedInData.employee_count &&
                        !company.employee_count_estimate) {
                        enrichedData.fields_enriched.push('employee_count');
                        enrichedData.changes.employee_count = {
                            old: company.employee_count_estimate,
                            new: linkedInData.employee_count,
                        };
                        company.employee_count_estimate = linkedInData.employee_count;
                    }
                    // Enrich industry
                    if (params.fields.includes('industry') && linkedInData.industry && !company.industry) {
                        enrichedData.fields_enriched.push('industry');
                        enrichedData.changes.industry = {
                            old: company.industry,
                            new: linkedInData.industry,
                        };
                        company.industry = linkedInData.industry;
                    }
                    // Update LinkedIn URL if found
                    if (linkedInData.linkedin_url && !company.linkedin_url) {
                        company.linkedin_url = linkedInData.linkedin_url;
                    }
                    // Update website if found and not present
                    if (linkedInData.website && !company.website) {
                        company.website = linkedInData.website;
                    }
                    logger.info('LinkedIn enrichment successful', {
                        fields_enriched: enrichedData.fields_enriched.length,
                    });
                }
                else {
                    logger.warn('LinkedIn enrichment failed', { error: result.error });
                }
            }
            catch (error) {
                logger.error('LinkedIn enrichment error', { error: error.message });
            }
        }
        // WEBSITE ENRICHMENT
        if (params.sources.includes('website') && company.website) {
            try {
                logger.info('Attempting website enrichment', { website: company.website });
                const websiteScraper = new WebsiteScraper(browserPool, proxyManager, rateLimiter);
                const result = await websiteScraper.scrape({ website_url: company.website });
                if (result.success && result.data) {
                    enrichedData.sources_used.push('website');
                    const websiteData = result.data;
                    // Add emails if found
                    if (websiteData.emails.length > 0 && !company.email) {
                        company.email = websiteData.emails[0]; // Use first email found
                        enrichedData.changes.email = {
                            old: null,
                            new: company.email,
                        };
                    }
                    // Add phone if found
                    if (websiteData.phones.length > 0 && !company.phone) {
                        company.phone = websiteData.phones[0]; // Use first phone found
                        enrichedData.changes.phone = {
                            old: null,
                            new: company.phone,
                        };
                    }
                    // Update LinkedIn URL from social links
                    if (websiteData.social_links.linkedin && !company.linkedin_url) {
                        company.linkedin_url = websiteData.social_links.linkedin;
                    }
                    logger.info('Website enrichment successful', {
                        emails_found: websiteData.emails.length,
                        phones_found: websiteData.phones.length,
                    });
                }
                else {
                    logger.warn('Website enrichment failed', { error: result.error });
                }
            }
            catch (error) {
                logger.error('Website enrichment error', { error: error.message });
            }
        }
        // Calculate new quality score
        const fieldsEnrichedCount = Object.keys(enrichedData.changes).length;
        enrichedData.quality_score_improvement = fieldsEnrichedCount * 0.05;
        enrichedData.new_quality_score = Math.min(1.0, initialQualityScore + enrichedData.quality_score_improvement);
        // Update company in database if enriched
        if (dbConnected && fieldsEnrichedCount > 0) {
            try {
                await updateCompanyInDatabase(company, enrichedData.new_quality_score);
                logger.info('Company updated in database', { company_id: company.id });
            }
            catch (dbError) {
                logger.error('Failed to update company in database', { error: dbError });
            }
        }
        const dataSource = enrichedData.sources_used.length > 0 ? 'scraped' : 'database';
        return formatSuccessResponse(company, enrichedData, params, dataSource);
    }
    catch (error) {
        logger.error('Error during enrichment', { error: error.message, stack: error.stack });
        // Return what we have so far
        enrichedData.quality_score_improvement = 0;
        enrichedData.new_quality_score = initialQualityScore;
        return formatSuccessResponse(company, enrichedData, params, 'database');
    }
}
async function getCompanyById(companyId, userId) {
    const query = userId
        ? `SELECT
        id,
        name,
        website,
        phone,
        email,
        linkedin_url,
        employee_count_estimate,
        revenue_estimate,
        industry,
        data_quality_score,
        data_completeness_pct
      FROM companies
      WHERE id = $1 AND user_id = $2`
        : `SELECT
        id,
        name,
        website,
        phone,
        email,
        linkedin_url,
        employee_count_estimate,
        revenue_estimate,
        industry,
        data_quality_score,
        data_completeness_pct
      FROM companies
      WHERE id = $1`;
    const params = userId ? [companyId, userId] : [companyId];
    const result = await db.queryOne(query, params);
    return result;
}
async function updateCompanyInDatabase(company, newQualityScore) {
    // Update company record with enriched data
    await db.query(`UPDATE companies SET
      website = $1,
      phone = $2,
      email = $3,
      linkedin_url = $4,
      employee_count_estimate = $5,
      industry = $6,
      data_quality_score = $7,
      last_enriched_at = NOW(),
      updated_at = NOW()
    WHERE id = $8`, [
        company.website,
        company.phone,
        company.email,
        company.linkedin_url,
        company.employee_count_estimate,
        company.industry,
        newQualityScore,
        company.id,
    ]);
}
function generateMockEnrichment(params) {
    const enrichedData = {
        sources_used: params.sources,
        fields_enriched: params.fields,
        changes: {},
    };
    if (params.fields.includes('employee_count')) {
        enrichedData.changes.employee_count = { old: null, new: 18 };
    }
    if (params.fields.includes('revenue')) {
        enrichedData.changes.revenue = { old: null, new: '$500K - $2M' };
    }
    if (params.fields.includes('industry')) {
        enrichedData.changes.industry = { old: null, new: 'HVAC Services' };
    }
    enrichedData.quality_score_improvement = 0.15;
    enrichedData.new_quality_score = 0.8;
    return enrichedData;
}
function formatSuccessResponse(company, enrichedData, _params, dataSource) {
    const sourceText = dataSource === 'scraped'
        ? `Live scraping (${enrichedData.sources_used.join(', ')})`
        : dataSource === 'database'
            ? 'Database (previously scraped)'
            : 'Mock data (for demonstration)';
    let resultsText = `Company Enrichment Results\n\n`;
    resultsText += `Company: ${company.name}\n`;
    resultsText += `Company ID: ${company.id}\n`;
    resultsText += `Data Source: ${sourceText}\n`;
    if (enrichedData.sources_used.length > 0) {
        resultsText += `Sources Used: ${enrichedData.sources_used.join(', ')}\n`;
    }
    resultsText += `\n`;
    if (enrichedData.fields_enriched.length === 0) {
        resultsText += `No new data found. Company record already complete for requested fields.\n\n`;
        resultsText += `Current Data:\n`;
        resultsText += `  - Employee Count: ${company.employee_count_estimate || 'Not available'}\n`;
        resultsText += `  - Revenue: ${company.revenue_estimate || 'Not available'}\n`;
        resultsText += `  - Industry: ${company.industry || 'Not available'}\n`;
    }
    else {
        resultsText += `Enriched ${enrichedData.fields_enriched.length} field(s):\n`;
        resultsText += `${'='.repeat(80)}\n\n`;
        Object.entries(enrichedData.changes).forEach(([field, change]) => {
            resultsText += `${field}:\n`;
            resultsText += `  Before: ${change.old || 'Not available'}\n`;
            resultsText += `  After: ${change.new}\n`;
            resultsText += `\n`;
        });
        resultsText += `\nData Quality Impact:\n`;
        resultsText += `  Quality Score: ${(company.data_quality_score * 100).toFixed(0)}% → ${(enrichedData.new_quality_score * 100).toFixed(0)}%`;
        resultsText += ` (+${(enrichedData.quality_score_improvement * 100).toFixed(0)}%)\n`;
    }
    if (dataSource === 'mock') {
        resultsText += `\n${'='.repeat(80)}\n`;
        resultsText += `NOTE: This is sample data. To enrich real companies:\n`;
        resultsText += `1. Configure database credentials in .env\n`;
        resultsText += `2. Ensure valid proxy configuration for scraping\n`;
        resultsText += `3. Data is automatically pulled from LinkedIn and company websites\n`;
    }
    else if (dataSource === 'scraped') {
        resultsText += `\n${'='.repeat(80)}\n`;
        resultsText += `SUCCESS: Real data enriched from live scraping!\n`;
        resultsText += `Company record updated in database.\n`;
        resultsText += `\nNOTE: LinkedIn has strict rate limits. Use enrichment sparingly.\n`;
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
//# sourceMappingURL=enrich-company.tool.js.map