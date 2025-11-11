/**
 * find_partnership_opportunities tool implementation
 *
 * Search for complementary businesses that would make good partnership targets.
 * Leverages existing prospect search infrastructure to find non-competing businesses.
 */

import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { YellowPagesScraper } from '../scrapers/yellow-pages-scraper.js';
import { GoogleMapsScraper } from '../scrapers/google-maps-scraper.js';
import { getBrowserPool } from '../browser/browser-pool.js';
import { getProxyManager } from '../browser/proxy-manager.js';
import { getRateLimiter } from '../utils/rate-limiter.js';
import { PartnershipOpportunity } from '../types/prospect.types.js';
import complementaryIndustriesData from '../data/complementary-industries.json' with { type: 'json' };

// Zod schema for input validation
const FindPartnershipOpportunitiesSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  yourIndustry: z.string().min(2, 'yourIndustry must be at least 2 characters'),
  location: z.string().optional(),
  maxResults: z.number().min(1).max(100).optional().default(20),
});

/**
 * Complementary industries mapping
 * Loaded directly as module import to ensure it's included in production builds
 */
const COMPLEMENTARY_INDUSTRIES: Record<string, string[]> = complementaryIndustriesData as Record<string, string[]>;

// Validate that data loaded successfully
if (!COMPLEMENTARY_INDUSTRIES || Object.keys(COMPLEMENTARY_INDUSTRIES).length === 0) {
  throw new Error('Failed to load complementary industries mapping - data file is empty or invalid');
}

/**
 * Get complementary industries for a given industry
 */
function getComplementaryIndustries(industry: string): string[] {
  const normalizedIndustry = industry.toLowerCase().trim();

  // Try exact match first
  if (COMPLEMENTARY_INDUSTRIES[normalizedIndustry]) {
    return COMPLEMENTARY_INDUSTRIES[normalizedIndustry];
  }

  // Try partial matches
  for (const [key, complementaries] of Object.entries(COMPLEMENTARY_INDUSTRIES)) {
    if (normalizedIndustry.includes(key) || key.includes(normalizedIndustry)) {
      return complementaries;
    }
  }

  // If no match, return some generic complementary services
  logger.warn('No complementary industries found for industry', { industry });
  return ['business consulting', 'marketing', 'accounting', 'legal services'];
}

/**
 * Generate synergy explanation for a complementary industry
 */
function generateSynergyExplanation(userIndustry: string, partnerIndustry: string): string {
  const normalizedUserIndustry = userIndustry.toLowerCase();
  const normalizedPartnerIndustry = partnerIndustry.toLowerCase();

  // Common synergy patterns
  const synergyPatterns: Record<string, string> = {
    'web design_web hosting': 'Clients needing websites also need hosting services',
    'web design_seo services': 'New websites need SEO optimization for visibility',
    'web design_copywriting': 'Professional websites need quality content',
    'hvac_plumbing': 'Home service clients often need both HVAC and plumbing work',
    'hvac_electrical': 'HVAC installations require electrical work',
    'landscaping_lawn care': 'Property owners need both design and maintenance',
    'accounting_legal services': 'Businesses need both financial and legal guidance',
    'real estate_mortgage broker': 'Home buyers need both real estate and financing services',
    'photography_videography': 'Clients often need both photo and video services',
    'event planning_catering': 'Events require both planning and food services',
  };

  // Try to find a specific pattern
  const patternKey = `${normalizedUserIndustry}_${normalizedPartnerIndustry}`;
  if (synergyPatterns[patternKey]) {
    return synergyPatterns[patternKey];
  }

  // Generate generic synergy explanation
  return `Complementary to ${userIndustry} - clients often need both services`;
}

/**
 * Main tool handler
 */
