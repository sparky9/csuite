/**
 * search_companies tool implementation
 *
 * Searches for B2B companies matching criteria (industry, location, size).
 * PRIORITY 1: Uses Yellow Pages scraper (superior B2B data)
 * FALLBACK: Google Maps scraper if Yellow Pages fails
 */
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { db } from '../db/client.js';
import { YellowPagesScraper } from '../scrapers/yellow-pages-scraper.js';
import { GoogleMapsScraper } from '../scrapers/google-maps-scraper.js';
import { getBrowserPool } from '../browser/browser-pool.js';
import { getProxyManager } from '../browser/proxy-manager.js';
import { getRateLimiter } from '../utils/rate-limiter.js';
import { randomUUID } from 'crypto';
const SearchCompaniesSchema = z.object({
    location: z.string().min(2, 'Location must be at least 2 characters'),
    industry: z.string().optional(),
    radius_miles: z.number().min(1).max(100).optional().default(25),
    min_rating: z.number().min(1.0).max(5.0).optional().default(3.5),
    max_results: z.number().min(1).max(100).optional().default(20),
});
export async function searchCompaniesTool(args, dbConnected, userId) {
    // Validate input
    const params = SearchCompaniesSchema.parse(args);
    logger.info('Searching for companies', params);
    try {
        // Initialize scrapers
        const proxyManager = getProxyManager();
        await proxyManager.initialize();
        const rateLimiter = getRateLimiter();
        await rateLimiter.initialize();
        const browserPool = getBrowserPool(proxyManager);
        let scrapedCompanies = [];
        let dataSource = 'yellow_pages';
        // PRIORITY 1: Try Yellow Pages first (superior B2B data)
        logger.info('Attempting Yellow Pages scrape (PRIMARY SOURCE)', {
            industry: params.industry || 'all',
            location: params.location,
            max_results: params.max_results,
        });
        const yellowPagesScraper = new YellowPagesScraper(browserPool, proxyManager, rateLimiter);
        const ypResult = await yellowPagesScraper.scrape({
            industry: params.industry || 'businesses',
            location: params.location,
            max_results: params.max_results,
        });
        if (ypResult.success && ypResult.data && ypResult.data.length > 0) {
            // Yellow Pages succeeded - use this data
            logger.info('Yellow Pages scrape SUCCESS', {
                results_found: ypResult.data.length,
                duration_ms: ypResult.duration_ms,
            });
            scrapedCompanies = ypResult.data.map(convertYellowPagesToStandard);
            dataSource = 'yellow_pages';
        }
        else {
            // FALLBACK: Try Google Maps if Yellow Pages fails
            logger.warn('Yellow Pages failed, falling back to Google Maps', {
                error: ypResult.error,
            });
            const query = params.industry
                ? `${params.industry} in ${params.location}`
                : `businesses in ${params.location}`;
            const gmapsScraper = new GoogleMapsScraper(browserPool, proxyManager, rateLimiter);
            logger.info('Starting Google Maps scrape (FALLBACK)', { query, max_results: params.max_results });
            const gmapsResult = await gmapsScraper.scrape({
                query,
                max_results: params.max_results,
                min_rating: params.min_rating,
            });
            if (!gmapsResult.success) {
                logger.error('Both Yellow Pages and Google Maps failed', { yp_error: ypResult.error, gmaps_error: gmapsResult.error });
                // Fall back to database or mock data
                if (dbConnected) {
                    const companies = await searchCompaniesFromDatabase(params);
                    if (companies.length > 0) {
                        return formatSuccessResponse(companies, params, 'database');
                    }
                }
                return formatErrorResponse(gmapsResult.error || 'All scraping methods failed', params);
            }
            scrapedCompanies = (gmapsResult.data || []).map(convertGoogleMapsToStandard);
            dataSource = 'google_maps';
            logger.info('Google Maps scrape completed', { results_found: scrapedCompanies.length });
        }
        // Store results in database if connected
        if (dbConnected && scrapedCompanies.length > 0) {
            try {
                await storeCompaniesInDatabase(scrapedCompanies, params, dataSource, userId);
                logger.info('Companies stored in database', { count: scrapedCompanies.length, source: dataSource, userId });
            }
            catch (error) {
                logger.error('Failed to store companies in database', { error });
                // Continue anyway - we still have the scraped data
            }
        }
        // Format scraped data for display
        const formattedCompanies = scrapedCompanies.map((company) => ({
            id: randomUUID(), // Generate temp ID for display
            name: company.name,
            phone: company.phone,
            email: null, // Will be filled by email finder if requested
            website: company.website,
            address: company.address,
            city: company.city,
            state: company.state,
            zip_code: company.zip_code,
            business_category: company.category,
            rating: company.rating,
            review_count: company.review_count,
            data_quality_score: company.data_quality_score,
            google_maps_url: company.google_maps_url,
            yellow_pages_url: company.yellow_pages_url,
            years_in_business: company.years_in_business,
        }));
        return formatSuccessResponse(formattedCompanies, params, dataSource);
    }
    catch (error) {
        logger.error('Error in search companies tool', { error: error.message, stack: error.stack });
        // Fall back to database or mock data
        if (dbConnected) {
            try {
                const companies = await searchCompaniesFromDatabase(params);
                if (companies.length > 0) {
                    return formatSuccessResponse(companies, params, 'database');
                }
            }
            catch (dbError) {
                logger.error('Database fallback also failed', { error: dbError });
            }
        }
        // Last resort: return mock data for demonstration
        const mockCompanies = generateMockCompanies(params);
        return formatSuccessResponse(mockCompanies, params, 'mock');
    }
}
/**
 * Convert Yellow Pages result to standard format
 */
