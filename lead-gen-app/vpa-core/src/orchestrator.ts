/**
 * VPA Orchestrator
 *
 * The routing brain that:
 * 1. Parses user intent (keyword-first, LLM fallback)
 * 2. Routes to appropriate module
 * 3. Returns results to MCP server
 *
 * This is the core intelligence that makes VPA "smart".
 */

import { keywordParser, type ParsedIntent } from './intent-parser/keyword-parser.js';
import { llmParser } from './intent-parser/llm-parser.js';
import { ProspectFinderModule } from './modules/prospect-finder.module.js';
import { LeadTrackerModule } from './modules/lead-tracker.module.js';
import { EmailOrchestratorModule } from './modules/email-orchestrator.module.js';
import { ResearchInsightsModule } from './modules/research-insights.module.js';
import { TaskProjectManagerModule } from './modules/task-project-manager.module.js';
import { MetricsModule } from './modules/metrics.module.js';
import { getEnabledModulesWithInfo } from './auth/module-access.js';
import { getSubscriptionInfo } from './auth/license.js';
import { getUserUsageStats } from './db/usage.js';
import { logger } from './utils/logger.js';
import { ToolNotFoundError } from './utils/errors.js';
import {
  captureActivityContext,
  captureProspectContext,
  captureSearchContext,
  captureResearchContext,
  clearResearchContext,
} from './voice/context-updater.js';
import { attachVoiceMetadata, buildVoiceSummary } from './voice/format.js';
import { db } from './db/client.js';
import { loadRuntimeConfig } from './config/runtime.js';
import { buildModuleCatalog } from './modules/catalog.js';

// Module instances (singleton pattern)
const prospectFinder = new ProspectFinderModule();
// TODO: Remove once all clients call LeadTracker Pro tools directly.
const leadTracker = new LeadTrackerModule();
const emailOrchestrator = new EmailOrchestratorModule();
const taskManager = new TaskProjectManagerModule();
let researchInsights = new ResearchInsightsModule();
const metrics = new MetricsModule();

const STATUS_ORDER: Record<string, number> = {
  new: 1,
  contacted: 2,
  qualified: 3,
  meeting_scheduled: 4,
  proposal_sent: 5,
  negotiating: 6,
  closed_won: 7,
  closed_lost: 8,
  on_hold: 9,
};

/**
 * Parse and route user command to appropriate module
 */
export async function parseAndRoute(
  command: string,
  userId: string
): Promise<ParsedIntent> {
  // Try keyword parsing first (fast, free)
  const quickParse = keywordParser(command);

  if (quickParse && quickParse.confidence > 0.85) {
    logger.info('Intent parsed via keywords', {
      userId,
      command: command.substring(0, 100),
      tool: quickParse.tool,
      action: quickParse.action,
      confidence: quickParse.confidence
    });
    return quickParse;
  }

  // Fall back to LLM parsing (robust, small cost)
  logger.info('Intent parsing via LLM', {
    userId,
    command: command.substring(0, 100),
    keywordConfidence: quickParse?.confidence || 0
  });

  const llmParse = await llmParser(command, userId);
  return llmParse;
}

/**
 * Execute a VPA tool with given parameters
 */
export async function executeVPATool(
  tool: string,
  action: string,
  parameters: any,
  userId: string
): Promise<any> {
  logger.info('Executing VPA tool', { userId, tool, action, parameters });

  switch (tool) {
    case 'vpa_prospects':
      return await routeToProspectFinder(action, parameters, userId);

    case 'vpa_pipeline':
      return await routeToLeadTracker(action, parameters, userId);

    case 'vpa_email':
      return await routeToEmailOrchestrator(action, parameters, userId);

    case 'vpa_tasks':
      return await routeToTaskManager(action, parameters, userId);

    case 'vpa_research':
      return await routeToResearchInsights(action, parameters, userId);

    case 'vpa_status':
      return await handleStatusRequest(parameters, userId);

    case 'vpa_configure':
      return await handleConfigureRequest(parameters, userId);

    case 'vpa_modules':
      return await handleModulesRequest(parameters, userId);

    case 'vpa_metrics_dashboard':
      return await handleMetricsRequest(parameters, userId);

    default:
      throw new ToolNotFoundError(tool, 'vpa-core');
  }
}

/**
 * Route to Task & Project Manager module
 */
