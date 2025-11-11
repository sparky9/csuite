import { withTransaction } from '../db/client.js';
import { logger } from '../utils/logger.js';

type PlaybookType = 'renewal' | 'upsell' | 'win_back';

export interface RenewalPlaybookAction {
  title: string;
  description: string;
  owner?: string;
  dueInDays?: number;
}

export interface RenewalPlaybookDraft {
  accountId: string;
  playbookType?: PlaybookType;
  summary?: string;
  keyObjectives?: string[];
  recommendedActions?: RenewalPlaybookAction[];
  generatedBy?: string;
}

export interface GeneratedPlaybook {
  id: string;
  accountId: string;
  playbookType: PlaybookType;
  summary: string;
  keyObjectives: string[];
  recommendedActions: RenewalPlaybookAction[];
  status: string;
  generatedAt: string;
  tasks: Array<{
    id: string;
    title: string;
    ownerName?: string;
    dueAt?: string | null;
    status: string;
    priority: string;
  }>;
  riskLevel: string;
}

const PRIORITY_BY_RISK: Record<string, string> = {
  critical: 'high',
  at_risk: 'high',
  watch: 'medium',
  healthy: 'medium',
  unknown: 'medium',
};

function defaultObjectives(riskLevel: string): string[] {
  if (riskLevel === 'critical') {
    return [
      'Stabilize relationship with executive sponsor',
      'Recover usage to contractually committed levels',
      'Confirm renewal intent within the next 7 days',
    ];
  }

  if (riskLevel === 'at_risk') {
    return [
      'Diagnose friction points impacting value realization',
      'Secure commitment for renewal decision meeting',
      'Outline win-back incentives if required',
    ];
  }

  return [
    'Validate current success plan with stakeholders',
    'Identify upsell opportunities tied to active initiatives',
    'Lock in renewal signature ahead of the renewal window',
  ];
}

function defaultActions(params: {
  accountName: string;
  ownerName?: string;
  riskLevel: string;
}): RenewalPlaybookAction[] {
  const ownerLabel = params.ownerName ?? 'Account Owner';

  if (params.riskLevel === 'critical') {
    return [
      {
        title: 'Executive escalation briefing',
        description: `Draft a briefing for leadership outlining churn drivers at ${params.accountName} and proposed remedies.`,
        owner: ownerLabel,
        dueInDays: 2,
      },
      {
        title: 'Usage recovery plan',
        description: 'Partner with product/solutions to deploy a 14-day adoption recovery initiative.',
        dueInDays: 3,
      },
      {
        title: 'Renewal decision checkpoint',
        description: 'Schedule renewal checkpoint with economic buyer; prep contingency pricing incentives.',
        dueInDays: 5,
      },
    ];
  }

  if (params.riskLevel === 'at_risk') {
    return [
      {
        title: 'Stakeholder alignment call',
        description: `Coordinate a health review call with ${params.accountName} stakeholders to confirm success criteria.`,
        owner: ownerLabel,
        dueInDays: 5,
      },
      {
        title: 'Adoption deep-dive',
        description: 'Audit usage analytics and support tickets to compile top friction themes.',
        dueInDays: 7,
      },
      {
        title: 'Renewal proposal refresh',
        description: 'Update renewal proposal with ROI highlights and optional service add-ons.',
        dueInDays: 9,
      },
    ];
  }

  return [
    {
      title: 'Renewal confirmation email',
      description: `Send confirmation note to ${params.accountName} summarizing value realized and next-term goals.`,
      owner: ownerLabel,
      dueInDays: 10,
    },
    {
      title: 'Expansion opportunity review',
      description: 'Review product usage to identify cross-sell or upsell plays before renewal meeting.',
      dueInDays: 12,
    },
  ];
}

function buildSummary(params: {
  accountName: string;
  renewalDate?: string | null;
  riskLevel: string;
  healthScore?: number | null;
  contractValue?: number | null;
}): string {
  const parts = [`${params.accountName} renewal playbook`];
  if (params.renewalDate) {
    parts.push(`Renewal on ${params.renewalDate}`);
  }
  parts.push(`Risk level: ${params.riskLevel}`);
  if (params.healthScore != null) {
    parts.push(`Health score: ${params.healthScore}`);
  }
  if (params.contractValue != null) {
    parts.push(`Contract value: $${Number(params.contractValue).toLocaleString()}`);
  }
  return parts.join(' • ');
}

