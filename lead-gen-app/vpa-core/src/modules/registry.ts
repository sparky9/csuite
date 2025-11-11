/**
 * Module Registry
 *
 * Central registry of all VPA modules with their definitions, capabilities, and pricing tiers.
 * This is designed to make adding new modules TRIVIAL - just add a new entry here.
 *
 * Architecture Decision: Static registry vs. dynamic database registry
 * - Static: Module definitions are code-level configurations
 * - Dynamic enablement: Which modules a user can access is in the database (user_subscriptions.modules)
 * - This separation allows easy module deployment without database migrations
 */

export interface ModuleQuickAction {
  id: string;
  label: string;
  description: string;
  examplePrompt: string;
  tool: string;
  action: string;
  defaultParameters?: Record<string, any>;
}

export interface ModuleDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  tools: string[]; // List of tool names this module provides
  pricingTier: 'core' | 'standard' | 'premium';
  required: boolean; // Is this module required for VPA Core to function?
  icon: string;
  category: string;
  tagline: string;
  valueProps: string[];
  quickActions?: ModuleQuickAction[];
  deprecated?: boolean;
}

/**
 * Module Registry
 *
 * To add a new module:
 * 1. Add entry here with unique ID
 * 2. Define tools it provides
 * 3. Set pricing tier
 * 4. Create module wrapper in src/modules/{module-name}.module.ts
 * 5. Add routing logic in orchestrator.ts
 * 6. Update pricing.ts if needed
 */