async function routeToTaskManager(
  action: string,
  params: any,
  userId: string,
): Promise<any> {
  switch (action) {
    case 'add': {
      const result = await taskManager.addTask(params, userId);
      const task = result.data?.task;
      const dueVoice = describeDueForVoice(task?.dueDate);
      const priorityLabel = priorityVoice(task?.priorityLevel);
      const summary = task
        ? `${task.title}${priorityLabel ? ` (${priorityLabel})` : ''}${dueVoice ? `, ${dueVoice}` : ''}.`
        : 'Task added.';
      const voice = buildVoiceSummary(
        summary,
        'Say "What should I focus on?" to review your priorities.',
      );
      return attachVoiceMetadata(result, voice);
    }

    case 'update': {
      const result = await taskManager.updateTask(params, userId);
      const task = result.data?.task;
      const dueVoice = describeDueForVoice(task?.dueDate);
      const summary = task
        ? `${task.title} updated${dueVoice ? `, ${dueVoice}` : ''}.`
        : 'Task updated.';
      const voice = buildVoiceSummary(
        summary,
        'Need momentum? Ask for recommendations.',
      );
      return attachVoiceMetadata(result, voice);
    }

    case 'focus': {
      const result = await taskManager.getFocusList(params, userId);
      const focus = result.data?.focus;
      const total = focus?.summary.total ?? 0;
      const overdue = focus?.summary.overdue ?? 0;
      const nowSection = focus?.sections?.find((section: any) => section.intent === 'now') ?? focus?.sections?.[0];
      const topTask = nowSection?.items?.[0];
      const summary = total
        ? `${pluralize(total, 'active task', 'active tasks')}${overdue ? `, ${pluralize(overdue, 'overdue task', 'overdue tasks')}` : ''}.`
        : 'No active tasks on your list.';
      const dueVoice = describeDueForVoice(topTask?.dueDate);
      const hint = topTask
        ? `Top focus: ${topTask.title}${dueVoice ? ` (${dueVoice})` : ''}.`
        : 'Say "Add a task" to capture something new.';
      const voice = buildVoiceSummary(summary, hint);
      return attachVoiceMetadata(result, voice);
    }

  case 'recommendations':
  case 'recommendation':
  case 'priority':
  case 'priorities': {
      const result = await taskManager.getPriorityRecommendations(params, userId);
      const recommendations = result.data?.recommendations ?? [];
      const top = recommendations[0];
      const dueVoice = describeDueForVoice(top?.dueDate);
      const priorityLabel = priorityVoice(top?.priorityLevel);
      const summary = top
        ? `${top.title}${priorityLabel ? ` — ${priorityLabel}` : ''}${dueVoice ? `, ${dueVoice}` : ''}.`
        : 'No pressing recommendations right now.';
      const hint = top?.suggestedAction ?? 'Say "Show focus list" to review everything.';
      const voice = buildVoiceSummary(summary, hint);
      return attachVoiceMetadata(result, voice);
    }

    case 'complete': {
      const result = await taskManager.completeTask(params, userId);
      const task = result.data?.task;
      const summary = task ? `${task.title} marked complete.` : 'Task marked complete.';
      const voice = buildVoiceSummary(summary, 'Need a recap? Ask for a progress report.');
      return attachVoiceMetadata(result, voice);
    }

    case 'delete': {
      const result = await taskManager.removeTask(params, userId);
      const voice = buildVoiceSummary('Task removed from your list.', 'Need another? Say "Add a task".');
      return attachVoiceMetadata(result, voice);
    }

  case 'report':
  case 'progress_report': {
      const result = await taskManager.getProgressReport(params, userId);
      const report = result.data?.report;
      const completedMetric = report?.metrics.find((metric) => metric.label.toLowerCase().includes('completed'));
      const completedCount = completedMetric ? toNumber(completedMetric.value) : report?.completed.length ?? 0;
      const summary = report
        ? `${pluralize(completedCount, 'task')} completed for ${report.periodLabel}.`
        : 'Progress report ready.';
      const upcoming = report?.upcoming?.[0];
      const dueVoice = describeDueForVoice(upcoming?.dueDate);
      const hint = upcoming ? `Upcoming: ${upcoming.title}${dueVoice ? ` (${dueVoice})` : ''}.` : 'Need next steps? Ask for recommendations.';
      const voice = buildVoiceSummary(summary, hint);
      return attachVoiceMetadata(result, voice);
    }

    default:
      throw new ToolNotFoundError(action, 'task-project-manager');
  }
}

/**
 * Route to Research & Insights module
 */
