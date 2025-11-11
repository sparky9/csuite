/**
 * EmailOrchestrator Module Wrapper
 *
 * Wraps existing EmailOrchestrator MCP tools with:
 * - Module access control
 * - Usage tracking
 * - User context injection
 *
 * NOTE: EmailOrchestrator handlers currently don't support userId filtering in database queries.
 * This is acceptable for initial launch with manual user provisioning.
 * TODO Phase 2: Add userId filtering to campaign-manager, email-sender, and all DB queries.
 */

import { requireModuleAccess } from '../auth/module-access.js';
import { trackUsage, createUsageRecord } from '../db/usage.js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';

const SEQUENCE_INPUT_SCHEMA = z.object({
  sequence_order: z.number().int().min(1).optional(),
  day_offset: z.number().int().min(0).optional(),
  subject_line: z.string().min(1),
  body_template: z.string().min(1),
  template_id: z.string().optional(),
  personalization_instructions: z.string().optional(),
});

const CREATE_AND_START_SCHEMA = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  from_email: z.string().email('from_email must be a valid email'),
  from_name: z.string().optional(),
  target_prospect_ids: z.array(z.string()).nonempty().optional(),
  target_tags: z.array(z.string()).nonempty().optional(),
  send_timezone: z.string().optional(),
  sequences: z.array(SEQUENCE_INPUT_SCHEMA).min(1, 'Provide at least one sequence email'),
  auto_start: z.boolean().optional(),
});

// Import EmailOrchestrator tool handlers
import {
  handleCreateCampaign,
  handleAddEmailSequence,
  handleStartCampaign,
  handleCreateTemplate,
  handleSendEmail,
  handleGetCampaignStats,
  handlePauseResumeCampaign,
  handleGetEmailHistory,
  handleManageUnsubscribes,
} from '../../../email-orchestrator/src/tools/index.js';

const MODULE_ID = 'email-orchestrator';