export const MODULE_REGISTRY: Record<string, ModuleDefinition> = {
  'vpa-core': {
    id: 'vpa-core',
    name: 'VPA Core',
    description: 'Core orchestration, user management, and system configuration',
    version: '1.0.0',
  tools: ['vpa_status', 'vpa_configure', 'vpa_modules'],
    pricingTier: 'core',
    required: true,
    icon: '🧠',
    category: 'system',
    tagline: 'Command center for every solopreneur workflow',
    valueProps: [
      'Routes requests to the right module automatically',
      'Tracks usage, subscription, and voice context history',
      'Delivers daily brief summaries optimized for voice'
    ],
    quickActions: [
      {
        id: 'daily_brief',
        label: 'Daily Brief',
        description: 'Hear follow-ups, fresh deals, and pipeline snapshot',
        examplePrompt: 'Give me my daily brief',
        tool: 'vpa_status',
        action: 'daily_brief',
        defaultParameters: { report_type: 'daily_brief' }
      }
    ]
  },

  'lead-tracker': {
    id: 'lead-tracker',
    name: 'LeadTracker Pro',
    description: 'CRM pipeline management, prospect tracking, and activity logging (legacy wrapper – delegates to LeadTracker Pro MCP)',
    version: '1.0.0',
    deprecated: true,
    tools: [
      'add_prospect',
      'add_contact',
      'update_prospect_status',
      'log_activity',
      'search_prospects',
      'get_follow_ups',
      'get_pipeline_stats',
      'import_prospects'
    ],
    pricingTier: 'core', // Included in base VPA
    required: true,
    icon: '📈',
    category: 'pipeline',
    tagline: 'Know every follow-up and keep deals moving',
    valueProps: [
      'Unified CRM pipeline with status-aware voice context',
      'Fast logging for calls, meetings, and reminders',
      'Daily follow-up radar with quick rescheduling',
      'AI next-action radar and win/loss intelligence for coaching moments'
    ],
    quickActions: [
      {
        id: 'follow_ups_today',
        label: 'Today\'s follow-ups',
        description: 'Review everything due right now and what\'s overdue',
        examplePrompt: 'What follow-ups are due today?',
        tool: 'vpa_pipeline',
        action: 'follow_ups',
        defaultParameters: { time_range: 'today' }
      },
      {
        id: 'pipeline_next_actions',
        label: 'Next best actions',
        description: 'Hear which deals need attention first and why',
        examplePrompt: 'What should I tackle next in the pipeline?',
        tool: 'vpa_pipeline',
        action: 'next_actions'
      },
      {
        id: 'log_activity',
        label: 'Log an activity',
        description: 'Capture calls, emails, or meetings in seconds',
        examplePrompt: 'Log a call with Acme and remind me tomorrow',
        tool: 'vpa_pipeline',
        action: 'log_activity'
      },
      {
        id: 'reschedule_follow_up',
        label: 'Reschedule follow-up',
        description: 'Nudge the next task without digging through the CRM',
        examplePrompt: 'Move that follow-up to next Tuesday',
        tool: 'vpa_pipeline',
        action: 'update_follow_up'
      },
      {
        id: 'pipeline_win_loss',
        label: 'Win/loss recap',
        description: 'Review recent wins, losses, and slipping stages',
        examplePrompt: 'Give me a win-loss report for this quarter',
        tool: 'vpa_pipeline',
        action: 'win_loss_report',
        defaultParameters: { timeframe: 'quarter' }
      }
    ]
  },

  'task-project-manager': {
    id: 'task-project-manager',
    name: 'Task & Project Manager',
    description: 'Smart task triage, focus planning, and progress reporting',
    version: '0.1.0',
    tools: [
      'task_add',
      'task_update',
      'task_focus',
      'task_recommendations',
      'task_progress_report',
      'task_complete',
      'task_delete'
    ],
    pricingTier: 'core',
    required: true,
    icon: '✅',
    category: 'productivity',
    tagline: 'Stay ahead on every commitment with AI-prioritized focus lists',
    valueProps: [
      'Organizes tasks into Now/Next/Later lanes with automatic scoring',
      'Surfaces blockers, overdue work, and high-impact tasks instantly',
      'Generates progress reports with highlights and upcoming risks'
    ],
    quickActions: [
      {
        id: 'tasks_focus',
        label: 'Show focus list',
        description: 'See your Now/Next/Later priorities and blockers',
        examplePrompt: 'What should I focus on today?',
        tool: 'vpa_tasks',
        action: 'focus'
      },
      {
        id: 'tasks_add',
        label: 'Add a task',
        description: 'Capture a task with due date and priority context',
        examplePrompt: 'Add a follow-up with GreenTech tomorrow morning',
        tool: 'vpa_tasks',
        action: 'add'
      },
      {
        id: 'tasks_progress',
        label: 'Progress report',
        description: 'Hear what you completed and what is queued next',
        examplePrompt: 'Give me this week\'s task recap',
        tool: 'vpa_tasks',
        action: 'report',
        defaultParameters: { timeframe: 'week' }
      }
    ]
  },

  'prospect-finder': {
    id: 'prospect-finder',
    name: 'ProspectFinder',
    description: 'B2B prospect scraping, enrichment, and lead discovery',
    version: '1.0.0',
    tools: [
      'search_companies',
      'find_decision_makers',
      'enrich_company',
      'export_prospects',
      'get_scraping_stats'
    ],
    pricingTier: 'premium',
    required: false,
    icon: '🛰️',
    category: 'prospecting',
    tagline: 'Spin up fresh lead lists without spreadsheets',
    valueProps: [
      'Geo + industry search with enrichment baked in',
      'Voice-ready summaries for import decisions on the go',
      'Decision-maker discovery to keep intros warm'
    ],
    quickActions: [
      {
        id: 'search_prospects',
        label: 'Find prospects',
        description: 'Generate a fresh list in any city or vertical',
        examplePrompt: 'Find 25 roofers in Phoenix',
        tool: 'vpa_prospects',
        action: 'search'
      },
      {
        id: 'discover_contacts',
        label: 'Discover contacts',
        description: 'Pull decision makers for the latest list',
        examplePrompt: 'Grab decision makers for those HVAC companies',
        tool: 'vpa_prospects',
        action: 'find_contacts'
      }
    ]
  },

  'research-insights': {
    id: 'research-insights',
    name: 'Research & Insights',
    description: 'Competitor monitoring, industry digests, and rapid research briefs',
    version: '0.1.0',
    tools: [
      'add_source',
      'list_sources',
      'remove_source',
      'monitor',
      'digest',
      'on_demand'
    ],
    pricingTier: 'standard',
    required: false,
    icon: '📰',
    category: 'insights',
    tagline: 'Stay ahead of competitors and market shifts without digging for hours',
    valueProps: [
      'Automated captures with change detection and highlight summaries',
      'Daily digest of competitor moves and industry shifts optimized for voice',
      'On-demand research briefs using your saved sources or fresh URLs'
    ],
    quickActions: [
      {
        id: 'add_source',
        label: 'Add competitor',
        description: 'Track a new competitor, investor memo, or industry blog',
        examplePrompt: 'Add competitor StartupX at startupx.com/blog',
        tool: 'vpa_research',
        action: 'add_source'
      },
      {
        id: 'monitor_now',
        label: 'Run competitor scan',
        description: 'Capture the latest updates for every tracked source',
        examplePrompt: 'Scan my competitors for updates',
        tool: 'vpa_research',
        action: 'monitor'
      },
      {
        id: 'refresh_source',
        label: 'Refresh source details',
        description: 'Update the nickname, link, or cadence for a monitored source',
        examplePrompt: 'Rename Acme competitor to Acme Labs and update the URL',
        tool: 'vpa_research',
        action: 'update_source'
      },
      {
        id: 'daily_digest',
        label: 'Get daily digest',
        description: 'Hear what changed and why it matters',
        examplePrompt: 'Give me today\'s market digest',
        tool: 'vpa_research',
        action: 'digest',
        defaultParameters: { limit: 5 }
      },
      {
        id: 'on_demand_brief',
        label: 'On-demand brief',
        description: 'Drop in a topic or URL for a rapid summary',
        examplePrompt: 'Summarize the latest news on AI competitors',
        tool: 'vpa_research',
        action: 'on_demand'
      }
    ]
  },

  'email-orchestrator': {
    id: 'email-orchestrator',
    name: 'EmailOrchestrator',
    description: 'Email campaigns, sequences, and outreach automation',
    version: '1.0.0',
    tools: [
      'create_campaign',
      'add_email_sequence',
      'start_campaign',
      'create_template',
      'send_email',
      'get_campaign_stats',
      'pause_resume_campaign',
      'get_email_history',
      'manage_unsubscribes'
    ],
    pricingTier: 'premium',
    required: false,
    icon: '✉️',
    category: 'outreach',
    tagline: 'Ship campaigns with one sentence and keep them humming',
    valueProps: [
      'One-shot voice flow to create and launch nurture sequences',
      'Template library with analytics ready for mobile recaps',
      'Respect opt-outs and track stats without leaving the call'
    ],
    quickActions: [
      {
        id: 'quick_launch',
        label: 'Quick launch sequence',
        description: 'Draft a list, sequence, and launch in a single flow',
        examplePrompt: 'Spin up a reactivation campaign for stalled deals',
        tool: 'vpa_email',
        action: 'create_and_start_sequence'
      },
      {
        id: 'campaign_stats',
        label: 'Campaign stats',
        description: 'Hear how the latest send performed',
        examplePrompt: 'Give me the stats for the reactivation campaign',
        tool: 'vpa_email',
        action: 'stats'
      }
    ]
  }
};

/**
 * Get module definition by ID
 */
export function getModuleDefinition(moduleId: string): ModuleDefinition | undefined {
  return MODULE_REGISTRY[moduleId];
}

/**
 * Get all module IDs
 */
export function getAllModuleIds(): string[] {
  return Object.keys(MODULE_REGISTRY);
}

/**
 * Get all required modules (must be enabled for VPA to work)
 */
export function getRequiredModules(): ModuleDefinition[] {
  return Object.values(MODULE_REGISTRY).filter(mod => mod.required);
}

/**
 * Get modules by pricing tier
 */
export function getModulesByTier(tier: 'core' | 'standard' | 'premium'): ModuleDefinition[] {
  return Object.values(MODULE_REGISTRY).filter(mod => mod.pricingTier === tier);
}

/**
 * Check if a module exists
 */
export function moduleExists(moduleId: string): boolean {
  return moduleId in MODULE_REGISTRY;
}

/**
 * Get module name for display
 */
export function getModuleName(moduleId: string): string {
  return MODULE_REGISTRY[moduleId]?.name || moduleId;
}