async function routeToResearchInsights(
  action: string,
  params: any,
  userId: string
): Promise<any> {
  switch (action) {
    case 'add_source': {
      const result = await researchInsights.addSource(params, userId);

      if (result?.source) {
        captureResearchContext(userId, {
          lastAction: 'add_source',
          sourceId: result.source.id,
          sourceLabel: result.source.label,
          lastMessage: result.message,
        });
      }

      return result;
    }

    case 'list_sources': {
      const result = await researchInsights.listSources(userId);
      const sources = Array.isArray(result?.sources) ? result.sources : [];

      if (sources.length > 0) {
        const primary = sources[0];
        captureResearchContext(userId, {
          lastAction: 'list_sources',
          sourcesTracked: sources.length,
          sourceId: primary?.id,
          sourceLabel: primary?.label,
        });
      } else {
        clearResearchContext(userId);
      }

      return result;
    }

    case 'remove_source': {
      const result = await researchInsights.removeSource(params, userId);

      captureResearchContext(userId, {
        lastAction: 'remove_source',
        sourceId: typeof params?.sourceId === 'string' ? params.sourceId : undefined,
        lastMessage: result?.message,
      });

      return result;
    }

    case 'monitor': {
      const result = await researchInsights.runMonitor(params, userId);
      const updates = Array.isArray(result?.updates) ? result.updates : [];
      const firstUpdate = updates[0]?.source;

      captureResearchContext(userId, {
        lastAction: 'monitor',
        updatesCount: updates.length,
        digestHeadline: result?.digest?.headline ?? result?.message,
        sourceId: firstUpdate?.id,
        sourceLabel: firstUpdate?.label,
      });

      return result;
    }

    case 'digest': {
      const result = await researchInsights.getDigest(userId, params);
      const entries = Array.isArray(result?.entries) ? result.entries : [];
      const firstEntry = entries[0]?.source;

      captureResearchContext(userId, {
        lastAction: 'digest',
        updatesCount: entries.length,
        digestHeadline: result?.digest?.headline,
        sourceId: firstEntry?.id,
        sourceLabel: firstEntry?.label,
      });

      return result;
    }

    case 'on_demand': {
      const result = await researchInsights.researchOnDemand(params, userId);
      const findings = Array.isArray(result?.findings) ? result.findings : [];

      captureResearchContext(userId, {
        lastAction: 'on_demand',
        topic: result?.topic,
        findingsCount: findings.length,
        lastMessage: result?.status === 'success' ? undefined : result?.message,
      });

      return result;
    }

    case 'update_source': {
      const result = await researchInsights.updateSource(params, userId);

      if (result?.source) {
        captureResearchContext(userId, {
          lastAction: 'update_source',
          sourceId: result.source.id,
          sourceLabel: result.source.label,
          lastMessage: result?.message,
        });
      }

      return result;
    }

    default:
      throw new ToolNotFoundError(action, 'research-insights');
  }
}

/**
 * Route to ProspectFinder module
 */
async function routeToProspectFinder(
  action: string,
  params: any,
  userId: string
): Promise<any> {
  switch (action) {
    case 'search': {
      const result = await prospectFinder.searchCompanies(params, userId);
      const text = getPrimaryText(result);
      const count = extractCountFromText(text);
      const ids = extractIdsFromText(text);

      captureSearchContext(userId, {
        querySummary: buildProspectQuerySummary(params, count),
        prospectIds: ids.length ? ids : undefined,
        location: params.location,
        industry: params.industry,
      });

      const voice = buildVoiceSummary(
        count !== undefined
          ? `${count} prospects found in ${params.location}`
          : `Prospect list ready for ${params.location}`,
        ids.length ? 'Say "Import them" to add to your pipeline.' : undefined,
      );

      return attachVoiceMetadata(result, voice);
    }

    case 'find_contacts':
      return await prospectFinder.findDecisionMakers(params, userId);

    case 'enrich':
      return await prospectFinder.enrichCompany(params, userId);

    case 'export':
      return await prospectFinder.exportProspects(params, userId);

    case 'stats':
      return await prospectFinder.getScrapingStats(params, userId);

    default:
      throw new ToolNotFoundError(action, 'prospect-finder');
  }
}

/**
 * Route to LeadTracker module (deprecated wrapper over LeadTracker Pro)
 */