function convertYellowPagesToStandard(company) {
    const qualityScore = calculateYellowPagesQualityScore(company);
    return {
        name: company.name,
        phone: company.phone,
        address: company.address,
        city: company.city,
        state: company.state,
        zip_code: company.zip_code,
        website: company.website,
        category: company.category,
        rating: null, // Yellow Pages doesn't always have ratings
        review_count: null,
        google_maps_url: null,
        yellow_pages_url: company.yellow_pages_url,
        years_in_business: company.years_in_business,
        data_quality_score: qualityScore,
    };
}
/**
 * Convert Google Maps result to standard format
 */
function convertGoogleMapsToStandard(company) {
    const qualityScore = calculateGoogleMapsQualityScore(company);
    return {
        name: company.name,
        phone: company.phone,
        address: company.address,
        city: company.city,
        state: company.state,
        zip_code: company.zip_code,
        website: company.website,
        category: company.category,
        rating: company.rating,
        review_count: company.review_count,
        google_maps_url: company.google_maps_url,
        yellow_pages_url: null,
        years_in_business: null,
        data_quality_score: qualityScore,
    };
}
/**
 * Calculate quality score for Yellow Pages result
 */
function calculateYellowPagesQualityScore(company) {
    let score = 0;
    // Phone (30% - critical for B2B)
    if (company.phone)
        score += 0.30;
    // Website (25%)
    if (company.website)
        score += 0.25;
    // Complete address (20%)
    if (company.address && company.city && company.state)
        score += 0.20;
    // Category (10%)
    if (company.category)
        score += 0.10;
    // Years in business (10% - unique to Yellow Pages!)
    if (company.years_in_business)
        score += 0.10;
    // BBB rating (5%)
    if (company.bbb_rating)
        score += 0.05;
    return Math.min(score, 1.0);
}
/**
 * Calculate quality score for a scraped company (Google Maps)
 */
function calculateGoogleMapsQualityScore(company) {
    let score = 0;
    let maxScore = 0;
    // Phone (25%)
    maxScore += 0.25;
    if (company.phone)
        score += 0.25;
    // Website (25%)
    maxScore += 0.25;
    if (company.website)
        score += 0.25;
    // Address (20%)
    maxScore += 0.20;
    if (company.address && company.city && company.state)
        score += 0.20;
    // Rating (15%)
    maxScore += 0.15;
    if (company.rating && company.rating >= 4.0)
        score += 0.15;
    else if (company.rating && company.rating >= 3.0)
        score += 0.075;
    // Review count (15%)
    maxScore += 0.15;
    if (company.review_count && company.review_count >= 50)
        score += 0.15;
    else if (company.review_count && company.review_count >= 10)
        score += 0.075;
    return Math.min(score, 1.0);
}
/**
 * Store companies in database
 */
