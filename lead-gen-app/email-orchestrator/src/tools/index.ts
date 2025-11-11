/**
 * All MCP tools for EmailOrchestrator
 */

import { z } from 'zod';
import { campaignManager } from '../campaigns/campaign-manager.js';
import { pauseCampaign, resumeCampaign, handleProspectReply } from '../campaigns/auto-pause.js';
import { emailSender } from '../email/email-sender.js';
import { db } from '../db/client.js';
import { logger } from '../utils/logger.js';
import { generatePersonalizedEmail } from '../ai/personalization.js';
import { handleUnsubscribe } from '../utils/compliance.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// Export all tool definitions and handlers

// ============================================================================
// TOOL 1: CREATE CAMPAIGN
// ============================================================================

export const createCampaignTool: Tool = {
  name: 'create_campaign',
  description: 'Create a new multi-touch email campaign with AI personalization',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Campaign name' },
      description: { type: 'string', description: 'Campaign description' },
      from_email: { type: 'string', description: 'Sender email' },
      from_name: { type: 'string', description: 'Sender name' },
      target_prospect_ids: { type: 'array', items: { type: 'string' } },
      target_tags: { type: 'array', items: { type: 'string' } },
      send_timezone: { type: 'string', description: 'e.g., America/Chicago' },
    },
    required: ['name', 'from_email'],
  },
};

export async function handleCreateCampaign(args: any) {
  try {
    const campaign = await campaignManager.createCampaign(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, campaign }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }], isError: true };
  }
}

// ============================================================================
// TOOL 2: CREATE TEMPLATE
// ============================================================================

export const createTemplateTool: Tool = {
  name: 'create_template',
  description: 'Create reusable email template with AI enhancement support',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      category: { type: 'string', description: 'e.g., introduction, follow_up, value_proposition' },
      subject_line: { type: 'string' },
      body_template: { type: 'string', description: 'HTML email body with {{variables}}' },
      personalization_instructions: { type: 'string', description: 'Instructions for AI' },
      use_ai_enhancement: { type: 'boolean', default: true },
    },
    required: ['name', 'category', 'subject_line', 'body_template'],
  },
};