export async function generatePlaybookDraft(draft: RenewalPlaybookDraft): Promise<GeneratedPlaybook> {
  const playbookType: PlaybookType = draft.playbookType ?? 'renewal';
  const generatedBy = draft.generatedBy ?? 'retention-renewal-agent';

  return withTransaction(async (client) => {
    const accountResult = await client.query(
      `SELECT id, account_name, owner_name, owner_id, risk_level, renewal_date, contract_value, health_score, metrics_snapshot
         FROM renewal_accounts
        WHERE id = $1`,
      [draft.accountId]
    );

    if (!accountResult.rowCount) {
      throw new Error(`Account ${draft.accountId} not found`);
    }

    const account = accountResult.rows[0];
    const riskLevel: string = account.risk_level ?? 'unknown';
    const renewalDate = account.renewal_date
      ? new Date(account.renewal_date).toISOString().slice(0, 10)
      : null;
    const healthScore = account.health_score != null ? Number(account.health_score) : null;

    const summary = draft.summary ?? buildSummary({
      accountName: account.account_name,
      renewalDate,
      riskLevel,
      healthScore,
      contractValue: account.contract_value != null ? Number(account.contract_value) : null,
    });

    const objectives = draft.keyObjectives?.length
      ? draft.keyObjectives
      : defaultObjectives(riskLevel);

    const recommendedActions = draft.recommendedActions?.length
      ? draft.recommendedActions
      : defaultActions({
          accountName: account.account_name,
          ownerName: account.owner_name ?? undefined,
          riskLevel,
        });

    const playbookResult = await client.query(
      `INSERT INTO renewal_playbooks (
         account_id,
         playbook_type,
         status,
         summary,
         key_objectives,
         recommended_actions,
         supporting_assets,
         generated_by
       ) VALUES ($1, $2, 'draft', $3, $4, $5::JSONB, '[]'::JSONB, $6)
       RETURNING id, generated_at`,
      [
        draft.accountId,
        playbookType,
        summary,
        objectives.join('\n'),
        JSON.stringify(recommendedActions),
        generatedBy,
      ]
    );

    const playbookId = playbookResult.rows[0].id;
    const generatedAt = new Date(playbookResult.rows[0].generated_at).toISOString();
    const priority = PRIORITY_BY_RISK[riskLevel] ?? 'medium';

    const tasks: GeneratedPlaybook['tasks'] = [];

    for (const action of recommendedActions) {
      const dueAt = typeof action.dueInDays === 'number'
        ? new Date(Date.now() + action.dueInDays * 24 * 60 * 60 * 1000)
        : null;

      const taskResult = await client.query(
        `INSERT INTO renewal_tasks (
           playbook_id,
           account_id,
           title,
           description,
           owner_id,
           owner_name,
           due_at,
           status,
           priority,
           context
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9::JSONB)
         RETURNING id, due_at, status, priority`,
        [
          playbookId,
          draft.accountId,
          action.title,
          action.description,
          account.owner_id ?? null,
          action.owner ?? account.owner_name ?? null,
          dueAt,
          priority,
          JSON.stringify({
            dueInDays: action.dueInDays,
            generatedBy,
          }),
        ]
      );

      tasks.push({
        id: taskResult.rows[0].id,
        title: action.title,
        ownerName: action.owner ?? account.owner_name ?? undefined,
        dueAt: taskResult.rows[0].due_at
          ? new Date(taskResult.rows[0].due_at).toISOString()
          : null,
        status: taskResult.rows[0].status,
        priority: taskResult.rows[0].priority,
      });
    }

    await client.query(
      `INSERT INTO renewal_events (
         account_id,
         event_type,
         description,
         metadata,
         occurred_at
       ) VALUES ($1, $2, $3, $4::JSONB, NOW())`,
      [
        draft.accountId,
        'renewal_playbook_generated',
        'Renewal playbook created via retention tool.',
        JSON.stringify({
          playbookId,
          playbookType,
          riskLevel,
          generatedBy,
        }),
      ]
    );

    logger.info('Renewal playbook generated', {
      accountId: draft.accountId,
      playbookId,
      playbookType,
      riskLevel,
    });

    return {
      id: playbookId,
      accountId: draft.accountId,
      playbookType,
      summary,
      keyObjectives: objectives,
      recommendedActions,
      status: 'draft',
      generatedAt,
      tasks,
      riskLevel,
    };
  });
}