export class EmailOrchestratorModule {
  /**
   * Create a new email campaign
   */
  async createCampaign(params: any, userId: string): Promise<any> {
    const startTime = Date.now();

    try {
      await requireModuleAccess(userId, MODULE_ID);

      logger.info('EmailOrchestrator: create_campaign', { userId, params });

      const result = await handleCreateCampaign(params);

      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'create_campaign',
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
        'create_campaign',
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
   * Create an email template
   */
  async createTemplate(params: any, userId: string): Promise<any> {
    const startTime = Date.now();

    try {
      await requireModuleAccess(userId, MODULE_ID);

      logger.info('EmailOrchestrator: create_template', { userId, params });

      const result = await handleCreateTemplate(params);

      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'create_template',
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
        'create_template',
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
   * Add email sequence to campaign
   */
  async addEmailSequence(params: any, userId: string): Promise<any> {
    const startTime = Date.now();

    try {
      await requireModuleAccess(userId, MODULE_ID);

      logger.info('EmailOrchestrator: add_email_sequence', { userId, params });

      const result = await handleAddEmailSequence(params);

      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'add_email_sequence',
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
        'add_email_sequence',
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
   * Start a campaign
   */
  async startCampaign(params: any, userId: string): Promise<any> {
    const startTime = Date.now();

    try {
      await requireModuleAccess(userId, MODULE_ID);

      logger.info('EmailOrchestrator: start_campaign', { userId, params });

      const result = await handleStartCampaign(params);

      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'start_campaign',
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
        'start_campaign',
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
   * Create a campaign, add sequences, and optionally start it
   */
  async createAndStartSequence(params: any, userId: string): Promise<any> {
    const startTime = Date.now();

    try {
      await requireModuleAccess(userId, MODULE_ID);

      logger.info('EmailOrchestrator: create_and_start_sequence', { userId, params });

      const input = CREATE_AND_START_SCHEMA.parse(params);
      const { sequences, auto_start = true, ...campaignInput } = input;

      const createResult = await handleCreateCampaign(campaignInput);
      const createPayload = parseToolJson(createResult);

      const campaignId = createPayload?.campaign?.id;
      if (!createPayload?.success || !campaignId) {
        throw new Error(createPayload?.error || 'Failed to create campaign');
      }

      let sequencesAdded = 0;
      for (const [index, sequence] of sequences.entries()) {
        const sequenceOrder = sequence.sequence_order ?? index + 1;
        const dayOffset = sequence.day_offset ?? (index === 0 ? 0 : 2);

        const sequenceResult = await handleAddEmailSequence({
          campaign_id: campaignId,
          sequence_order: sequenceOrder,
          day_offset: dayOffset,
          subject_line: sequence.subject_line,
          body_template: sequence.body_template,
          template_id: sequence.template_id || undefined,
          personalization_instructions: sequence.personalization_instructions || undefined,
        });

        const sequencePayload = parseToolJson(sequenceResult);
        if (sequencePayload?.success === false) {
          throw new Error(sequencePayload?.error || 'Failed to add sequence email');
        }
        sequencesAdded += 1;
      }

      let startPayload: any = null;
      if (auto_start) {
        const startResult = await handleStartCampaign({ campaign_id: campaignId });
        startPayload = parseToolJson(startResult);
        if (startPayload?.success === false) {
          throw new Error(startPayload?.error || 'Failed to start campaign');
        }
      }

      const summaryLines: string[] = [
        '🚀 Campaign ready to go',
        '',
        `Name: ${campaignInput.name}`,
        `Campaign ID: ${campaignId}`,
        `Sequences added: ${sequencesAdded}`,
        auto_start
          ? `Status: started (enrolled prospects: ${startPayload?.enrolled_prospects ?? 'pending sync'})`
          : 'Status: draft (not started yet)',
      ];

      if (campaignInput.target_prospect_ids?.length) {
        summaryLines.push(`Targets: ${campaignInput.target_prospect_ids.length} prospect IDs`);
      }

      if (campaignInput.target_tags?.length) {
        summaryLines.push(`Tags: ${campaignInput.target_tags.join(', ')}`);
      }

      const response = {
        content: [
          {
            type: 'text',
            text: summaryLines.join('\n'),
          },
        ],
        data: {
          campaignId,
          sequencesAdded,
          autoStarted: auto_start,
          enrolledProspects: startPayload?.enrolled_prospects,
        },
      };

      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'create_and_start_sequence',
        {
          executionTimeMs: Date.now() - startTime,
          metadata: {
            campaignId,
            sequencesAdded,
            auto_start,
          },
        }
      ));

      return response;
    } catch (error) {
      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'create_and_start_sequence',
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
   * Send a single email
   */
  async sendEmail(params: any, userId: string): Promise<any> {
    const startTime = Date.now();

    try {
      await requireModuleAccess(userId, MODULE_ID);

      logger.info('EmailOrchestrator: send_email', { userId, params });

      const result = await handleSendEmail(params);

      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'send_email',
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
        'send_email',
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
   * Get campaign statistics
   */
  async getCampaignStats(params: any, userId: string): Promise<any> {
    const startTime = Date.now();

    try {
      await requireModuleAccess(userId, MODULE_ID);

      logger.info('EmailOrchestrator: get_campaign_stats', { userId, params });

      const result = await handleGetCampaignStats(params);

      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'get_campaign_stats',
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
        'get_campaign_stats',
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
   * Pause or resume campaign
   */
  async pauseResumeCampaign(params: any, userId: string): Promise<any> {
    const startTime = Date.now();

    try {
      await requireModuleAccess(userId, MODULE_ID);

      logger.info('EmailOrchestrator: pause_resume_campaign', { userId, params });

      const result = await handlePauseResumeCampaign(params);

      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'pause_resume_campaign',
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
        'pause_resume_campaign',
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
   * Get email history
   */
  async getEmailHistory(params: any, userId: string): Promise<any> {
    const startTime = Date.now();

    try {
      await requireModuleAccess(userId, MODULE_ID);

      logger.info('EmailOrchestrator: get_email_history', { userId, params });

      const result = await handleGetEmailHistory(params);

      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'get_email_history',
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
        'get_email_history',
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
   * Manage unsubscribes
   */
  async manageUnsubscribes(params: any, userId: string): Promise<any> {
    const startTime = Date.now();

    try {
      await requireModuleAccess(userId, MODULE_ID);

      logger.info('EmailOrchestrator: manage_unsubscribes', { userId, params });

      const result = await handleManageUnsubscribes(params);

      await trackUsage(createUsageRecord(
        userId,
        MODULE_ID,
        'manage_unsubscribes',
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
        'manage_unsubscribes',
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

function parseToolJson(result: any): any | null {
  if (!result || !Array.isArray(result.content)) {
    return null;
  }

  const textItem = result.content.find((item: any) => item?.type === 'text' && typeof item.text === 'string');
  if (!textItem) {
    return null;
  }

  try {
    return JSON.parse(textItem.text);
  } catch (error) {
    logger.warn('Failed to parse tool JSON output', { error, text: textItem.text?.slice(0, 200) });
    return null;
  }
}
