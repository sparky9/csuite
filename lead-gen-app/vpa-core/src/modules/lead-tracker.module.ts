/**
 * LeadTracker Module Wrapper
 *
 * Wraps existing LeadTracker Pro MCP tools with:
 * - Module access control
 * - Usage tracking
 * - User context injection
 *
 * @deprecated This legacy interface now fully delegates to LeadTracker Pro.
 *             Keep in place for backward compatibility until VPA v2 removes it.
 */

import { requireModuleAccess } from '../auth/module-access.js';
import { trackUsage, createUsageRecord } from '../db/usage.js';
import { logger } from '../utils/logger.js';

// Import actual LeadTracker tools
import { addProspectTool } from '../../../leadtracker-pro/src/tools/add-prospect.tool.js';
import { addContactTool } from '../../../leadtracker-pro/src/tools/add-contact.tool.js';
import { updateProspectStatusTool } from '../../../leadtracker-pro/src/tools/update-prospect-status.tool.js';
import { logActivityTool } from '../../../leadtracker-pro/src/tools/log-activity.tool.js';
import { searchProspectsTool } from '../../../leadtracker-pro/src/tools/search-prospects.tool.js';
import { getFollowUpsTool } from '../../../leadtracker-pro/src/tools/get-follow-ups.tool.js';
import { getPipelineStatsTool } from '../../../leadtracker-pro/src/tools/get-pipeline-stats.tool.js';
import { importProspectsTool } from '../../../leadtracker-pro/src/tools/import-prospects.tool.js';
// @ts-ignore LeadTracker Pro publishes this runtime tool; type declarations resolve via generated d.ts
import { updateFollowUpTool } from '../../../leadtracker-pro/src/tools/update-follow-up.tool.js';
import { getNextActionsTool } from '../../../leadtracker-pro/src/tools/get-next-actions.tool.js';
import { getWinLossReportTool } from '../../../leadtracker-pro/src/tools/get-win-loss-report.tool.js';

const MODULE_ID = 'lead-tracker';

export class LeadTrackerModule {
  /**
   * Add a new prospect to pipeline
   */
  async addProspect(params: any, userId: string): Promise<any> {
    const startTime = Date.now();

    try {
      await requireModuleAccess(userId, MODULE_ID);

      logger.info('LeadTracker: add_prospect', { userId, params });

      const result = await addProspectTool(params, true, userId);

      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'add_prospect',
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
        'add_prospect',
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
   * Add a contact to a prospect
   */
  async addContact(params: any, userId: string): Promise<any> {
    const startTime = Date.now();

    try {
      await requireModuleAccess(userId, MODULE_ID);

      logger.info('LeadTracker: add_contact', { userId, params });

      const result = await addContactTool(params, true, userId);

      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'add_contact',
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
        'add_contact',
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
   * Update prospect status
   */
  async updateProspectStatus(params: any, userId: string): Promise<any> {
    const startTime = Date.now();

    try {
      await requireModuleAccess(userId, MODULE_ID);

      logger.info('LeadTracker: update_prospect_status', { userId, params });

      const result = await updateProspectStatusTool(params, true, userId);

      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'update_prospect_status',
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
        'update_prospect_status',
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
   * Log an activity (call, email, note)
   */
  async logActivity(params: any, userId: string): Promise<any> {
    const startTime = Date.now();

    try {
      await requireModuleAccess(userId, MODULE_ID);

      logger.info('LeadTracker: log_activity', { userId, params });

      const result = await logActivityTool(params, true, userId);

      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'log_activity',
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
        'log_activity',
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
   * Search prospects
   */
  async searchProspects(params: any, userId: string): Promise<any> {
    const startTime = Date.now();

    try {
      await requireModuleAccess(userId, MODULE_ID);

      logger.info('LeadTracker: search_prospects', { userId, params });

      const result = await searchProspectsTool(params, true, userId);

      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'search_prospects',
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
        'search_prospects',
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
   * Get upcoming follow-ups
   */
  async getFollowUps(params: any, userId: string): Promise<any> {
    const startTime = Date.now();

    try {
      await requireModuleAccess(userId, MODULE_ID);

      logger.info('LeadTracker: get_follow_ups', { userId, params });

      const result = await getFollowUpsTool(params, true, userId);

      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'get_follow_ups',
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
        'get_follow_ups',
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
   * Get pipeline statistics
   */
  async getPipelineStats(params: any, userId: string): Promise<any> {
    const startTime = Date.now();

    try {
      await requireModuleAccess(userId, MODULE_ID);

      logger.info('LeadTracker: get_pipeline_stats', { userId, params });

      const result = await getPipelineStatsTool(params, true, userId);

      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'get_pipeline_stats',
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
        'get_pipeline_stats',
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
   * Import prospects into pipeline
   */
  async importProspects(params: any, userId: string): Promise<any> {
    const startTime = Date.now();

    try {
      await requireModuleAccess(userId, MODULE_ID);

      logger.info('LeadTracker: import_prospects', { userId, params });

      const result = await importProspectsTool(params, true, userId);

      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'import_prospects',
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
        'import_prospects',
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
   * Update a follow-up reminder
   */
  async updateFollowUp(params: any, userId: string): Promise<any> {
    const startTime = Date.now();

    try {
      await requireModuleAccess(userId, MODULE_ID);

      logger.info('LeadTracker: update_follow_up', { userId, params });

      const result = await updateFollowUpTool(params, true, userId);

      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'update_follow_up',
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
        'update_follow_up',
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
   * Get prioritized next-action recommendations
   */
  async getNextActions(params: any, userId: string): Promise<any> {
    const startTime = Date.now();

    try {
      await requireModuleAccess(userId, MODULE_ID);

      logger.info('LeadTracker: get_next_actions', { userId, params });

      const result = await getNextActionsTool(params, true, userId);

      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'get_next_actions',
        {
          executionTimeMs: Date.now() - startTime,
          metadata: { limit: params?.limit },
        }
      ));

      return result;
    } catch (error) {
      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'get_next_actions',
        {
          success: false,
          errorMessage: error instanceof Error ? error.message : String(error),
          executionTimeMs: Date.now() - startTime,
        }
      ));
      throw error;
    }
  }

  /**
   * Generate win/loss performance report
   */
  async getWinLossReport(params: any, userId: string): Promise<any> {
    const startTime = Date.now();

    try {
      await requireModuleAccess(userId, MODULE_ID);

      logger.info('LeadTracker: get_win_loss_report', { userId, params });

      const result = await getWinLossReportTool(params, true, userId);

      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'get_win_loss_report',
        {
          executionTimeMs: Date.now() - startTime,
          metadata: { timeframe: params?.timeframe },
        }
      ));

      return result;
    } catch (error) {
      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'get_win_loss_report',
        {
          success: false,
          errorMessage: error instanceof Error ? error.message : String(error),
          executionTimeMs: Date.now() - startTime,
        }
      ));
      throw error;
    }
  }
}
