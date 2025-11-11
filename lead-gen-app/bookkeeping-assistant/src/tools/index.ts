/**
 * Bookkeeping Assistant MCP Tools Index
 * Exports all MCP tool definitions and handlers
 */

import { addTransactionTool, handleAddTransaction } from './add-transaction.tool.js';
import { generateInvoiceTool, handleGenerateInvoice } from './generate-invoice.tool.js';
import { trackExpenseTool, handleTrackExpense } from './track-expense.tool.js';
import { generateReportTool, handleGenerateReport } from './generate-report.tool.js';
import { calculateTaxTool, handleCalculateTax } from './calculate-tax.tool.js';
import { categorizeTransactionsTool, handleCategorizeTransactions } from './categorize-transactions.tool.js';
import { reconcileAccountsTool, handleReconcileAccounts } from './reconcile-accounts.tool.js';
import { budgetPlanningTool, handleBudgetPlanning } from './budget-planning.tool.js';
import { cashFlowForecastTool, handleCashFlowForecast } from './cash-flow-forecast.tool.js';
import { scanReceiptTool, handleScanReceipt } from './scan-receipt.tool.js';
import { exportReportTool, handleExportReport } from './export-report.tool.js';
import { getAuditTrailTool, handleGetAuditTrail } from './get-audit-trail.tool.js';

// Array of all tools for MCP server registration
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export {
  addTransactionTool,
  handleAddTransaction,
  generateInvoiceTool,
  handleGenerateInvoice,
  trackExpenseTool,
  handleTrackExpense,
  generateReportTool,
  handleGenerateReport,
  calculateTaxTool,
  handleCalculateTax,
  categorizeTransactionsTool,
  handleCategorizeTransactions,
  reconcileAccountsTool,
  handleReconcileAccounts,
  budgetPlanningTool,
  handleBudgetPlanning,
  cashFlowForecastTool,
  handleCashFlowForecast,
  scanReceiptTool,
  handleScanReceipt,
  exportReportTool,
  handleExportReport,
  getAuditTrailTool,
  handleGetAuditTrail,
};

export const ALL_BOOKKEEPING_TOOLS: Tool[] = [
  addTransactionTool,
  generateInvoiceTool,
  trackExpenseTool,
  generateReportTool,
  calculateTaxTool,
  categorizeTransactionsTool,
  reconcileAccountsTool,
  budgetPlanningTool,
  cashFlowForecastTool,
  scanReceiptTool,
  exportReportTool,
  getAuditTrailTool,
];

// Map of tool names to handler functions
export const TOOL_HANDLERS: Record<string, (args: unknown, userId?: string) => Promise<any>> = {
  add_transaction: handleAddTransaction,
  generate_invoice: handleGenerateInvoice,
  track_expense: handleTrackExpense,
  generate_report: handleGenerateReport,
  calculate_tax: handleCalculateTax,
  categorize_transactions: handleCategorizeTransactions,
  reconcile_accounts: handleReconcileAccounts,
  budget_planning: handleBudgetPlanning,
  cash_flow_forecast: handleCashFlowForecast,
  scan_receipt: handleScanReceipt,
  export_report: handleExportReport,
  get_audit_trail: handleGetAuditTrail,
};

// Tool descriptions for documentation
export const TOOL_DESCRIPTIONS = {
  add_transaction: 'Add income or expense transactions to your bookkeeping records',
  generate_invoice: 'Generate professional invoices for clients with customizable items and tax calculations',
  track_expense: 'Track business expenses with categories, receipts, and notes for tax purposes',
  generate_report: 'Generate financial reports including profit & loss, cash flow, and balance sheets',
  calculate_tax: 'Calculate estimated taxes based on income, expenses, and deductions',
  categorize_transactions: 'AI-powered categorization of transactions for better organization',
  reconcile_accounts: 'Reconcile bank statements with recorded transactions',
  budget_planning: 'Create and manage budgets with AI recommendations',
  cash_flow_forecast: 'Forecast future cash flow based on historical data and trends',
  scan_receipt: 'Extract transaction details from receipts with lightweight OCR and optional auto-booking',
  export_report: 'Export financial reports to PDF, Excel-compatible SpreadsheetML, or CSV formats',
  get_audit_trail: 'Review version history and change diffs for recorded transactions',
};

// Categories for UI organization
export const TOOL_CATEGORIES = {
  transactions: [
    'add_transaction',
    'track_expense',
    'categorize_transactions',
    'reconcile_accounts',
    'scan_receipt',
  ],
  invoicing: [
    'generate_invoice',
  ],
  reporting: [
    'generate_report',
    'calculate_tax',
    'cash_flow_forecast',
    'export_report',
    'get_audit_trail',
  ],
  planning: [
    'budget_planning',
  ],
};