async function routeToLeadTracker(
  action: string,
  params: any,
  userId: string
): Promise<any> {
  switch (action) {
    case 'add': {
      const result = await leadTracker.addProspect(params, userId);
      const text = getPrimaryText(result);
      const prospectId = extractFirstMatch(text, /Prospect ID:\s*([0-9a-fA-F-]{10,})/i);

      captureProspectContext(userId, {
        prospectId: prospectId || params.prospect_id,
        name: params.company_name,
        status: params.status || 'new',
      });

      const voice = buildVoiceSummary(
        params.company_name ? `Added ${params.company_name} to your pipeline` : 'New prospect added',
        'Say "Log a call" to capture your next step.',
      );

      return attachVoiceMetadata(result, voice);
    }

    case 'add_contact':
      return await leadTracker.addContact(params, userId);

    case 'update': {
      const result = await leadTracker.updateProspectStatus(params, userId);
      const text = getPrimaryText(result);
      const prospectId = params.prospect_id || extractFirstMatch(text, /Prospect ID:\s*([0-9a-fA-F-]{10,})/i);
      const status = extractStatusFromText(text) || params.status;
      const name = extractLineValue(text, 'Prospect');

      captureProspectContext(userId, {
        prospectId,
        name,
        status,
      });

      const voice = buildVoiceSummary(
        name && status ? `${name} moved to ${status}` : 'Prospect status updated',
        'Say "Log a note" to capture what happened.',
      );

      return attachVoiceMetadata(result, voice);
    }

    case 'search':
      return await leadTracker.searchProspects(params, userId);

    case 'log_activity': {
      const result = await leadTracker.logActivity(params, userId);
      const text = getPrimaryText(result);
      const activityId = extractFirstMatch(text, /Activity ID:\s*([0-9a-fA-F-]{10,})/i);
      const prospectName = extractLineValue(text, 'Prospect');
      const followUp = extractFollowUpDate(text);

      captureActivityContext(userId, {
        activityId,
        prospectId: params.prospect_id,
        prospectName,
        type: params.activity_type,
        notes: params.notes,
        followUp,
      });

      const voice = buildVoiceSummary(
        prospectName ? `Logged ${params.activity_type} for ${prospectName}` : 'Activity recorded',
        followUp ? 'Say "Move that follow-up" to reschedule.' : undefined,
      );

      return attachVoiceMetadata(result, voice);
    }

    case 'update_follow_up': {
      const result = await leadTracker.updateFollowUp(params, userId);
      const text = getPrimaryText(result);
      const followUpId = extractFirstMatch(text, /Follow-up ID:\s*([0-9a-fA-F-]{10,})/i) || params.follow_up_id;
      const prospectName = extractLineValue(text, 'Prospect');
      const newDueDate = extractFirstMatch(text, /New due date:\s*(.+)/i) || params.due_date;
      const prospectIdFromText = extractFirstMatch(text, /Prospect ID:\s*([0-9a-fA-F-]{10,})/i);
      const prospectId = params.prospect_id || prospectIdFromText;

      captureActivityContext(userId, {
        followUpId,
        prospectId,
        prospectName,
        followUp: newDueDate,
      });

      const voice = buildVoiceSummary(
        prospectName ? `Follow-up set for ${prospectName}` : 'Follow-up updated',
        'Say "Remind me" if you need it repeated later.',
      );

      return attachVoiceMetadata(result, voice);
    }

    case 'follow_ups': {
      const result = await leadTracker.getFollowUps(params, userId);
      const text = getPrimaryText(result);
      const count = extractCountFromText(text);
      const nextFollowUp = extractFirstFollowUp(text);

      if (nextFollowUp) {
        captureActivityContext(userId, {
          followUpId: nextFollowUp.followUpId,
          prospectId: nextFollowUp.prospectId,
          prospectName: nextFollowUp.prospectName,
          followUp: nextFollowUp.dueDate,
        });
      }

      const voice = buildVoiceSummary(
        describeFollowUpSummary(count, params.time_range),
        nextFollowUp ? `Say "Log a call with ${nextFollowUp.prospectName}" when you're ready.` : undefined,
      );

      return attachVoiceMetadata(result, voice);
    }

    case 'stats': {
      const result = await leadTracker.getPipelineStats(params, userId);
      const text = getPrimaryText(result);
      const headline = extractHeadlineLine(text) || 'Pipeline stats ready';

      const voice = buildVoiceSummary(headline, 'Say "Email me the full report" for more detail.');

      return attachVoiceMetadata(result, voice);
    }

    case 'next_actions': {
      const result = await leadTracker.getNextActions(params, userId);
      const recommendations = Array.isArray((result as any)?.data?.recommendations)
        ? (result as any).data.recommendations
        : [];
      const top = recommendations[0] as any;
      const topReason = Array.isArray(top?.reasons) && top.reasons.length ? top.reasons[0] : undefined;
      const duePhrase = typeof top?.nextFollowUp === 'string'
        ? describeDueForVoice(top.nextFollowUp)
        : undefined;
      const summary = top
        ? `${top.companyName ?? 'Next deal'} ${top.priorityLabel === 'urgent' ? 'needs attention now' : 'is next'}`
        : 'No priority follow-ups right now.';
      const detail = topReason || duePhrase;
      const hint = top?.suggestedAction ?? 'Say "Show follow-ups" to double-check the list.';
      const voice = buildVoiceSummary(
        detail ? `${summary} — ${detail}` : summary,
        hint,
      );

      return attachVoiceMetadata(result, voice);
    }

    case 'win_loss_report': {
      const result = await leadTracker.getWinLossReport(params, userId);
      const totals = (result as any)?.data?.totals;
      const insights = Array.isArray((result as any)?.data?.insights) ? (result as any).data.insights : [];
      const winCount = typeof totals?.wins === 'number' ? totals.wins : 0;
      const lossCount = typeof totals?.losses === 'number' ? totals.losses : 0;
      const winRate = typeof totals?.winRate === 'number' ? Math.round(totals.winRate) : null;
      const summaryParts: string[] = [];
      summaryParts.push(`${winCount} won${lossCount ? `, ${lossCount} lost` : ''}`);
      if (winRate !== null) {
        summaryParts.push(`${winRate}% win rate`);
      }
      const summary = summaryParts.length ? summaryParts.join(' — ') : 'No closed deals in this window.';
      const hint = insights[0] ?? 'Need next moves? Ask for next actions.';
      const voice = buildVoiceSummary(summary, hint);

      return attachVoiceMetadata(result, voice);
    }

    case 'import':
      return await leadTracker.importProspects(params, userId);

    default:
      throw new ToolNotFoundError(action, 'lead-tracker');
  }
}

/**
 * Route to EmailOrchestrator module
 */
