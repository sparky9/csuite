import { logger } from '../utils/logger.js';
import { getConfig } from '../utils/config.js';

export interface RenewalAlertPayload {
  accountId: string;
  accountName: string;
  renewalDate: string;
  riskLevel: string;
  summary: string;
}

export async function sendRenewalAlert(alert: RenewalAlertPayload): Promise<void> {
  const config = getConfig();

  if (!config.NOTIFICATION_SLACK_WEBHOOK) {
    logger.warn('Slack webhook not configured; renewal alert skipped.', { alert });
    return;
  }

  const fetchFn: any = (globalThis as any).fetch;

  if (typeof fetchFn !== 'function') {
    logger.error('Global fetch is unavailable; cannot deliver renewal alert.', {
      accountId: alert.accountId,
    });
    return;
  }

  const message = [
    `*Account:* ${alert.accountName}`,
    `*Risk:* ${alert.riskLevel.toUpperCase()}`,
    `*Renewal:* ${alert.renewalDate}`,
    alert.summary,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const response = await fetchFn(config.NOTIFICATION_SLACK_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: `:rotating_light: Renewal Alert\n${message}`,
      }),
    });

    if ((response as any)?.ok !== true) {
      const status = (response as any)?.status;
      const statusText = (response as any)?.statusText;
      logger.error('Slack webhook responded with non-OK status', {
        accountId: alert.accountId,
        status,
        statusText,
      });
    } else {
      logger.info('Renewal alert delivered to Slack', {
        accountId: alert.accountId,
        riskLevel: alert.riskLevel,
      });
    }
  } catch (error: any) {
    logger.error('Failed to post renewal alert to Slack', {
      accountId: alert.accountId,
      error: error?.message ?? error,
    });
  }
}
