/**
 * TypeScript Types for Bookkeeping Assistant MCP
 */

// AI generation options
export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  stopSequences?: string[];
  systemPrompt?: string;
}

// Enums for bookkeeping parameters
export type TransactionType = 'income' | 'expense' | 'transfer';
export type ExpenseCategory = 'office_supplies' | 'software' | 'marketing' | 'travel' | 'meals' | 'utilities' | 'professional_services' | 'other';
export type IncomeCategory = 'product_sales' | 'service_revenue' | 'consulting' | 'commissions' | 'other';
export type ReportType = 'profit_loss' | 'cash_flow' | 'balance_sheet' | 'tax_summary';
export type ReportPeriod = 'monthly' | 'quarterly' | 'yearly';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

// Transaction parameters
export interface AddTransactionParams {
  type: TransactionType;
  amount: number;
  description: string;
  category: ExpenseCategory | IncomeCategory | string;
  date: string;
  currency?: string;
  exchange_rate?: number;
  base_currency?: string;
  reference?: string;
  user_id?: string;
}

export interface TransactionResult {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  category: string;
  date: string;
  currency?: string;
  exchange_rate?: number;
  base_amount?: number;
  base_currency?: string;
  reference?: string;
  normalized_category: string;
  metadata?: Record<string, unknown>;
}

// Invoice generation parameters
export interface GenerateInvoiceParams {
  client_name: string;
  client_email: string;
  items: InvoiceItem[];
  due_date: string;
  notes?: string;
  tax_rate?: number;
  user_id?: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface InvoiceResult {
  invoice_number: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  due_date: string;
  items: InvoiceItem[];
  html_content: string;
  plain_text: string;
  metadata?: Record<string, unknown>;
}

// Expense tracking parameters
export interface TrackExpenseParams {
  amount: number;
  description: string;
  category: ExpenseCategory;
  date: string;
  currency?: string;
  exchange_rate?: number;
  base_currency?: string;
  receipt_url?: string;
  notes?: string;
  user_id?: string;
}

export interface ExpenseResult {
  id: string;
  amount: number;
  description: string;
  category: ExpenseCategory;
  date: string;
  currency?: string;
  exchange_rate?: number;
  base_amount?: number;
  base_currency?: string;
  receipt_url?: string;
  notes?: string;
  normalized_category: string;
  metadata?: Record<string, unknown>;
}

// Report generation parameters
export interface GenerateReportParams {
  type: ReportType;
  period: ReportPeriod;
  start_date: string;
  end_date: string;
  include_details?: boolean;
  user_id?: string;
}

export interface ReportResult {
  type: ReportType;
  period: ReportPeriod;
  start_date: string;
  end_date: string;
  summary: Record<string, number>;
  details?: any[];
  recommendations?: string[];
  metrics?: Record<string, number>;
  metadata?: Record<string, unknown>;
}

// Tax calculation parameters
export interface CalculateTaxParams {
  year: number;
  include_deductions?: boolean;
  user_id?: string;
}

export interface TaxResult {
  year: number;
  total_income: number;
  total_expenses: number;
  taxable_income: number;
  estimated_tax: number;
  deductions: Record<string, number>;
  recommendations: string[];
  metadata?: Record<string, unknown>;
}

export interface ReceiptExtractionResult {
  vendor: string;
  amount: number;
  date: string;
  category: string;
  taxAmount?: number;
  currency: string;
  exchangeRate?: number;
  reference?: string;
}

export interface ScanReceiptParams {
  userId?: string;
  imageBase64: string;
  autoCreateTransaction?: boolean;
  fileName?: string;
  mimeType?: string;
  storeImage?: boolean;
}

export interface ScanReceiptResult {
  receiptId: string;
  extracted: ReceiptExtractionResult;
  confidence: number;
  transactionCreated: boolean;
  transactionId?: string;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
}

export type ReportExportFormat = 'pdf' | 'excel' | 'csv';

export interface ExportReportParams {
  userId?: string;
  reportType: ReportType;
  startDate: string;
  endDate: string;
  format?: ReportExportFormat;
}

export interface ExportReportResult {
  reportId: string;
  format: ReportExportFormat;
  downloadUrl: string;
  expiresAt: string;
  filePath?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditTrailChangeDiff {
  old?: unknown;
  new?: unknown;
}

export type AuditTrailChangeValue = AuditTrailChangeDiff | Record<string, unknown> | string | number | boolean | null;

export interface AuditTrailEntry {
  version: number;
  changedBy: string;
  changedAt: string;
  changes: Record<string, AuditTrailChangeValue>;
}

export interface AuditTrailResult {
  transactionId: string;
  history: AuditTrailEntry[];
  metadata?: Record<string, unknown>;
}

export interface CategorizedTransactionSuggestion {
  raw: string;
  category: string;
  confidence: number;
  reasoning: string;
  metadata?: Record<string, unknown>;
}

export interface BudgetPlanResult {
  budget_breakdown: Record<string, number>;
  recommendations: string[];
  projected_savings: string[];
  warnings: string[];
  metadata?: Record<string, unknown>;
}

export interface CashFlowForecastPeriod {
  period: string;
  projected_inflows: number;
  projected_outflows: number;
  net_cash_flow: number;
  cumulative_cash: number;
  confidence_level: number;
}

export interface CashFlowForecastResult {
  forecast_periods: CashFlowForecastPeriod[];
  total_forecast: number;
  key_insights: string[];
  recommendations: string[];
  risk_factors: string[];
  forecast_summary: {
    average_period_cash_flow: number;
    best_case_scenario: number;
    worst_case_scenario: number;
  };
  metadata?: Record<string, unknown>;
}

// AI Response wrapper
export interface AIGenerationResult {
  content: string;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

// Financial categories
export const EXPENSE_CATEGORIES: Record<ExpenseCategory, string> = {
  office_supplies: 'Office Supplies',
  software: 'Software & Tools',
  marketing: 'Marketing & Advertising',
  travel: 'Travel & Transportation',
  meals: 'Meals & Entertainment',
  utilities: 'Utilities',
  professional_services: 'Professional Services',
  other: 'Other Expenses',
};

export const INCOME_CATEGORIES: Record<IncomeCategory, string> = {
  product_sales: 'Product Sales',
  service_revenue: 'Service Revenue',
  consulting: 'Consulting',
  commissions: 'Commissions',
  other: 'Other Income',
};

// Tax brackets (simplified for US)
export const TAX_BRACKETS = {
  2023: [
    { min: 0, max: 11000, rate: 0.10 },
    { min: 11000, max: 44725, rate: 0.12 },
    { min: 44725, max: 95375, rate: 0.22 },
    { min: 95375, max: 182100, rate: 0.24 },
    { min: 182100, max: 231250, rate: 0.32 },
    { min: 231250, max: 578125, rate: 0.35 },
    { min: 578125, max: Infinity, rate: 0.37 },
  ],
};