async function routeToEmailOrchestrator(
  action: string,
  params: any,
  userId: string
): Promise<any> {
  switch (action) {
    case 'create_campaign':
      return await emailOrchestrator.createCampaign(params, userId);

    case 'create_template':
      return await emailOrchestrator.createTemplate(params, userId);

    case 'add_sequence':
      return await emailOrchestrator.addEmailSequence(params, userId);

    case 'create_and_start_sequence': {
      const result = await emailOrchestrator.createAndStartSequence(params, userId);
      const voice = buildVoiceSummary(
        params.auto_start === false
          ? `Campaign ${params.name ?? 'draft'} is ready to launch`
          : `Campaign ${params.name ?? 'campaign'} is live`,
        'Say "Show campaign stats" to monitor performance.',
      );

      return attachVoiceMetadata(result, voice);
    }

    case 'start':
      return await emailOrchestrator.startCampaign(params, userId);

    case 'send_one':
      return await emailOrchestrator.sendEmail(params, userId);

    case 'stats':
      return await emailOrchestrator.getCampaignStats(params, userId);

    case 'pause':
      return await emailOrchestrator.pauseResumeCampaign(params, userId);

    case 'history':
      return await emailOrchestrator.getEmailHistory(params, userId);

    case 'unsubscribe':
      return await emailOrchestrator.manageUnsubscribes(params, userId);

    default:
      throw new ToolNotFoundError(action, 'email-orchestrator');
  }
}

/**
 * Handle vpa_status requests
 */
async function handleStatusRequest(
  params: any,
  userId: string
): Promise<any> {
  const reportType = params.report_type || 'modules';

  switch (reportType) {
    case 'modules':
      return await getModulesStatus(userId);

    case 'usage':
      return await getUsageStatus(userId);

    case 'subscription':
      return await getSubscriptionStatus(userId);

    case 'health':
      return await getSystemHealth(userId);

    case 'daily_brief':
      return await getDailyBriefReport(userId);

    default:
      return await getModulesStatus(userId); // Default to modules
  }
}

/**
 * Get modules status
 */
async function getModulesStatus(userId: string): Promise<any> {
  const modules = await getEnabledModulesWithInfo(userId);
  const subscription = await getSubscriptionInfo(userId);
  const runtime = loadRuntimeConfig();

  return {
    status: 'success',
    subscription: {
      plan: subscription.planName,
      status: subscription.status,
      periodEnd: subscription.currentPeriodEnd,
      daysRemaining: subscription.daysRemaining
    },
    runtime: {
      defaultMode: runtime.defaultMode,
      failoverEnabled: runtime.failoverEnabled,
      adapterPriority: runtime.adapterPriority
    },
    modules: modules.map(mod => ({
      id: mod.id,
      name: mod.name,
      enabled: mod.enabled,
      version: mod.version
    }))
  };
}

/**
 * Get usage status
 */
async function getUsageStatus(userId: string): Promise<any> {
  const stats = await getUserUsageStats(userId);

  return {
    status: 'success',
    period: 'Last 30 days',
    usage: {
      totalCalls: stats.totalCalls,
      successfulCalls: stats.successfulCalls,
      failedCalls: stats.failedCalls,
      byModule: stats.byModule,
      byTool: stats.byTool
    }
  };
}

/**
 * Get subscription status
 */
async function getSubscriptionStatus(userId: string): Promise<any> {
  const subscription = await getSubscriptionInfo(userId);

  return {
    status: 'success',
    subscription: {
      planName: subscription.planName,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      daysRemaining: subscription.daysRemaining,
      enabledModules: subscription.modules
    }
  };
}

/**
 * Get system health
 */
async function getSystemHealth(userId: string): Promise<any> {
  // Simple health check for now
  return {
    status: 'healthy',
    vpaCore: 'operational',
    database: 'connected',
    modules: 'available',
    timestamp: new Date().toISOString()
  };
}

/**
 * Handle vpa_configure requests
 */
async function handleConfigureRequest(
  params: any,
  userId: string
): Promise<any> {
  // TODO: Implement configuration management
  // For now, return stub
  logger.info('VPA configure request', { userId, params });

  return {
    status: 'success',
    message: 'Configuration stub - implementation pending',
    setting: params.setting,
    value: params.value
  };
}

/**
 * Handle vpa_metrics requests
 */
