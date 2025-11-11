/**
 * Keyword-Based Intent Parser
 *
 * Fast, free intent parsing using keyword pattern matching.
 * Handles ~80% of common user commands without API costs.
 * Falls back to LLM parser for complex queries.
 */

export interface ParsedIntent {
  tool: string; // 'vpa_prospects', 'vpa_pipeline', 'vpa_email', 'vpa_status', 'vpa_configure', 'vpa_modules'
  action: string; // Action to perform within the tool
  parameters: Record<string, any>;
  confidence: number; // 0.0 - 1.0
}

/**
 * Main keyword parser function
 */
export function keywordParser(command: string): ParsedIntent | null {
  const lower = command.toLowerCase().trim();

  // Try each category of patterns
  const parsers = [
    parseProspectCommands,
    parsePipelineCommands,
    parseTaskCommands,
    parseEmailCommands,
    parseResearchCommands,
    parseModuleCommands,
    parseStatusCommands,
    parseConfigCommands
  ];

  for (const parser of parsers) {
    const result = parser(lower, command);
    if (result && result.confidence > 0.7) {
      return result;
    }
  }

  // No confident match
  return null;
}

function parseResearchCommands(lower: string, original: string): ParsedIntent | null {
  const urlMatch = original.match(/(https?:\/\/[^\s]+|www\.[^\s]+|[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?)/i);

  if (
    (lower.includes('add') || lower.includes('track')) &&
    (lower.includes('competitor') || lower.includes('source') || lower.includes('feed') || lower.includes('site')) &&
    urlMatch
  ) {
    const urlRaw = urlMatch[0].trim();
    const sanitizedUrl = urlRaw.startsWith('http') ? urlRaw : `https://${urlRaw}`;

    const prefix = original.slice(0, urlMatch.index ?? 0);
    const label = prefix
      .replace(/^(please\s+)?(add|track|monitor)\s+/i, '')
      .replace(/\b(a|an|new)\s+/i, '')
      .replace(/\b(competitor|source|feed|site|url)s?\b/gi, '')
      .replace(/\b(at|from)\s*$/i, '')
      .trim();

    const computedLabel = label.length ? label : deriveLabelFromUrl(sanitizedUrl);

    if (computedLabel) {
      return {
        tool: 'vpa_research',
        action: 'add_source',
        parameters: {
          label: computedLabel,
          url: sanitizedUrl
        },
        confidence: 0.92
      };
    }
  }

  const wantsMonitor =
    lower.includes('monitor') ||
    lower.includes('scan') ||
    lower.includes('check updates') ||
    lower.includes('watch');

  if (wantsMonitor && (lower.includes('competitor') || lower.includes('market') || lower.includes('industry') || lower.includes('news'))) {
    const force = lower.includes('force') || lower.includes('anyway') || lower.includes('even if');
    return {
      tool: 'vpa_research',
      action: 'monitor',
      parameters: force ? { force: true } : {},
      confidence: 0.9
    };
  }

  if (
    (lower.includes('daily') || lower.includes('market') || lower.includes('industry') || lower.includes('competitor')) &&
    (lower.includes('digest') || lower.includes('brief') || lower.includes('summary'))
  ) {
    const numberMatch = original.match(/(top|first)?\s*(\d{1,2})/i);
    const limit = numberMatch ? Number.parseInt(numberMatch[2], 10) : undefined;

    return {
      tool: 'vpa_research',
      action: 'digest',
      parameters: limit ? { limit } : {},
      confidence: 0.88
    };
  }

  if (
    (lower.includes('list') || lower.includes('show') || lower.includes('what are')) &&
    (lower.includes('sources') || lower.includes('watchlist') || lower.includes('tracked'))
  ) {
    return {
      tool: 'vpa_research',
      action: 'list_sources',
      parameters: {},
      confidence: 0.87
    };
  }

  return null;
}

function deriveLabelFromUrl(url: string): string {
  try {
    const withProtocol = url.startsWith('http') ? url : `https://${url}`;
    const parsed = new URL(withProtocol);
    const host = parsed.hostname.replace(/^www\./i, '');
    return host.split('.')[0] || host;
  } catch (_error) {
    return url;
  }
}

function parseModuleCommands(lower: string, _original: string): ParsedIntent | null {
  if (
    lower.includes('modules') ||
    lower.includes('catalog') ||
    lower.includes('capabilities') ||
    lower.includes('what can you do') ||
    lower.includes('what are your tools')
  ) {
    return {
      tool: 'vpa_modules',
      action: 'list',
      parameters: {},
      confidence: 0.95
    };
  }

  return null;
}

/**
 * Parse prospect-finding commands
 */
function parseProspectCommands(lower: string, original: string): ParsedIntent | null {
  // Search for companies/prospects
  if (
    (lower.includes('find') || lower.includes('search') || lower.includes('get')) &&
    (lower.includes('companies') || lower.includes('prospects') || lower.includes('businesses'))
  ) {
    return {
      tool: 'vpa_prospects',
      action: 'search',
      parameters: extractSearchParams(original),
      confidence: 0.95
    };
  }

  // Find decision makers / contacts
  if (
    (lower.includes('find') || lower.includes('get')) &&
    (lower.includes('decision maker') || lower.includes('contact') || lower.includes('people') || lower.includes('employees'))
  ) {
    return {
      tool: 'vpa_prospects',
      action: 'find_contacts',
      parameters: {},
      confidence: 0.92
    };
  }

  // Enrich company
  if (lower.includes('enrich') && (lower.includes('company') || lower.includes('companies'))) {
    return {
      tool: 'vpa_prospects',
      action: 'enrich',
      parameters: {},
      confidence: 0.90
    };
  }

  // Export prospects
  if (lower.includes('export') && lower.includes('prospect')) {
    return {
      tool: 'vpa_prospects',
      action: 'export',
      parameters: {},
      confidence: 0.93
    };
  }

  // Scraping stats
  if (lower.includes('scraping') && (lower.includes('stats') || lower.includes('statistics'))) {
    return {
      tool: 'vpa_prospects',
      action: 'stats',
      parameters: {},
      confidence: 0.94
    };
  }

  return null;
}

/**
 * Parse pipeline/CRM commands
 */
function parsePipelineCommands(lower: string, original: string): ParsedIntent | null {
  // Add to pipeline/CRM
  if (
    (lower.includes('add to') && (lower.includes('pipeline') || lower.includes('crm'))) ||
    lower.includes('import to pipeline')
  ) {
    return {
      tool: 'vpa_pipeline',
      action: 'import',
      parameters: {},
      confidence: 0.94
    };
  }

  // Add prospect
  if (lower.includes('add') && lower.includes('prospect')) {
    return {
      tool: 'vpa_pipeline',
      action: 'add',
      parameters: {},
      confidence: 0.90
    };
  }

  // Update status
  if (
    (lower.includes('update') || lower.includes('change') || lower.includes('move')) &&
    (lower.includes('status') || lower.includes('stage'))
  ) {
    return {
      tool: 'vpa_pipeline',
      action: 'update',
      parameters: extractStatusUpdate(original),
      confidence: 0.91
    };
  }

  // Log activity/call/email
  if (lower.includes('log') && (lower.includes('call') || lower.includes('activity') || lower.includes('note'))) {
    return {
      tool: 'vpa_pipeline',
      action: 'log_activity',
      parameters: extractActivityParams(original),
      confidence: 0.93
    };
  }

  // Search prospects
  if (lower.includes('search') && lower.includes('prospect')) {
    return {
      tool: 'vpa_pipeline',
      action: 'search',
      parameters: {},
      confidence: 0.88
    };
  }

  // Get follow-ups
  if (lower.includes('follow') && lower.includes('up')) {
    return {
      tool: 'vpa_pipeline',
      action: 'follow_ups',
      parameters: {},
      confidence: 0.95
    };
  }

  // Pipeline stats
  if (lower.includes('pipeline') && (lower.includes('stats') || lower.includes('statistics') || lower.includes('summary'))) {
    return {
      tool: 'vpa_pipeline',
      action: 'stats',
      parameters: {},
      confidence: 0.94
    };
  }

  return null;
}

function parseTaskCommands(lower: string, original: string): ParsedIntent | null {
  const mentionsTask =
    lower.includes('task') ||
    lower.includes('tasks') ||
    lower.includes('todo') ||
    lower.includes('to-do') ||
    lower.includes('focus list') ||
    lower.includes('priority list');

  const wantsFocus =
    lower.includes('focus list') ||
    (lower.includes('focus') && mentionsTask) ||
    lower.includes('what should i focus') ||
    lower.includes('what should i work on') ||
    lower.includes('prioritize') ||
    lower.includes('priorities') ||
    lower.includes('what to do next') ||
    lower.includes('what do i do next') ||
    lower.includes('what next') ||
    lower.includes("what's next");

  if (wantsFocus) {
    return {
      tool: 'vpa_tasks',
      action: 'focus',
      parameters: {},
      confidence: 0.9,
    };
  }

  if (
    mentionsTask &&
    (lower.includes('add') || lower.includes('create') || lower.includes('capture') || lower.includes('new task') || lower.includes('log task'))
  ) {
    return {
      tool: 'vpa_tasks',
      action: 'add',
      parameters: {},
      confidence: 0.9,
    };
  }

  if (mentionsTask && (lower.includes('update') || lower.includes('edit') || lower.includes('change'))) {
    return {
      tool: 'vpa_tasks',
      action: 'update',
      parameters: {},
      confidence: 0.88,
    };
  }

  if (
    mentionsTask &&
    (lower.includes('complete') ||
      lower.includes('mark done') ||
      (lower.includes('mark') && lower.includes('done')) ||
      lower.includes('finish task') ||
      lower.includes('task finished'))
  ) {
    return {
      tool: 'vpa_tasks',
      action: 'complete',
      parameters: {},
      confidence: 0.9,
    };
  }

  if (mentionsTask && (lower.includes('delete') || lower.includes('remove') || lower.includes('clear task'))) {
    return {
      tool: 'vpa_tasks',
      action: 'delete',
      parameters: {},
      confidence: 0.88,
    };
  }

  const wantsReport =
    mentionsTask &&
    (lower.includes('progress') || lower.includes('report') || lower.includes('summary') || lower.includes('recap'));

  if (wantsReport) {
    return {
      tool: 'vpa_tasks',
      action: 'report',
      parameters: {},
      confidence: 0.87,
    };
  }

  const wantsRecommendations =
    (mentionsTask && (lower.includes('recommend') || lower.includes('next best') || lower.includes('next action'))) ||
    lower.includes('what should i do next');

  if (wantsRecommendations) {
    return {
      tool: 'vpa_tasks',
      action: 'recommendations',
      parameters: {},
      confidence: 0.86,
    };
  }

  return null;
}

/**
 * Parse email commands
 */
function parseEmailCommands(lower: string, original: string): ParsedIntent | null {
  // Create campaign
  if (lower.includes('create') && lower.includes('campaign')) {
    return {
      tool: 'vpa_email',
      action: 'create_campaign',
      parameters: {},
      confidence: 0.92
    };
  }

  // Add email sequence
  if (lower.includes('add') && lower.includes('sequence')) {
    return {
      tool: 'vpa_email',
      action: 'add_sequence',
      parameters: {},
      confidence: 0.91
    };
  }

  // Start campaign
  if (lower.includes('start') && lower.includes('campaign')) {
    return {
      tool: 'vpa_email',
      action: 'start',
      parameters: {},
      confidence: 0.93
    };
  }

  // Send email
  if (lower.includes('send') && lower.includes('email')) {
    return {
      tool: 'vpa_email',
      action: 'send_one',
      parameters: {},
      confidence: 0.89
    };
  }

  // Campaign stats
  if (lower.includes('campaign') && (lower.includes('stats') || lower.includes('performance'))) {
    return {
      tool: 'vpa_email',
      action: 'stats',
      parameters: {},
      confidence: 0.90
    };
  }

  // Pause/resume campaign
  if ((lower.includes('pause') || lower.includes('resume') || lower.includes('stop')) && lower.includes('campaign')) {
    return {
      tool: 'vpa_email',
      action: 'pause',
      parameters: {},
      confidence: 0.92
    };
  }

  return null;
}

/**
 * Parse status/info commands
 */
function parseStatusCommands(lower: string, original: string): ParsedIntent | null {
  // VPA status
  if (
    lower.includes('vpa') && (lower.includes('status') || lower.includes('info')) ||
    lower.includes('check status') ||
    lower.includes('my modules') ||
    lower.includes('my subscription')
  ) {
    let reportType = 'modules';
    if (lower.includes('usage')) reportType = 'usage';
    if (lower.includes('subscription')) reportType = 'subscription';
    if (lower.includes('health')) reportType = 'health';

    return {
      tool: 'vpa_status',
      action: reportType,
      parameters: { report_type: reportType },
      confidence: 0.96
    };
  }

  return null;
}

/**
 * Parse configuration commands
 */
function parseConfigCommands(lower: string, original: string): ParsedIntent | null {
  // Configure/set settings
  if (
    (lower.includes('configure') || lower.includes('set') || lower.includes('change')) &&
    (lower.includes('setting') || lower.includes('preference') || lower.includes('config'))
  ) {
    return {
      tool: 'vpa_configure',
      action: 'set',
      parameters: {},
      confidence: 0.85
    };
  }

  return null;
}

/**
 * Extract search parameters from command
 */
function extractSearchParams(command: string): Record<string, any> {
  const params: Record<string, any> = {};

  // Extract industry
  const industries = [
    'hvac', 'plumbing', 'electrical', 'roofing', 'construction',
    'landscaping', 'pool', 'pest control', 'cleaning', 'moving',
    'law', 'dental', 'medical', 'insurance', 'real estate'
  ];

  const commandLower = command.toLowerCase();
  for (const industry of industries) {
    if (commandLower.includes(industry)) {
      params.industry = industry;
      break;
    }
  }

  // Extract location (simple pattern matching)
  const locationPatterns = [
    /\bin ([A-Z][a-z]+(?:,?\s+[A-Z]{2})?)\b/,  // in Dallas, TX
    /\b([A-Z][a-z]+,\s+[A-Z]{2})\b/,            // Dallas, TX
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/      // Dallas or New York
  ];

  for (const pattern of locationPatterns) {
    const match = command.match(pattern);
    if (match) {
      params.location = match[1];
      break;
    }
  }

  // Extract number
  const numberMatch = command.match(/(\d+)/);
  if (numberMatch) {
    params.max_results = parseInt(numberMatch[1]);
  }

  return params;
}

/**
 * Extract status update parameters
 */
function extractStatusUpdate(command: string): Record<string, any> {
  const params: Record<string, any> = {};

  const commandLower = command.toLowerCase();

  // Extract status keywords
  const statuses = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
  for (const status of statuses) {
    if (commandLower.includes(status)) {
      params.status = status;
      break;
    }
  }

  return params;
}

/**
 * Extract activity logging parameters
 */
function extractActivityParams(command: string): Record<string, any> {
  const params: Record<string, any> = {};

  const commandLower = command.toLowerCase();

  // Detect activity type
  if (commandLower.includes('call')) {
    params.activity_type = 'call';
  } else if (commandLower.includes('email')) {
    params.activity_type = 'email';
  } else if (commandLower.includes('meeting')) {
    params.activity_type = 'meeting';
  } else {
    params.activity_type = 'note';
  }

  // Detect outcome (for calls)
  if (commandLower.includes('answered') || commandLower.includes('talked to')) {
    params.outcome = 'answered';
  } else if (commandLower.includes('voicemail') || commandLower.includes('left message')) {
    params.outcome = 'voicemail';
  } else if (commandLower.includes('no answer') || commandLower.includes('didn\'t answer')) {
    params.outcome = 'no_answer';
  }

  return params;
}