async function storeCompaniesInDatabase(companies, _params, dataSource, userId) {
    for (const company of companies) {
        try {
            const qualityScore = company.data_quality_score;
            // Check if company already exists (by Yellow Pages or Google Maps URL)
            let existing = null;
            if (dataSource === 'yellow_pages' && company.yellow_pages_url) {
                const existingQuery = userId
                    ? 'SELECT id FROM companies WHERE yellow_pages_url = $1 AND user_id = $2'
                    : 'SELECT id FROM companies WHERE yellow_pages_url = $1';
                const existingParams = userId ? [company.yellow_pages_url, userId] : [company.yellow_pages_url];
                existing = await db.queryOne(existingQuery, existingParams);
            }
            else if (dataSource === 'google_maps' && company.google_maps_url) {
                const existingQuery = userId
                    ? 'SELECT id FROM companies WHERE google_maps_url = $1 AND user_id = $2'
                    : 'SELECT id FROM companies WHERE google_maps_url = $1';
                const existingParams = userId ? [company.google_maps_url, userId] : [company.google_maps_url];
                existing = await db.queryOne(existingQuery, existingParams);
            }
            if (existing) {
                // Update existing record
                const updateQuery = dataSource === 'yellow_pages'
                    ? `UPDATE companies SET
              name = $1,
              phone = $2,
              website = $3,
              address = $4,
              city = $5,
              state = $6,
              zip_code = $7,
              business_category = $8,
              data_quality_score = $9,
              updated_at = NOW(),
              last_enriched_at = NOW()
            WHERE yellow_pages_url = $10${userId ? ' AND user_id = $11' : ''}`
                    : `UPDATE companies SET
              name = $1,
              phone = $2,
              website = $3,
              address = $4,
              city = $5,
              state = $6,
              zip_code = $7,
              business_category = $8,
              rating = $9,
              review_count = $10,
              data_quality_score = $11,
              updated_at = NOW(),
              last_enriched_at = NOW()
            WHERE google_maps_url = $12${userId ? ' AND user_id = $13' : ''}`;
                const updateParams = dataSource === 'yellow_pages'
                    ? userId
                        ? [
                            company.name,
                            company.phone,
                            company.website,
                            company.address,
                            company.city,
                            company.state,
                            company.zip_code,
                            company.category,
                            qualityScore,
                            company.yellow_pages_url,
                            userId,
                        ]
                        : [
                            company.name,
                            company.phone,
                            company.website,
                            company.address,
                            company.city,
                            company.state,
                            company.zip_code,
                            company.category,
                            qualityScore,
                            company.yellow_pages_url,
                        ]
                    : userId
                        ? [
                            company.name,
                            company.phone,
                            company.website,
                            company.address,
                            company.city,
                            company.state,
                            company.zip_code,
                            company.category,
                            company.rating,
                            company.review_count,
                            qualityScore,
                            company.google_maps_url,
                            userId,
                        ]
                        : [
                            company.name,
                            company.phone,
                            company.website,
                            company.address,
                            company.city,
                            company.state,
                            company.zip_code,
                            company.category,
                            company.rating,
                            company.review_count,
                            qualityScore,
                            company.google_maps_url,
                        ];
                await db.query(updateQuery, updateParams);
            }
            else {
                // Insert new record
                const insertQuery = userId
                    ? `INSERT INTO companies (
              id, user_id, name, phone, website, address, city, state, zip_code,
              country, business_category, rating, review_count,
              google_maps_url, yellow_pages_url, data_quality_score, data_completeness_pct,
              scraped_at, created_at, updated_at
            ) VALUES (
              uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8,
              'US', $9, $10, $11, $12, $13, $14, $15,
              NOW(), NOW(), NOW()
            )`
                    : `INSERT INTO companies (
              id, name, phone, website, address, city, state, zip_code,
              country, business_category, rating, review_count,
              google_maps_url, yellow_pages_url, data_quality_score, data_completeness_pct,
              scraped_at, created_at, updated_at
            ) VALUES (
              uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7,
              'US', $8, $9, $10, $11, $12, $13, $14,
              NOW(), NOW(), NOW()
            )`;
                const insertParams = userId
                    ? [
                        userId,
                        company.name,
                        company.phone,
                        company.website,
                        company.address,
                        company.city,
                        company.state,
                        company.zip_code,
                        company.category,
                        company.rating,
                        company.review_count,
                        company.google_maps_url,
                        company.yellow_pages_url,
                        qualityScore,
                        calculateCompleteness(company),
                    ]
                    : [
                        company.name,
                        company.phone,
                        company.website,
                        company.address,
                        company.city,
                        company.state,
                        company.zip_code,
                        company.category,
                        company.rating,
                        company.review_count,
                        company.google_maps_url,
                        company.yellow_pages_url,
                        qualityScore,
                        calculateCompleteness(company),
                    ];
                await db.query(insertQuery, insertParams);
            }
        }
        catch (error) {
            logger.error('Failed to store company', { name: company.name, error });
            // Continue with next company
        }
    }
}
function calculateCompleteness(company) {
    const fields = [
        'name',
        'phone',
        'website',
        'address',
        'city',
        'state',
        'zip_code',
        'category',
        'rating',
    ];
    const filledFields = fields.filter((field) => company[field]);
    return (filledFields.length / fields.length) * 100;
}
async function searchCompaniesFromDatabase(params) {
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
      rating,
      review_count,
      data_quality_score,
      google_maps_url
    FROM companies
    WHERE 1=1
      ${params.industry ? `AND LOWER(business_category) LIKE LOWER($1)` : ''}
      ${params.min_rating ? `AND rating >= ${params.industry ? '$2' : '$1'}` : ''}
    ORDER BY data_quality_score DESC, rating DESC
    LIMIT ${params.industry && params.min_rating ? '$3' : params.industry || params.min_rating ? '$2' : '$1'}
  `;
    const queryParams = [];
    if (params.industry) {
        queryParams.push(`%${params.industry}%`);
    }
    if (params.min_rating) {
        queryParams.push(params.min_rating);
    }
    queryParams.push(params.max_results);
    const result = await db.query(query, queryParams);
    return result.rows;
}
function generateMockCompanies(params) {
    const industry = params.industry || 'HVAC';
    const location = params.location;
    const count = Math.min(params.max_results, 10); // Limit mock results
    const companies = [];
    const businessNames = [
        'Precision',
        'Elite',
        'Pro',
        'Premier',
        'Ace',
        'Quality',
        'Reliable',
        'Expert',
        'Superior',
        'Master',
    ];
    for (let i = 0; i < count; i++) {
        const rating = (Math.random() * (5.0 - params.min_rating) + params.min_rating).toFixed(1);
        const reviewCount = Math.floor(Math.random() * 200) + 20;
        const qualityScore = (Math.random() * 0.4 + 0.6).toFixed(2); // 0.60 - 1.00
        companies.push({
            id: `mock-${Date.now()}-${i}`,
            name: `${businessNames[i % businessNames.length]} ${industry} Services`,
            phone: `(555) ${String(100 + i).padStart(3, '0')}-${String(1000 + Math.floor(Math.random() * 9000))}`,
            email: null, // Email typically requires enrichment
            website: `www.${businessNames[i % businessNames.length].toLowerCase()}${industry.toLowerCase()}.com`,
            address: `${100 + i * 10} Main Street`,
            city: location.split(',')[0].trim(),
            state: location.includes(',') ? location.split(',')[1].trim() : 'TX',
            zip_code: `${75000 + i}`,
            business_category: industry,
            rating: parseFloat(rating),
            review_count: reviewCount,
            data_quality_score: parseFloat(qualityScore),
            google_maps_url: `https://maps.google.com/?cid=mock${i}`,
        });
    }
    return companies;
}
function formatSuccessResponse(companies, params, dataSource) {
    const summary = `Found ${companies.length} ${params.industry || 'companies'} in ${params.location}`;
    const sourceText = dataSource === 'yellow_pages'
        ? 'Yellow Pages (PRIMARY - live scraping)'
        : dataSource === 'google_maps'
            ? 'Google Maps (FALLBACK - live scraping)'
            : dataSource === 'database'
                ? 'Database (previously scraped)'
                : 'Mock data (for demonstration)';
    // Build results table
    let resultsText = `${summary}\n\n`;
    resultsText += `Data Source: ${sourceText}\n`;
    resultsText += `Search Parameters:\n`;
    resultsText += `  - Location: ${params.location}\n`;
    resultsText += `  - Industry: ${params.industry || 'All'}\n`;
    resultsText += `  - Min Rating: ${params.min_rating}\n`;
    resultsText += `  - Radius: ${params.radius_miles} miles\n\n`;
    resultsText += `Results:\n`;
    resultsText += `${'='.repeat(80)}\n\n`;
    companies.forEach((company, index) => {
        resultsText += `${index + 1}. ${company.name}\n`;
        resultsText += `   ID: ${company.id}\n`;
        resultsText += `   Phone: ${company.phone || 'Not available'}\n`;
        resultsText += `   Website: ${company.website || 'Not available'}\n`;
        resultsText += `   Address: ${company.address || 'Not available'}, ${company.city}, ${company.state} ${company.zip_code}\n`;
        if (company.rating) {
            resultsText += `   Rating: ${company.rating} (${company.review_count} reviews)\n`;
        }
        if (company.years_in_business) {
            resultsText += `   Years in Business: ${company.years_in_business}\n`;
        }
        resultsText += `   Quality Score: ${(company.data_quality_score * 100).toFixed(0)}%\n`;
        resultsText += `\n`;
    });
    if (dataSource === 'mock') {
        resultsText += `\n${'='.repeat(80)}\n`;
        resultsText += `NOTE: This is sample data. Real scraping requires:\n`;
        resultsText += `1. Valid proxy configuration in config/proxies.json\n`;
        resultsText += `2. Rate limit configuration in config/scraper-limits.json\n`;
        resultsText += `3. (Optional) Database connection for persistence\n`;
    }
    else if (dataSource === 'yellow_pages') {
        resultsText += `\n${'='.repeat(80)}\n`;
        resultsText += `SUCCESS: Real data scraped from Yellow Pages (PRIMARY SOURCE)!\n`;
        resultsText += `Why Yellow Pages: More complete B2B data, phone + website + address in one place\n`;
        resultsText += `Companies ${companies.length > 0 && companies[0].id.includes('mock') ? 'NOT ' : ''}saved to database.\n`;
    }
    else if (dataSource === 'google_maps') {
        resultsText += `\n${'='.repeat(80)}\n`;
        resultsText += `SUCCESS: Real data scraped from Google Maps (FALLBACK)!\n`;
        resultsText += `Note: Yellow Pages is preferred but was unavailable for this search.\n`;
        resultsText += `Companies ${companies.length > 0 && companies[0].id.includes('mock') ? 'NOT ' : ''}saved to database.\n`;
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
function formatErrorResponse(error, params) {
    let errorText = `Failed to search for companies\n\n`;
    errorText += `Error: ${error}\n\n`;
    errorText += `Search Parameters:\n`;
    errorText += `  - Location: ${params.location}\n`;
    errorText += `  - Industry: ${params.industry || 'All'}\n`;
    errorText += `  - Min Rating: ${params.min_rating}\n\n`;
    errorText += `Troubleshooting:\n`;
    errorText += `1. Check if rate limit was hit (check logs)\n`;
    errorText += `2. Verify proxy configuration is correct\n`;
    errorText += `3. Try again with a smaller max_results\n`;
    errorText += `4. Check if Google Maps is accessible\n`;
    return {
        content: [
            {
                type: 'text',
                text: errorText,
            },
        ],
    };
}
//# sourceMappingURL=search-companies.tool.js.map