export async function handleCreateTemplate(args: any) {
  try {
    const result = await db.query(
      `INSERT INTO email_templates (name, category, subject_line, body_template, personalization_instructions, use_ai_enhancement, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        args.name,
        args.category,
        args.subject_line,
        args.body_template,
        args.personalization_instructions || null,
        args.use_ai_enhancement !== false,
        args.description || null,
      ]
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, template: result.rows[0] }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }], isError: true };
  }
}

// ============================================================================
// TOOL 3: SEND EMAIL
// ============================================================================

export const sendEmailTool: Tool = {
  name: 'send_email',
  description: 'Send a one-off email (not part of campaign) with tracking',
  inputSchema: {
    type: 'object',
    properties: {
      to_email: { type: 'string' },
      to_name: { type: 'string' },
      from_email: { type: 'string' },
      from_name: { type: 'string' },
      subject_line: { type: 'string' },
      body_html: { type: 'string' },
      prospect_id: { type: 'string', description: 'Optional prospect ID for tracking' },
      tracking_enabled: { type: 'boolean', default: true },
    },
    required: ['to_email', 'from_email', 'subject_line', 'body_html'],
  },
};

export async function handleSendEmail(args: any) {
  try {
    const sentEmail = await emailSender.sendEmail(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              sent_email: {
                id: sentEmail.id,
                to: sentEmail.to_email,
                subject: sentEmail.subject_line,
                status: sentEmail.status,
                sent_at: sentEmail.sent_at,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }], isError: true };
  }
}

// ============================================================================
// TOOL 4: GET CAMPAIGN STATS
// ============================================================================

export const getCampaignStatsTool: Tool = {
  name: 'get_campaign_stats',
  description: 'View detailed analytics for a campaign',
  inputSchema: {
    type: 'object',
    properties: {
      campaign_id: { type: 'string' },
    },
    required: ['campaign_id'],
  },
};

export async function handleGetCampaignStats(args: any) {
  try {
    const performance = await db.queryOne(
      'SELECT * FROM campaign_performance WHERE id = $1',
      [args.campaign_id]
    );

    const sequences = await db.query(
      'SELECT * FROM email_sequences WHERE campaign_id = $1 ORDER BY sequence_order',
      [args.campaign_id]
    );

    const recentActivity = await db.query(
      `SELECT * FROM email_activity_timeline
       WHERE campaign_id = $1
       ORDER BY sent_at DESC LIMIT 20`,
      [args.campaign_id]
    );

    const topProspects = await db.query(
      `SELECT prospect_id, emails_sent, emails_opened, replied
       FROM campaign_prospects
       WHERE campaign_id = $1
       ORDER BY emails_opened DESC LIMIT 10`,
      [args.campaign_id]
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              performance: performance,
              sequences: sequences.rows,
              recent_activity: recentActivity.rows,
              top_prospects: topProspects.rows,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }], isError: true };
  }
}

// ============================================================================
// TOOL 5: PAUSE/RESUME CAMPAIGN
// ============================================================================

export const pauseResumeCampaignTool: Tool = {
  name: 'pause_resume_campaign',
  description: 'Pause or resume an active campaign',
  inputSchema: {
    type: 'object',
    properties: {
      campaign_id: { type: 'string' },
      action: { type: 'string', enum: ['pause', 'resume'] },
      reason: { type: 'string', description: 'Reason for pausing (optional)' },
    },
    required: ['campaign_id', 'action'],
  },
};

export async function handlePauseResumeCampaign(args: any) {
  try {
    let result;

    if (args.action === 'pause') {
      const pausedCount = await pauseCampaign(args.campaign_id, args.reason || 'Manual pause');
      result = { action: 'paused', paused_prospects: pausedCount };
    } else {
      const resumedCount = await resumeCampaign(args.campaign_id);
      result = { action: 'resumed', resumed_prospects: resumedCount };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, ...result }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }], isError: true };
  }
}

// ============================================================================
// TOOL 6: GET EMAIL HISTORY
// ============================================================================

export const getEmailHistoryTool: Tool = {
  name: 'get_email_history',
  description: 'View all emails sent to a prospect with tracking data',
  inputSchema: {
    type: 'object',
    properties: {
      prospect_id: { type: 'string' },
      limit: { type: 'number', default: 50 },
    },
    required: ['prospect_id'],
  },
};

export async function handleGetEmailHistory(args: any) {
  try {
    const emails = await db.query(
      `SELECT
        se.*,
        c.name as campaign_name,
        COUNT(DISTINCT CASE WHEN et.event_type = 'open' THEN et.id END) as opens,
        COUNT(DISTINCT CASE WHEN et.event_type = 'click' THEN et.id END) as clicks
       FROM sent_emails se
       LEFT JOIN campaigns c ON c.id = se.campaign_id
       LEFT JOIN email_tracking et ON et.sent_email_id = se.id
       WHERE se.prospect_id = $1
       GROUP BY se.id, c.name
       ORDER BY se.sent_at DESC
       LIMIT $2`,
      [args.prospect_id, args.limit || 50]
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              prospect_id: args.prospect_id,
              total_emails: emails.rows.length,
              emails: emails.rows,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error: any) {
    return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }], isError: true };
  }
}

// ============================================================================
// TOOL 7: MANAGE UNSUBSCRIBES
// ============================================================================

export const manageUnsubscribesTool: Tool = {
  name: 'manage_unsubscribes',
  description: 'View or add email addresses to global unsubscribe list',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list', 'add', 'check'] },
      email: { type: 'string', description: 'Email to add or check' },
      reason: { type: 'string', description: 'Unsubscribe reason' },
      limit: { type: 'number', default: 100 },
    },
    required: ['action'],
  },
};

export async function handleManageUnsubscribes(args: any) {
  try {
    if (args.action === 'list') {
      const unsubscribes = await db.query(
        'SELECT * FROM unsubscribes ORDER BY unsubscribed_at DESC LIMIT $1',
        [args.limit || 100]
      );
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, unsubscribes: unsubscribes.rows }, null, 2),
          },
        ],
      };
    } else if (args.action === 'add') {
      await db.query(
        'INSERT INTO unsubscribes (email, unsubscribe_reason) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING',
        [args.email, args.reason || 'Manual addition']
      );
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, message: `${args.email} added to unsubscribe list` }),
          },
        ],
      };
    } else if (args.action === 'check') {
      const result = await db.queryOne('SELECT * FROM unsubscribes WHERE email = $1', [args.email]);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { success: true, is_unsubscribed: result !== null, details: result },
              null,
              2
            ),
          },
        ],
      };
    }

    return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Invalid action' }) }], isError: true };
  } catch (error: any) {
    return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }], isError: true };
  }
}

// ============================================================================
// ADDITIONAL HELPER TOOLS
// ============================================================================

export const addEmailSequenceTool: Tool = {
  name: 'add_email_sequence',
  description: 'Add email to campaign sequence (e.g., Email 1, Email 2, etc.)',
  inputSchema: {
    type: 'object',
    properties: {
      campaign_id: { type: 'string' },
      sequence_order: { type: 'number', description: '1, 2, 3, etc.' },
      day_offset: { type: 'number', description: 'Days after previous email (0 for first)' },
      subject_line: { type: 'string' },
      body_template: { type: 'string' },
      template_id: { type: 'string', description: 'Optional: use existing template' },
      personalization_instructions: { type: 'string' },
    },
    required: ['campaign_id', 'sequence_order', 'day_offset', 'subject_line', 'body_template'],
  },
};

export async function handleAddEmailSequence(args: any) {
  try {
    await campaignManager.addSequence(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, message: 'Email sequence added' }),
        },
      ],
    };
  } catch (error: any) {
    return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }], isError: true };
  }
}

export const startCampaignTool: Tool = {
  name: 'start_campaign',
  description: 'Start a draft campaign and enroll prospects',
  inputSchema: {
    type: 'object',
    properties: {
      campaign_id: { type: 'string' },
    },
    required: ['campaign_id'],
  },
};

export async function handleStartCampaign(args: any) {
  try {
    const enrolledCount = await campaignManager.startCampaign(args.campaign_id);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, enrolled_prospects: enrolledCount }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error.message }) }], isError: true };
  }
}

// ============================================================================
// INBOX MANAGEMENT TOOLS (EmailOrchestrator Pro)
// ============================================================================

import { readInboxTool, handleReadInbox } from './read-inbox.tool.js';
import { searchEmailsTool, handleSearchEmails } from './search-emails.tool.js';
import { getThreadTool, handleGetThread } from './get-thread.tool.js';
import { composeEmailTool, handleComposeEmail } from './compose-email.tool.js';
import { replyEmailTool, handleReplyEmail } from './reply-email.tool.js';
import { organizeEmailTool, handleOrganizeEmail } from './organize-email.tool.js';
import { summarizeThreadTool, handleSummarizeThread } from './summarize-thread.tool.js';
import { suggestReplyTool, handleSuggestReply } from './suggest-reply.tool.js';

// Export all tools and handlers
export const tools = [
  // Campaign tools (existing)
  createCampaignTool,
  createTemplateTool,
  sendEmailTool,
  getCampaignStatsTool,
  pauseResumeCampaignTool,
  getEmailHistoryTool,
  manageUnsubscribesTool,
  addEmailSequenceTool,
  startCampaignTool,

  // Inbox management tools (NEW)
  readInboxTool,
  searchEmailsTool,
  getThreadTool,
  composeEmailTool,
  replyEmailTool,
  organizeEmailTool,
  summarizeThreadTool,
  suggestReplyTool,
];

export const toolHandlers: Record<string, (args: any) => Promise<any>> = {
  // Campaign handlers (existing)
  create_campaign: handleCreateCampaign,
  create_template: handleCreateTemplate,
  send_email: handleSendEmail,
  get_campaign_stats: handleGetCampaignStats,
  pause_resume_campaign: handlePauseResumeCampaign,
  get_email_history: handleGetEmailHistory,
  manage_unsubscribes: handleManageUnsubscribes,
  add_email_sequence: handleAddEmailSequence,
  start_campaign: handleStartCampaign,

  // Inbox management handlers (NEW)
  read_inbox: handleReadInbox,
  search_emails: handleSearchEmails,
  get_email_thread: handleGetThread,
  compose_email: handleComposeEmail,
  reply_to_email: handleReplyEmail,
  organize_email: handleOrganizeEmail,
  summarize_thread: handleSummarizeThread,
  suggest_reply: handleSuggestReply,
};