export async function findPartnershipOpportunitiesTool(args: unknown, _dbConnected?: boolean) {
  // Validate input
  const params = FindPartnershipOpportunitiesSchema.parse(args);

  logger.info('Finding partnership opportunities', {
    userId: params.userId,
    yourIndustry: params.yourIndustry,
    location: params.location,
    maxResults: params.maxResults,
  });

  try {
    // Get complementary industries
    const complementaryIndustries = getComplementaryIndustries(params.yourIndustry);

    if (complementaryIndustries.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              opportunities: [],
              message: 'No complementary industries found for your industry',
            }, null, 2),
          },
        ],
      };
    }

    logger.info('Found complementary industries', {
      count: complementaryIndustries.length,
      industries: complementaryIndustries,
    });

    // Initialize scrapers
    const proxyManager = getProxyManager();
    await proxyManager.initialize();

    const rateLimiter = getRateLimiter();
    await rateLimiter.initialize();

    const browserPool = getBrowserPool(proxyManager);

    const allOpportunities: PartnershipOpportunity[] = [];
    const resultsPerIndustry = Math.ceil(params.maxResults / complementaryIndustries.length);

    // Search for each complementary industry
    for (const complementaryIndustry of complementaryIndustries) {
      if (allOpportunities.length >= params.maxResults) {
        break;
      }

      logger.info('Searching for complementary industry', {
        industry: complementaryIndustry,
        location: params.location,
      });

      try {
        // Try Yellow Pages first (better B2B data)
        const yellowPagesScraper = new YellowPagesScraper(browserPool, proxyManager, rateLimiter);
        const ypResult = await yellowPagesScraper.scrape({
          industry: complementaryIndustry,
          location: params.location || 'United States',
          max_results: resultsPerIndustry,
        });

        if (ypResult.success && ypResult.data && ypResult.data.length > 0) {
          logger.info('Yellow Pages search succeeded', {
            industry: complementaryIndustry,
            results: ypResult.data.length,
          });

          // Convert to partnership opportunities
          for (const company of ypResult.data) {
            if (allOpportunities.length >= params.maxResults) {
              break;
            }

            allOpportunities.push({
              companyName: company.name,
              industry: complementaryIndustry,
              synergy: generateSynergyExplanation(params.yourIndustry, complementaryIndustry),
              contactEmail: null, // Yellow Pages doesn't provide email
              website: company.website || null,
              phone: company.phone || null,
              address: company.address || null,
              rating: null, // Yellow Pages doesn't have rating
            });
          }
        } else {
          // Fallback to Google Maps
          logger.info('Falling back to Google Maps', { industry: complementaryIndustry });

          const query = params.location
            ? `${complementaryIndustry} in ${params.location}`
            : complementaryIndustry;

          const gmapsScraper = new GoogleMapsScraper(browserPool, proxyManager, rateLimiter);
          const gmapsResult = await gmapsScraper.scrape({
            query,
            max_results: resultsPerIndustry,
            min_rating: 3.5,
          });

          if (gmapsResult.success && gmapsResult.data && gmapsResult.data.length > 0) {
            logger.info('Google Maps search succeeded', {
              industry: complementaryIndustry,
              results: gmapsResult.data.length,
            });

            // Convert to partnership opportunities
            for (const company of gmapsResult.data) {
              if (allOpportunities.length >= params.maxResults) {
                break;
              }

              allOpportunities.push({
                companyName: company.name,
                industry: complementaryIndustry,
                synergy: generateSynergyExplanation(params.yourIndustry, complementaryIndustry),
                contactEmail: null, // Need to find via email finder
                website: company.website || null,
                phone: company.phone || null,
                address: company.address || null,
                rating: company.rating || null,
              });
            }
          }
        }
      } catch (error) {
        logger.error('Failed to search for complementary industry', {
          industry: complementaryIndustry,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with next industry
      }
    }

    // Close browser pool
    await browserPool.closeAll();

    logger.info('Partnership search complete', {
      totalOpportunities: allOpportunities.length,
      industriesSearched: complementaryIndustries.length,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            opportunities: allOpportunities,
            summary: {
              totalFound: allOpportunities.length,
              complementaryIndustries: complementaryIndustries,
              userIndustry: params.yourIndustry,
              location: params.location || 'Not specified',
            },
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    logger.error('Partnership search failed', { error });
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