async function handleMetricsRequest(
  params: any,
  userId: string
): Promise<any> {
  const timeframe = params.timeframe || '30d';

  logger.info('VPA metrics dashboard request', { userId, timeframe });

  const dashboard = await metrics.getDashboard({ userId, timeframe });

  // Build formatted text output
  const lines: string[] = ['📊 **Metrics Dashboard**', '', `Period: ${formatTimeframe(timeframe)}`, ''];

  // Business metrics
  lines.push('💰 **Business**');
  lines.push(`Revenue: $${formatNumber(dashboard.business.revenue)}`);
  lines.push(`Expenses: $${formatNumber(dashboard.business.expenses)}`);
  lines.push(`Profit: $${formatNumber(dashboard.business.profit)} (${dashboard.business.profitMargin}% margin)`);
  lines.push('');

  // Pipeline metrics
  lines.push('📈 **Pipeline**');
  lines.push(`Active prospects: ${dashboard.pipeline.activeProspects}`);
  lines.push(`Deals won: ${dashboard.pipeline.dealsWon}`);
  lines.push(`Deals lost: ${dashboard.pipeline.dealsLost}`);
  lines.push(`Win rate: ${dashboard.pipeline.winRate}%`);
  lines.push('');

  // Productivity metrics
  lines.push('⚡ **Productivity**');
  lines.push(`Billable hours: ${formatNumber(dashboard.productivity.billableHours)}`);
  lines.push(`Non-billable hours: ${formatNumber(dashboard.productivity.nonBillableHours)}`);
  lines.push(`Utilization rate: ${dashboard.productivity.utilizationRate}%`);
  lines.push('');

  // Reputation metrics
  lines.push('⭐ **Reputation**');
  lines.push(`Testimonials: ${dashboard.reputation.testimonials}`);
  lines.push(`Public reviews: ${dashboard.reputation.publicReviews}`);
  lines.push(`Average rating: ${dashboard.reputation.avgRating}/5.0`);
  lines.push('');

  // Anomalies
  if (dashboard.anomalies.length > 0) {
    lines.push('⚠️ **Anomalies Detected**');
    dashboard.anomalies.forEach((anomaly, index) => {
      const icon = anomaly.severity === 'critical' ? '🔴' : '🟡';
      lines.push(`${index + 1}. ${icon} ${anomaly.metric}: ${anomaly.change}`);
      lines.push(`   ${anomaly.recommendation}`);
    });
    lines.push('');
  }

  const text = lines.join('\n');

  // Build voice summary
  const hasAnomalies = dashboard.anomalies.length > 0;
  const winRate = dashboard.pipeline.winRate;
  const activeProspects = dashboard.pipeline.activeProspects;

  const summary = hasAnomalies
    ? `${dashboard.anomalies.length} anomalies detected. ${dashboard.anomalies[0].metric} ${dashboard.anomalies[0].change}.`
    : `${activeProspects} active prospects with ${winRate}% win rate.`;

  const hint = hasAnomalies
    ? dashboard.anomalies[0].recommendation
    : 'Say "Show follow-ups" to dive into your pipeline.';

  const voice = buildVoiceSummary(summary, hint);

  // Return both structured JSON (for programmatic access) and formatted text (for display)
  return attachVoiceMetadata({
    content: [
      {
        type: 'text',
        text: JSON.stringify(dashboard, null, 2)
      },
      {
        type: 'text',
        text: '\n' + text
      }
    ]
  }, voice);
}

/**
 * Format timeframe for display
 */
function formatTimeframe(timeframe: string): string {
  switch (timeframe) {
    case '7d':
      return 'Last 7 days';
    case '30d':
      return 'Last 30 days';
    case '90d':
      return 'Last 90 days';
    case '1y':
      return 'Last year';
    default:
      return 'Last 30 days';
  }
}

/**
 * Format number with commas
 */
