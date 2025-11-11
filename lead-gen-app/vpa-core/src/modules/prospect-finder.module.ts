/**
 * ProspectFinder Module Wrapper
 *
 * Wraps existing ProspectFinder MCP tools with:
 * - Module access control
 * - Usage tracking
 * - User context injection
 */

import { requireModuleAccess } from '../auth/module-access.js';
import { trackUsage, createUsageRecord } from '../db/usage.js';
import { logger } from '../utils/logger.js';

// Import actual ProspectFinder tools
import { searchCompaniesTool } from '../../../prospect-finder/src/tools/search-companies.tool.js';
import { findDecisionMakersTool } from '../../../prospect-finder/src/tools/find-decision-makers.tool.js';
import { enrichCompanyTool } from '../../../prospect-finder/src/tools/enrich-company.tool.js';
import { exportProspectsTool } from '../../../prospect-finder/src/tools/export-prospects.tool.js';
import { getScrapingStatsTool } from '../../../prospect-finder/src/tools/get-scraping-stats.tool.js';

const MODULE_ID = 'prospect-finder';

export class ProspectFinderModule {
  /**
   * Search for companies by industry/location
   */
  async searchCompanies(params: any, userId: string): Promise<any> {
    const startTime = Date.now();

    try {
      // Check access
      await requireModuleAccess(userId, MODULE_ID);

      logger.info('ProspectFinder: search_companies', { userId, params });

      // Call actual ProspectFinder tool with userId
      const result = await searchCompaniesTool(params, true, userId);

      // Track usage
      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'search_companies',
        {
          executionTimeMs: Date.now() - startTime,
          metadata: { params }
        }
      ));

      return result;
    } catch (error) {
      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'search_companies',
        {
          success: false,
          errorMessage: error instanceof Error ? error.message : String(error),
          executionTimeMs: Date.now() - startTime
        }
      ));
      throw error;
    }
  }

  /**
   * Find decision makers at a company
   */
  async findDecisionMakers(params: any, userId: string): Promise<any> {
    const startTime = Date.now();

    try {
      await requireModuleAccess(userId, MODULE_ID);

      logger.info('ProspectFinder: find_decision_makers', { userId, params });

      // Call actual ProspectFinder tool with userId
      const result = await findDecisionMakersTool(params, true, userId);

      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'find_decision_makers',
        {
          executionTimeMs: Date.now() - startTime,
          metadata: { params }
        }
      ));

      return result;
    } catch (error) {
      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'find_decision_makers',
        {
          success: false,
          errorMessage: error instanceof Error ? error.message : String(error),
          executionTimeMs: Date.now() - startTime
        }
      ));
      throw error;
    }
  }

  /**
   * Enrich company data
   */
  async enrichCompany(params: any, userId: string): Promise<any> {
    const startTime = Date.now();

    try {
      await requireModuleAccess(userId, MODULE_ID);

      logger.info('ProspectFinder: enrich_company', { userId, params });

      // Call actual ProspectFinder tool with userId
      const result = await enrichCompanyTool(params, true, userId);

      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'enrich_company',
        {
          executionTimeMs: Date.now() - startTime,
          metadata: { params }
        }
      ));

      return result;
    } catch (error) {
      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'enrich_company',
        {
          success: false,
          errorMessage: error instanceof Error ? error.message : String(error),
          executionTimeMs: Date.now() - startTime
        }
      ));
      throw error;
    }
  }

  /**
   * Export prospects
   */
  async exportProspects(params: any, userId: string): Promise<any> {
    const startTime = Date.now();

    try {
      await requireModuleAccess(userId, MODULE_ID);

      logger.info('ProspectFinder: export_prospects', { userId, params });

      // Call actual ProspectFinder tool with userId
      const result = await exportProspectsTool(params, true, userId);

      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'export_prospects',
        {
          executionTimeMs: Date.now() - startTime,
          metadata: { params }
        }
      ));

      return result;
    } catch (error) {
      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'export_prospects',
        {
          success: false,
          errorMessage: error instanceof Error ? error.message : String(error),
          executionTimeMs: Date.now() - startTime
        }
      ));
      throw error;
    }
  }

  /**
   * Get scraping statistics
   */
  async getScrapingStats(params: any, userId: string): Promise<any> {
    const startTime = Date.now();

    try {
      await requireModuleAccess(userId, MODULE_ID);

      logger.info('ProspectFinder: get_scraping_stats', { userId, params });

      // Call actual ProspectFinder tool with userId
      const result = await getScrapingStatsTool(params, true, userId);

      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'get_scraping_stats',
        {
          executionTimeMs: Date.now() - startTime,
          metadata: { params }
        }
      ));

      return result;
    } catch (error) {
      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'get_scraping_stats',
        {
          success: false,
          errorMessage: error instanceof Error ? error.message : String(error),
          executionTimeMs: Date.now() - startTime
        }
      ));
      throw error;
    }
  }
}
