import { logger, logToolExecution } from '../utils/logger.js';
import { getUpcomingRenewals, getAtRiskAccounts } from '../services/renewal-service.js';
import { generatePlaybookDraft } from '../services/playbook-service.js';

export const upcomingRenewalsTool = {
  name: 'retention_get_upcoming_renewals',
  description: 'List accounts with renewals coming due within a configurable window.',
  inputSchema: {
    type: 'object',
    properties: {
      windowDays: {
        type: 'number',
        description: 'Number of days ahead to look for renewals.',
        default: 30,
      },
      limit: {
        type: 'number',
        description: 'Maximum number of accounts to return.',
        default: 20,
      },
    },
  },
};

export async function handleUpcomingRenewals(args: unknown) {
  const params = (args ?? {}) as { windowDays?: number; limit?: number };
  const windowDays = params.windowDays ?? 30;
  const limit = params.limit ?? 20;
  const safeWindowDays = Number.isFinite(windowDays) ? Math.max(Math.floor(windowDays), 1) : 30;
  const safeLimit = Number.isFinite(limit) ? Math.max(Math.floor(limit), 1) : 20;

  logToolExecution('retention_get_upcoming_renewals', { windowDays: safeWindowDays, limit: safeLimit });

  try {
    const renewals = await getUpcomingRenewals(safeWindowDays, safeLimit);

    return {
      content: [
        {
          type: 'application/json',
          data: {
            windowDays: safeWindowDays,
            limit: safeLimit,
            total: renewals.length,
            items: renewals.map((renewal) => ({
              ...renewal,
              daysUntilRenewal: renewal.daysUntilRenewal,
            })),
          },
        },
      ],
    };
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);

    logger.error('Failed to resolve upcoming renewals', {
      windowDays: safeWindowDays,
      limit: safeLimit,
      error: message,
    });

    return {
      content: [
        {
          type: 'text/plain',
          text: `Could not fetch upcoming renewals: ${message}`,
        },
      ],
      isError: true,
    };
  }
}

export const atRiskAccountsTool = {
  name: 'retention_get_at_risk_accounts',
  description: 'Return accounts flagged as at-risk or critical, ordered by severity.',
  inputSchema: {
    type: 'object',
    properties: {
      includeWatch: {
        type: 'boolean',
        description: 'Include watch-list accounts in addition to at-risk/critical.',
        default: false,
      },
      limit: {
        type: 'number',
        description: 'Maximum number of accounts to return.',
        default: 20,
      },
    },
  },
};

export async function handleAtRiskAccounts(args: unknown) {
  const params = (args ?? {}) as { includeWatch?: boolean; limit?: number };
  const includeWatch = params.includeWatch ?? false;
  const limit = params.limit ?? 20;

  logToolExecution('retention_get_at_risk_accounts', { includeWatch, limit });

  try {
    const accounts = await getAtRiskAccounts({ includeWatch, limit });

    return {
      content: [
        {
          type: 'application/json',
          data: {
            includeWatch,
            limit,
            total: accounts.length,
            items: accounts,
          },
        },
      ],
    };
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);

    logger.error('Failed to fetch at-risk accounts', {
      includeWatch,
      limit,
      error: message,
    });

    return {
      content: [
        {
          type: 'text/plain',
          text: `Could not fetch at-risk accounts: ${message}`,
        },
      ],
      isError: true,
    };
  }
}

export const generatePlaybookTool = {
  name: 'retention_generate_renewal_playbook',
  description: 'Generate and persist a renewal playbook for an account, returning recommended actions.',
  inputSchema: {
    type: 'object',
    required: ['accountId'],
    properties: {
      accountId: {
        type: 'string',
        description: 'Renewal account identifier.',
      },
      playbookType: {
        type: 'string',
        enum: ['renewal', 'upsell', 'win_back'],
        description: 'Optional playbook type override (defaults to renewal).',
      },
    },
  },
};

export async function handleGeneratePlaybook(args: unknown) {
  const params = (args ?? {}) as { accountId?: string; playbookType?: 'renewal' | 'upsell' | 'win_back' };

  if (!params.accountId) {
    return {
      content: [
        {
          type: 'text/plain',
          text: 'accountId is required to generate a renewal playbook.',
        },
      ],
      isError: true,
    };
  }

  logToolExecution('retention_generate_renewal_playbook', {
    accountId: params.accountId,
    playbookType: params.playbookType,
  });

  try {
    const draftInput: any = { accountId: params.accountId };
    if (params.playbookType) {
      draftInput.playbookType = params.playbookType;
    }

    const playbook = await generatePlaybookDraft(draftInput);

    return {
      content: [
        {
          type: 'application/json',
          data: playbook,
        },
      ],
    };
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);

    logger.error('Failed to generate renewal playbook', {
      accountId: params.accountId,
      error: message,
    });

    return {
      content: [
        {
          type: 'text/plain',
          text: `Could not generate playbook: ${message}`,
        },
      ],
      isError: true,
    };
  }
}