function formatNumber(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

async function handleModulesRequest(
  _params: any,
  userId: string
): Promise<any> {
  const catalog = await buildModuleCatalog(userId);
  const sorted = [...catalog.modules].sort((a, b) => Number(b.enabled) - Number(a.enabled));

  const lines: string[] = ['📦 **Module Catalog**', '', `Plan: ${catalog.planName}`, `Enabled: ${catalog.enabledCount} • Locked: ${catalog.lockedCount}`, ''];

  sorted.forEach((module) => {
    lines.push(`${module.icon} **${module.name}** — ${module.tagline}`);
    lines.push(`Status: ${module.enabled ? 'Enabled' : `Locked (${module.pricingTier})`}`);

    if (module.valueProps.length) {
      const highlights = module.valueProps.slice(0, 2).join('; ');
      lines.push(`Highlights: ${highlights}`);
    }

    if (module.quickActions.length) {
      lines.push('Quick actions:');
      module.quickActions.forEach((action) => {
        const badge = action.locked ? '🔒' : '⚡';
        lines.push(`- ${badge} ${action.label}: ${action.description}`);
        lines.push(`  Try saying: "${action.examplePrompt}"`);
      });
    }

    lines.push('');
  });

  const enabledModules = sorted.filter((module) => module.enabled).map((module) => module.name);
  const lockedModules = sorted.filter((module) => !module.enabled).map((module) => module.name);
  const voiceHeadline = lockedModules.length
    ? `${enabledModules.length} module${enabledModules.length === 1 ? '' : 's'} ready: ${enabledModules.join(', ')}. ${lockedModules.length} locked: ${lockedModules.join(', ')}`
    : `All ${enabledModules.length} module${enabledModules.length === 1 ? '' : 's'} ready to run.`;

  const actionHint = sorted.find((module) => module.enabled && module.quickActions.some((action) => !action.locked))?.quickActions.find((action) => !action.locked)?.examplePrompt;
  const voice = buildVoiceSummary(voiceHeadline, actionHint ? `Say "${actionHint}" to jump in.` : undefined);

  return attachVoiceMetadata({
    content: [
      {
        type: 'text',
        text: lines.join('\n')
      }
    ]
  }, voice);
}

async function getDailyBriefReport(userId: string): Promise<any> {
  const [followUpsResult, countsResult, newProspectsResult, pipelineResult] = await Promise.all([
    db.query(
      `SELECT f.id,
              f.due_date,
              f.reminder_type,
              COALESCE(f.reminder_note, '') AS reminder_note,
              p.id AS prospect_id,
              p.company_name
       FROM follow_ups f
       JOIN prospects p ON p.id = f.prospect_id
       WHERE p.user_id = $1
         AND f.completed = FALSE
         AND f.due_date::date = CURRENT_DATE
       ORDER BY f.due_date ASC
       LIMIT 3`,
      [userId]
    ),
    db.query(
      `SELECT
         SUM(CASE WHEN f.due_date::date = CURRENT_DATE THEN 1 ELSE 0 END) AS today_count,
         SUM(CASE WHEN f.due_date < NOW() THEN 1 ELSE 0 END) AS overdue_count
       FROM follow_ups f
       JOIN prospects p ON p.id = f.prospect_id
       WHERE p.user_id = $1
         AND f.completed = FALSE`,
      [userId]
    ),
    db.query(
      `SELECT id, company_name, status, created_at
       FROM prospects
       WHERE user_id = $1
         AND created_at >= NOW() - INTERVAL '1 day'
       ORDER BY created_at DESC
       LIMIT 3`,
      [userId]
    ),
    db.query(
      `SELECT status, COUNT(*)::int AS count
       FROM prospects
       WHERE user_id = $1
       GROUP BY status`,
      [userId]
    ),
  ]);

  const followUpsToday = followUpsResult.rows as Array<{
    id: string;
    due_date: string;
    reminder_type: string | null;
    reminder_note: string | null;
    prospect_id: string;
    company_name: string;
  }>;

  const countsRow = countsResult.rows[0] as { today_count: string | number | null; overdue_count: string | number | null } | undefined;
  const todayCount = countsRow ? Number(countsRow.today_count ?? 0) : 0;
  const overdueCount = countsRow ? Number(countsRow.overdue_count ?? 0) : 0;

  const newProspects = newProspectsResult.rows as Array<{
    id: string;
    company_name: string;
    status: string;
    created_at: string;
  }>;

  const pipelineCounts = (pipelineResult.rows as Array<{ status: string; count: number }>).sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
  );

  const lines: string[] = ['🌅 **Daily Brief**', ''];

  lines.push(`Follow-ups today: ${todayCount} (overdue: ${overdueCount})`);

  if (followUpsToday.length) {
    lines.push('');
    lines.push('Today\'s follow-ups:');
    followUpsToday.forEach((item, index) => {
      const timeText = formatTimeForText(item.due_date);
      const typeLabel = item.reminder_type ? item.reminder_type.replace('_', ' ') : 'follow-up';
      const noteSegment = item.reminder_note ? ` — ${item.reminder_note}` : '';
      lines.push(`${index + 1}. ${item.company_name} at ${timeText} (${typeLabel})${noteSegment}`);
    });
  } else {
    lines.push('');
    lines.push('No follow-ups scheduled for today.');
  }

  if (newProspects.length) {
    lines.push('');
    lines.push('New prospects in the last 24 hours:');
    newProspects.forEach((prospect) => {
      lines.push(`- ${prospect.company_name} (${formatStatusLabel(prospect.status)})`);
    });
  }

  if (pipelineCounts.length) {
    const snapshot = pipelineCounts
      .slice(0, 5)
      .map((row) => `${formatStatusLabel(row.status)}: ${row.count}`)
      .join(', ');
    lines.push('');
    lines.push(`Pipeline snapshot: ${snapshot}`);
  }

  const text = lines.join('\n');

  const firstFollowUp = followUpsToday[0];
  const voiceSummary = firstFollowUp
    ? `You have ${todayCount} follow-up${todayCount === 1 ? '' : 's'} today. First is ${firstFollowUp.company_name} at ${formatTimeForVoice(firstFollowUp.due_date)}.`
    : todayCount > 0
      ? `You have ${todayCount} follow-up${todayCount === 1 ? '' : 's'} today.`
      : overdueCount > 0
        ? `No follow-ups scheduled today, but ${overdueCount} overdue.`
        : 'No follow-ups scheduled today.';

  const followUpHint = firstFollowUp ? `Say "Call ${firstFollowUp.company_name}" when you\'re ready.` : undefined;

  const voice = buildVoiceSummary(voiceSummary, followUpHint);

  return attachVoiceMetadata({
    content: [
      {
        type: 'text',
        text,
      },
    ],
  }, voice);
}

function getPrimaryText(result: any): string {
  if (!result || !Array.isArray(result.content)) {
    return '';
  }

  const textItem = result.content.find((item: any) => item?.type === 'text' && typeof item.text === 'string');
  return textItem?.text ?? '';
}

