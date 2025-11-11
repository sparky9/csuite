import type { RegisteredTool, ToolResponse } from './tooling.js';
import { billingGenerateInvoiceTool } from './billing-generate-invoice.js';
import { billingGeneratePaymentReminderTool } from './billing-generate-payment-reminder.js';
import { billingGetProfitabilityReportTool } from './billing-get-profitability-report.js';
import { billingGetRateCardsTool } from './billing-get-rate-cards.js';
import { billingRecordPaymentTool } from './billing-record-payment.js';
import { billingSendInvoiceTool } from './billing-send-invoice.js';
import { billingSetRateCardTool } from './billing-set-rate-card.js';
import { billingTrackInvoiceStatusTool } from './billing-track-invoice-status.js';
import { timeGetEntriesTool } from './time-get-entries.js';
import { timeTrackEntryTool } from './time-track-entry.js';

export const registeredTools: RegisteredTool[] = [
  timeTrackEntryTool,
  timeGetEntriesTool,
  billingSetRateCardTool,
  billingGetRateCardsTool,
  billingGenerateInvoiceTool,
  billingSendInvoiceTool,
  billingTrackInvoiceStatusTool,
  billingRecordPaymentTool,
  billingGeneratePaymentReminderTool,
  billingGetProfitabilityReportTool
];

export const toolDefinitions = registeredTools.map((entry) => entry.tool);

export const toolHandlers = registeredTools.reduce<Record<string, (input: unknown) => Promise<ToolResponse>>>(
  (acc, entry) => {
    acc[entry.tool.name] = entry.handler;
    return acc;
  },
  {}
);
