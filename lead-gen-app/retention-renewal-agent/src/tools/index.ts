import {
  upcomingRenewalsTool,
  atRiskAccountsTool,
  generatePlaybookTool,
  handleUpcomingRenewals,
  handleAtRiskAccounts,
  handleGeneratePlaybook,
} from './retention-tools.js';

export const ALL_RETENTION_TOOLS = [
  upcomingRenewalsTool,
  atRiskAccountsTool,
  generatePlaybookTool,
];

export const RETENTION_TOOL_HANDLERS: Record<string, (args: unknown) => Promise<any>> = {
  retention_get_upcoming_renewals: handleUpcomingRenewals,
  retention_get_at_risk_accounts: handleAtRiskAccounts,
  retention_generate_renewal_playbook: handleGeneratePlaybook,
};