function extractCountFromText(text: string): number | undefined {
  const match = text.match(/Found\s+(\d+)\s+(prospect|follow-up|followups|companies)/i);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

function extractIdsFromText(text: string, limit = 10): string[] {
  const matches = text.match(/ID:\s*([0-9a-fA-F-]{10,})/g) || [];
  return matches
    .map((line) => {
      const inner = line.match(/ID:\s*([0-9a-fA-F-]{10,})/i);
      return inner ? inner[1] : undefined;
    })
    .filter((value): value is string => Boolean(value))
    .slice(0, limit);
}

function buildProspectQuerySummary(params: any, count?: number): string {
  const parts: string[] = [];
  if (params.industry) {
    parts.push(params.industry);
  }
  parts.push('prospects');
  if (params.location) {
    parts.push(`in ${params.location}`);
  }
  const base = parts.join(' ');
  return count !== undefined ? `${count} ${base}` : base;
}

const TASK_DAY_MS = 86_400_000;

function priorityVoice(level?: string): string | undefined {
  switch (level) {
    case 'urgent':
      return 'urgent priority';
    case 'high':
      return 'high priority';
    case 'medium':
      return 'medium priority';
    case 'low':
      return 'low priority';
    default:
      return undefined;
  }
}

function describeDueForVoice(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  const today = startOfDayMs(new Date());
  const target = startOfDayMs(date);
  const diffDays = Math.round((target - today) / TASK_DAY_MS);

  if (diffDays === 0) {
    return 'due today';
  }
  if (diffDays === 1) {
    return 'due tomorrow';
  }
  if (diffDays === -1) {
    return 'overdue by 1 day';
  }
  if (diffDays < -1) {
    return `overdue by ${Math.abs(diffDays)} days`;
  }
  if (diffDays <= 7) {
    return `due in ${diffDays} days`;
  }

  return `due ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

function startOfDayMs(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function pluralize(count: number, singular: string, pluralForm?: string): string {
  const word = count === 1 ? singular : (pluralForm ?? `${singular}s`);
  return `${count} ${word}`;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function extractFirstMatch(text: string, pattern: RegExp): string | undefined {
  const match = text.match(pattern);
  return match ? match[1].trim() : undefined;
}

function extractLineValue(text: string, label: string): string | undefined {
  const regex = new RegExp(`${label}\s*:\s*(.+)`, 'i');
  const match = text.match(regex);
  if (!match) {
    return undefined;
  }

  return match[1].split('\n')[0].trim();
}

function extractStatusFromText(text: string): string | undefined {
  const status = extractLineValue(text, 'Status');
  if (status) {
    return status;
  }

  const moved = text.match(/moved to\s+([a-z_]+)/i);
  return moved ? moved[1].replace(/_/g, ' ') : undefined;
}

function extractFollowUpDate(text: string): string | undefined {
  const explicit = text.match(/Follow-up reminder set for:\s*(.+)/i);
  if (explicit) {
    return explicit[1].split('\n')[0].trim();
  }

  const dueLine = text.match(/Due:\s*(.+)/i);
  return dueLine ? dueLine[1].split('\n')[0].trim() : undefined;
}

interface FollowUpSummary {
  followUpId?: string;
  prospectId?: string;
  prospectName?: string;
  dueDate?: string;
}

function extractFirstFollowUp(text: string): FollowUpSummary | undefined {
  const blocks = text.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);

  for (const block of blocks) {
    if (!block.includes('Follow-up ID')) {
      continue;
    }

    const prospectMatch = block.match(/\*\*(.+?)\*\*/);
    const followUpId = extractFirstMatch(block, /Follow-up ID:\s*([0-9a-fA-F-]{10,})/i);
    const prospectId = extractFirstMatch(block, /Prospect ID:\s*([0-9a-fA-F-]{10,})/i);
    const dueDate = extractFirstMatch(block, /Due:\s*(.+)/i);

    return {
      followUpId,
      prospectId,
      prospectName: prospectMatch ? prospectMatch[1].trim() : undefined,
      dueDate,
    };
  }

  return undefined;
}

function describeFollowUpSummary(count: number | undefined, timeRange: string | undefined): string {
  const labelMap: Record<string, string> = {
    today: 'due today',
    this_week: 'due this week',
    next_week: 'due next week',
    overdue: 'overdue',
    all: 'pending',
  };

  const label = timeRange ? labelMap[timeRange] || 'queued' : 'queued';

  if (count === undefined) {
    return `Follow-up list ready (${label}).`;
  }

  if (count === 0) {
    return `No follow-ups ${label}.`;
  }

  return `${count} follow-up${count === 1 ? '' : 's'} ${label}.`;
}

function extractHeadlineLine(text: string): string | undefined {
  const firstLine = text.split('\n').map((line) => line.trim()).find((line) => line.length > 0);
  return firstLine || undefined;
}

function formatTimeForText(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTimeForVoice(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

// Test helpers (no runtime impact)
export function __setResearchInsightsModule(mock: ResearchInsightsModule): void {
  researchInsights = mock;
}

export function __resetResearchInsightsModule(): void {
  researchInsights = new ResearchInsightsModule();
}
