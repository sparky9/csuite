import crypto from 'node:crypto';
import {
  type AddTransactionParams,
  type TrackExpenseParams,
  type GenerateInvoiceParams,
  type TransactionResult,
  type ExpenseResult,
  type InvoiceResult,
  type GenerateReportParams,
  type ReportResult,
  type CalculateTaxParams,
  type TaxResult,
  type CategorizedTransactionSuggestion,
  type BudgetPlanResult,
  type CashFlowForecastResult,
  type CashFlowForecastPeriod,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  TAX_BRACKETS,
  type ReportType,
  type TransactionType,
} from '../types/bookkeeping.types.js';
import { logger } from '../utils/logger.js';
import {
  BASE_CURRENCY,
  describeExchangeRate,
  normalizeCurrency,
  normalizeExchangeRate,
  toBaseCurrency,
} from '../utils/currency.js';

export interface LedgerEntry {
  type: TransactionType;
  amount: number;
  category: string;
  date: string;
  currency?: string;
  exchange_rate?: number;
  base_currency?: string;
  original_amount?: number;
}

export interface HistoricalDatum {
  period: string;
  inflows: number;
  outflows: number;
  net: number;
}

interface LedgerSnapshot {
  totalIncome: number;
  totalExpenses: number;
  net: number;
  categoryTotals: Record<string, number>;
  monthlyBreakdown: Record<string, { income: number; expense: number }>;
}

function deterministicHash(seed: string): string {
  return crypto.createHash('sha256').update(seed).digest('hex');
}

function generateId(prefix: string, seed: string): string {
  const hash = deterministicHash(seed);
  return `${prefix}_${hash.slice(0, 12)}`;
}

function seededNumber(seed: string, min: number, max: number): number {
  const hash = deterministicHash(seed).slice(0, 12);
  const int = parseInt(hash, 16);
  const ratio = int / 0xffffffffff;
  return min + ratio * (max - min);
}

function normalizeCategory(category: string, type: TransactionType): string {
  const normalized = category.toLowerCase();
  if (type === 'income') {
    return INCOME_CATEGORIES[normalized as keyof typeof INCOME_CATEGORIES]
      ? INCOME_CATEGORIES[normalized as keyof typeof INCOME_CATEGORIES]
      : category;
  }

  if (type === 'expense' || type === 'transfer') {
    return EXPENSE_CATEGORIES[normalized as keyof typeof EXPENSE_CATEGORIES]
      ? EXPENSE_CATEGORIES[normalized as keyof typeof EXPENSE_CATEGORIES]
      : category;
  }

  return category;
}

function summarizeLedger(entries: LedgerEntry[]): LedgerSnapshot {
  const categoryTotals: Record<string, number> = {};
  const monthlyBreakdown: Record<string, { income: number; expense: number }> = {};
  let totalIncome = 0;
  let totalExpenses = 0;

  for (const entry of entries) {
    const date = entry.date ?? new Date().toISOString().slice(0, 10);
    const monthKey = date.slice(0, 7);
    if (!monthlyBreakdown[monthKey]) {
      monthlyBreakdown[monthKey] = { income: 0, expense: 0 };
    }

    if (!categoryTotals[entry.category]) {
      categoryTotals[entry.category] = 0;
    }

    if (entry.type === 'income') {
      totalIncome += entry.amount;
      categoryTotals[entry.category] += entry.amount;
      monthlyBreakdown[monthKey].income += entry.amount;
    } else if (entry.type === 'expense') {
      totalExpenses += entry.amount;
      categoryTotals[entry.category] += entry.amount;
      monthlyBreakdown[monthKey].expense += entry.amount;
    }
  }

  return {
    totalIncome,
    totalExpenses,
    net: totalIncome - totalExpenses,
    categoryTotals,
    monthlyBreakdown,
  };
}

export function createTransactionRecord(params: AddTransactionParams): TransactionResult {
  const normalizedCategory = normalizeCategory(params.category, params.type);
  const idSeed = `${params.type}:${params.category}:${params.amount}:${params.date}:${params.description}`;
  const id = generateId('txn', idSeed);
  const normalizedAmount = Number(params.amount.toFixed(2));
  const currencyInfo = describeExchangeRate(params.currency, params.exchange_rate);
  const baseAmount = toBaseCurrency(normalizedAmount, currencyInfo.currency, currencyInfo.exchangeRate);

  return {
    id,
    type: params.type,
    amount: normalizedAmount,
    description: params.description.trim(),
    category: params.category,
    date: params.date,
    currency: currencyInfo.currency,
    exchange_rate: currencyInfo.exchangeRate,
    base_amount: baseAmount,
    base_currency: currencyInfo.baseCurrency,
    reference: params.reference,
    normalized_category: normalizedCategory,
    metadata: {
      goal: params.type === 'income' ? 'revenue' : params.type === 'expense' ? 'spend' : 'transfer',
      currency: currencyInfo.currency,
      base_currency: currencyInfo.baseCurrency,
      exchange_rate: currencyInfo.exchangeRate,
      base_amount: baseAmount,
    },
  };
}

export function createExpenseRecord(params: TrackExpenseParams): {
  transaction: TransactionResult;
  expense: ExpenseResult;
} {
  const transaction = createTransactionRecord({
    type: 'expense',
    amount: params.amount,
    description: params.description,
    category: params.category,
    date: params.date,
    reference: params.receipt_url,
    user_id: params.user_id,
    currency: params.currency,
    exchange_rate: params.exchange_rate,
    base_currency: params.base_currency,
  });

  const expenseId = generateId('exp', `${transaction.id}:${params.receipt_url ?? ''}`);

  return {
    transaction,
    expense: {
      id: expenseId,
      amount: transaction.amount,
      description: transaction.description,
      category: params.category,
      date: params.date,
      currency: transaction.currency,
      exchange_rate: transaction.exchange_rate,
      base_amount: transaction.base_amount,
      base_currency: transaction.base_currency,
      receipt_url: params.receipt_url,
      notes: params.notes,
      normalized_category: transaction.normalized_category,
      metadata: {
        base_amount: transaction.base_amount,
        currency: transaction.currency,
        exchange_rate: transaction.exchange_rate,
        base_currency: transaction.base_currency,
      },
    },
  };
}

function buildInvoiceNumber(params: GenerateInvoiceParams): string {
  const base = `${params.client_name}:${params.due_date}:${params.items.length}:${params.items[0]?.description ?? ''}`;
  const hash = deterministicHash(base).slice(0, 6).toUpperCase();
  return `INV-${params.due_date.replace(/-/g, '')}-${hash}`;
}

function buildInvoiceHtml(invoice: InvoiceResult, params: GenerateInvoiceParams): string {
  const rows = invoice.items
    .map(item => `
        <tr>
          <td style="border:1px solid #ddd;padding:8px;">${item.description}</td>
          <td style="border:1px solid #ddd;padding:8px;text-align:right;">${item.quantity}</td>
          <td style="border:1px solid #ddd;padding:8px;text-align:right;">$${item.unit_price.toFixed(2)}</td>
          <td style="border:1px solid #ddd;padding:8px;text-align:right;">$${item.total.toFixed(2)}</td>
        </tr>`)
    .join('');

  const notesSection = params.notes
    ? `<div style="margin-top:20px;"><strong>Notes:</strong><br>${params.notes}</div>`
    : '';

  return `
    <div style="font-family:Arial, sans-serif;max-width:640px;margin:0 auto;">
      <h1 style="margin-bottom:4px;">Invoice ${invoice.invoice_number}</h1>
      <p style="color:#555;margin-top:0;">Issued ${new Date().toISOString().slice(0, 10)}</p>
      <div style="margin-bottom:24px;">
        <p style="margin:0;"><strong>Bill To:</strong> ${params.client_name}</p>
        <p style="margin:0;">${params.client_email}</p>
        <p style="margin:0;">Due Date: ${params.due_date}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f6f6f6;">
            <th style="border:1px solid #ddd;padding:8px;text-align:left;">Description</th>
            <th style="border:1px solid #ddd;padding:8px;text-align:right;">Qty</th>
            <th style="border:1px solid #ddd;padding:8px;text-align:right;">Unit Price</th>
            <th style="border:1px solid #ddd;padding:8px;text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>${rows}
        </tbody>
      </table>
      <div style="margin-top:20px;text-align:right;">
        <p style="margin:4px 0;">Subtotal: <strong>$${invoice.subtotal.toFixed(2)}</strong></p>
        ${invoice.tax_amount > 0 ? `<p style="margin:4px 0;">Tax: <strong>$${invoice.tax_amount.toFixed(2)}</strong></p>` : ''}
        <p style="margin:4px 0;font-size:16px;">Total Due: <strong>$${invoice.total_amount.toFixed(2)}</strong></p>
      </div>
      ${notesSection}
    </div>
  `;
}

function buildInvoiceText(invoice: InvoiceResult, params: GenerateInvoiceParams): string {
  const lines = invoice.items
    .map(item => `- ${item.description}: ${item.quantity} × $${item.unit_price.toFixed(2)} = $${item.total.toFixed(2)}`)
    .join('\n');

  return [
    `Invoice ${invoice.invoice_number}`,
    '',
    `Client: ${params.client_name} <${params.client_email}>`,
    `Due Date: ${params.due_date}`,
    '',
    'Items:',
    lines,
    '',
    `Subtotal: $${invoice.subtotal.toFixed(2)}`,
    invoice.tax_amount > 0 ? `Tax: $${invoice.tax_amount.toFixed(2)}` : undefined,
    `Total: $${invoice.total_amount.toFixed(2)}`,
    params.notes ? `\nNotes: ${params.notes}` : undefined,
  ].filter(Boolean).join('\n');
}

export function buildInvoiceDraft(params: GenerateInvoiceParams): InvoiceResult {
  const items = params.items.map(item => ({
    ...item,
    total: Number((item.quantity * item.unit_price).toFixed(2)),
  }));

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const taxRate = params.tax_rate ?? 0;
  const taxAmount = Number((subtotal * taxRate).toFixed(2));
  const total = Number((subtotal + taxAmount).toFixed(2));
  const invoiceNumber = buildInvoiceNumber(params);

  const result: InvoiceResult = {
    invoice_number: invoiceNumber,
    subtotal: Number(subtotal.toFixed(2)),
    tax_amount: taxAmount,
    total_amount: total,
    due_date: params.due_date,
    items,
    html_content: '',
    plain_text: '',
  };

  result.html_content = buildInvoiceHtml(result, params);
  result.plain_text = buildInvoiceText(result, params);

  return result;
}

function generateReportRecommendations(type: ReportType, snapshot: LedgerSnapshot): string[] {
  const recommendations: string[] = [];
  const expenseRatio = snapshot.totalIncome === 0 ? 0 : snapshot.totalExpenses / snapshot.totalIncome;

  if (type === 'profit_loss') {
    if (expenseRatio > 0.75) {
      recommendations.push('Expense ratio exceeds 75% of revenue—review discretionary spending.');
    }
    recommendations.push('Schedule a monthly review of top three expense categories to control burn.');
  }

  if (type === 'cash_flow') {
    recommendations.push('Maintain at least two months of expenses in your operating account.');
    if (snapshot.net < 0) {
      recommendations.push('Net cash flow is negative—consider renegotiating payment terms.');
    }
  }

  if (type === 'balance_sheet') {
    recommendations.push('Diversify assets across operating, savings, and investment accounts.');
    recommendations.push('Verify outstanding liabilities and schedule pay-down cadence.');
  }

  if (type === 'tax_summary') {
    recommendations.push('Save 25% of all income to a dedicated tax account.');
    recommendations.push('Keep detailed records of deductible expenses for audits.');
  }

  return recommendations;
}

function buildReportDetails(includeDetails: boolean, snapshot: LedgerSnapshot): any[] | undefined {
  if (!includeDetails) {
    return undefined;
  }

  return Object.entries(snapshot.categoryTotals)
    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
    .slice(0, 6)
    .map(([category, amount]) => ({
      category,
      amount: Number(amount.toFixed(2)),
    }));
}

export function buildFinancialReport(
  params: GenerateReportParams,
  ledger: LedgerEntry[],
): ReportResult {
  const snapshot = summarizeLedger(ledger);
  const summary: Record<string, number> = {};
  const metrics: Record<string, number> = {};

  switch (params.type) {
    case 'profit_loss':
      summary.total_income = Number(snapshot.totalIncome.toFixed(2));
      summary.total_expenses = Number(snapshot.totalExpenses.toFixed(2));
      summary.net_profit = Number(snapshot.net.toFixed(2));
      metrics.expense_ratio = snapshot.totalIncome === 0
        ? 0
        : Number((snapshot.totalExpenses / snapshot.totalIncome).toFixed(3));
      break;
    case 'cash_flow': {
      const months = Object.keys(snapshot.monthlyBreakdown).length || 1;
      const inflow = snapshot.totalIncome;
      const outflow = snapshot.totalExpenses;
      summary.cash_inflows = Number(inflow.toFixed(2));
      summary.cash_outflows = Number(outflow.toFixed(2));
      summary.net_cash_flow = Number((inflow - outflow).toFixed(2));
      summary.average_monthly_inflow = Number((inflow / months).toFixed(2));
      summary.average_monthly_outflow = Number((outflow / months).toFixed(2));
      break;
    }
    case 'balance_sheet':
      summary.total_assets = Number((snapshot.totalIncome * 0.6 + 15000).toFixed(2));
      summary.total_liabilities = Number((snapshot.totalExpenses * 0.3 + 5000).toFixed(2));
      summary.equity = Number((summary.total_assets - summary.total_liabilities).toFixed(2));
      break;
    case 'tax_summary':
      summary.total_income = Number(snapshot.totalIncome.toFixed(2));
      summary.total_expenses = Number(snapshot.totalExpenses.toFixed(2));
      summary.taxable_income = Number((snapshot.totalIncome - snapshot.totalExpenses).toFixed(2));
      summary.estimated_tax = Number((summary.taxable_income * 0.25).toFixed(2));
      break;
  }

  const recommendations = generateReportRecommendations(params.type, snapshot);
  const details = buildReportDetails(Boolean(params.include_details), snapshot);

  return {
    type: params.type,
    period: params.period,
    start_date: params.start_date,
    end_date: params.end_date,
    summary,
    details,
    recommendations,
    metrics: Object.keys(metrics).length > 0 ? metrics : undefined,
  };
}

function calculateBracketedTax(income: number, year: number): number {
  const brackets = TAX_BRACKETS[year as keyof typeof TAX_BRACKETS] ?? TAX_BRACKETS[2023];
  let remaining = income;
  let tax = 0;

  for (const bracket of brackets) {
    if (remaining <= 0) {
      break;
    }

    const upperBound = bracket.max === Infinity ? remaining : Math.min(remaining, bracket.max - bracket.min);
    tax += upperBound * bracket.rate;
    remaining -= upperBound;
  }

  return Math.max(0, Number(tax.toFixed(2)));
}

export function estimateTax(
  params: CalculateTaxParams,
  ledger: LedgerEntry[],
): TaxResult {
  const snapshot = summarizeLedger(ledger);
  const deductions: Record<string, number> = {};

  if (params.include_deductions) {
    const categoryDeductions = ['software', 'marketing', 'utilities', 'professional_services'];
    for (const category of categoryDeductions) {
      const amount = snapshot.categoryTotals[category] ?? 0;
      if (amount > 0) {
        deductions[category] = Number((amount * 0.6).toFixed(2));
      }
    }
    deductions.home_office = Number((snapshot.totalExpenses * 0.08).toFixed(2));
    deductions.retirement = Number((snapshot.totalIncome * 0.05).toFixed(2));
  }

  const totalDeductions = Object.values(deductions).reduce((sum, value) => sum + value, 0);
  const taxableIncome = Math.max(0, snapshot.totalIncome - snapshot.totalExpenses - totalDeductions);
  const estimatedTax = calculateBracketedTax(taxableIncome, params.year);

  const recommendations = [
    'Move 25% of net income into a dedicated tax account each month.',
    'Document mileage, home office, and professional services to maximize deductions.',
  ];
  if (params.include_deductions) {
    recommendations.push('Review deduction tracking quarterly to avoid year-end scrambles.');
  }

  return {
    year: params.year,
    total_income: Number(snapshot.totalIncome.toFixed(2)),
    total_expenses: Number(snapshot.totalExpenses.toFixed(2)),
    taxable_income: Number(taxableIncome.toFixed(2)),
    estimated_tax: estimatedTax,
    deductions: params.include_deductions ? { ...deductions, total: Number(totalDeductions.toFixed(2)) } : {},
    recommendations,
  };
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  office_supplies: ['staples', 'office depot', 'paper', 'ink', 'stationery', 'supplies'],
  software: ['saas', 'subscription', 'license', 'software', 'app', 'adobe', 'hubspot', 'notion'],
  marketing: ['ads', 'advertising', 'facebook', 'google', 'campaign', 'marketing'],
  travel: ['flight', 'hotel', 'uber', 'airbnb', 'travel', 'lyft'],
  meals: ['restaurant', 'cafe', 'coffee', 'meals', 'dining'],
  utilities: ['internet', 'electric', 'utility', 'phone', 'energy'],
  professional_services: ['consulting', 'legal', 'accounting', 'attorney', 'cpa'],
  product_sales: ['payout', 'stripe', 'shopify', 'product', 'sale'],
  service_revenue: ['invoice payment', 'retainer', 'service', 'project'],
  consulting: ['consulting', 'advisory'],
};

function detectCategory(raw: string): { category: string; confidence: number; reasoning: string } {
  const lower = raw.toLowerCase();
  let bestMatch: string | null = null;
  let bestScore = 0;
  const matchedKeywords: string[] = [];

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        matchedKeywords.push(keyword);
        score += keyword.length;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = category;
    }
  }

  if (!bestMatch) {
    const amountMatch = raw.match(/\$?([0-9]+\.?[0-9]*)/);
    const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;
    const fallbackCategory = amount >= 0 ? 'service_revenue' : 'other';
    return {
      category: fallbackCategory,
      confidence: amount ? 0.55 : 0.5,
      reasoning: 'Defaulted based on transaction amount and missing keyword matches.',
    };
  }

  const confidence = Math.min(0.95, 0.65 + bestScore / 100);
  const reasoning = matchedKeywords.length
    ? `Matched keywords: ${Array.from(new Set(matchedKeywords)).join(', ')}`
    : 'Matched category heuristics.';

  return {
    category: bestMatch,
    confidence: Number(confidence.toFixed(3)),
    reasoning,
  };
}

export function categorizeTransactions(rawTransactions: string[]): CategorizedTransactionSuggestion[] {
  return rawTransactions.map((raw, index) => {
    const suggestion = detectCategory(raw);
    const jitter = seededNumber(`${raw}:${index}`, -0.04, 0.04);
    const confidence = Math.max(0.5, Math.min(0.98, suggestion.confidence + jitter));

    return {
      raw,
      category: suggestion.category,
      confidence: Number(confidence.toFixed(3)),
      reasoning: suggestion.reasoning,
    };
  });
}

const DEFAULT_BUDGET_WEIGHTS: Record<string, number> = {
  marketing: 0.22,
  software: 0.14,
  professional_services: 0.12,
  utilities: 0.08,
  office_supplies: 0.07,
  travel: 0.07,
  meals: 0.05,
  other: 0.25,
};

export function planBudget(
  period: string,
  totalBudget: number,
  categories?: string[],
  historicalData?: Array<{ category: string; amount: number }>,
  goals?: string[],
): BudgetPlanResult {
  const normalizedCategories = categories && categories.length > 0
    ? categories
    : Object.keys(DEFAULT_BUDGET_WEIGHTS);

  const weights: Record<string, number> = {};
  const totalWeight = normalizedCategories.reduce((sum, category) => {
    const weight = DEFAULT_BUDGET_WEIGHTS[category] ?? 0.08;
    weights[category] = weight;
    return sum + weight;
  }, 0);

  const breakdown: Record<string, number> = {};
  for (const category of normalizedCategories) {
    breakdown[category] = Number(((weights[category] / totalWeight) * totalBudget).toFixed(2));
  }

  if (historicalData && historicalData.length > 0) {
    for (const data of historicalData) {
      if (!breakdown[data.category]) {
        continue;
      }
      const adjustment = seededNumber(`${data.category}:${period}`, -0.08, 0.12);
      breakdown[data.category] = Number(Math.max(0, breakdown[data.category] * (1 + adjustment)).toFixed(2));
    }
  }

  const recommendations: string[] = [];
  const projectedSavings: string[] = [];
  const warnings: string[] = [];

  if (goals?.some(goal => goal.toLowerCase().includes('save'))) {
    const reserve = totalBudget * 0.1;
    projectedSavings.push(`Allocate $${reserve.toFixed(2)} to savings to advance your goal.`);
  }

  if (breakdown.software && breakdown.software > totalBudget * 0.2) {
    warnings.push('Software spending exceeds 20% of budget—audit seat usage.');
  }

  recommendations.push('Review budget variance monthly and adjust the top two categories.');
  recommendations.push('Automate transfers to savings accounts on payday.');

  const allocatedSum = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
  const roundingDifference = Number((totalBudget - allocatedSum).toFixed(2));
  if (Math.abs(roundingDifference) >= 0.01) {
    const largestCategory = Object.entries(breakdown).sort((a, b) => b[1] - a[1])[0];
    if (largestCategory) {
      breakdown[largestCategory[0]] = Number((largestCategory[1] + roundingDifference).toFixed(2));
    }
  }

  return {
    budget_breakdown: breakdown,
    recommendations,
    projected_savings: projectedSavings,
    warnings,
  };
}

function nextPeriodLabel(periodType: string, index: number, historicalLast?: string): string {
  if (periodType === 'monthly') {
    if (historicalLast && /^\d{4}-\d{2}$/.test(historicalLast)) {
      const [yearStr, monthStr] = historicalLast.split('-');
      let year = Number(yearStr);
      let month = Number(monthStr) + index + 1;
      while (month > 12) {
        month -= 12;
        year += 1;
      }
      return `${year}-${String(month).padStart(2, '0')}`;
    }
    return `Month ${index + 1}`;
  }

  if (periodType === 'quarterly') {
    return `Q${(index % 4) + 1} ${new Date().getFullYear() + Math.floor(index / 4)}`;
  }

  return `${new Date().getFullYear() + index}`;
}

export function forecastCashFlow(
  periodType: string,
  forecastPeriod: number,
  historicalData?: HistoricalDatum[],
  assumptions?: string[],
): CashFlowForecastResult {
  const baseNet = historicalData && historicalData.length > 0
    ? historicalData.reduce((sum, item) => sum + item.net, 0) / historicalData.length
    : 4500;

  const forecast: CashFlowForecastPeriod[] = [];
  let cumulative = historicalData?.reduce((sum, item) => sum + item.net, 0) ?? 0;

  const adjustmentFromAssumptions = assumptions?.length
    ? seededNumber(assumptions.join('|'), -0.08, 0.15)
    : 0;

  for (let i = 0; i < forecastPeriod; i++) {
    const growth = seededNumber(`${periodType}:${i}`, -0.05, 0.12) + adjustmentFromAssumptions;
    const inflows = baseNet * (1.2 + growth) + 5000;
    const outflows = inflows - baseNet;
    const net = inflows - outflows;
    cumulative += net;

    forecast.push({
      period: nextPeriodLabel(periodType, i, historicalData?.at(-1)?.period),
      projected_inflows: Number(inflows.toFixed(2)),
      projected_outflows: Number(outflows.toFixed(2)),
      net_cash_flow: Number(net.toFixed(2)),
      cumulative_cash: Number(cumulative.toFixed(2)),
      confidence_level: Number(Math.min(0.92, Math.max(0.58, 0.7 + growth)).toFixed(3)),
    });
  }

  const totalForecast = forecast.reduce((sum, item) => sum + item.net_cash_flow, 0);

  const keyInsights = [
    `Average projected ${periodType} net cash flow: $${(totalForecast / forecastPeriod).toFixed(2)}.`,
    cumulative > 0
      ? 'Cumulative cash position remains positive across the forecast horizon.'
      : 'Cumulative cash position dips—plan ahead for lean periods.',
  ];

  const recommendations = [
    'Review assumptions quarterly and update forecasts with actual results.',
    'Automate follow-ups on invoices older than 15 days to protect inflows.',
  ];

  if (assumptions?.some(a => a.toLowerCase().includes('client'))) {
    recommendations.push('Onboard new clients with retainers to stabilise cash inflows.');
  }

  const riskFactors = [
    'Unexpected expense spikes could compress projected net cash.',
    'Late client payments remain the largest threat to forecast accuracy.',
  ];

  return {
    forecast_periods: forecast,
    total_forecast: Number(totalForecast.toFixed(2)),
    key_insights: keyInsights,
    recommendations,
    risk_factors: riskFactors,
    forecast_summary: {
      average_period_cash_flow: Number((totalForecast / forecastPeriod).toFixed(2)),
      best_case_scenario: Number((totalForecast * 1.18).toFixed(2)),
      worst_case_scenario: Number((totalForecast * 0.82).toFixed(2)),
    },
  };
}

export function ledgerFromTransactions(rows: Array<{
  type: TransactionType;
  amount: number;
  category: string;
  transaction_date?: string;
  currency?: string;
  exchange_rate?: number | null;
}>): LedgerEntry[] {
  return rows.map(row => {
    const currency = normalizeCurrency(row.currency);
    const exchangeRate = normalizeExchangeRate(currency, row.exchange_rate ?? undefined);
    const originalAmount = Number(Number(row.amount).toFixed(2));
    const baseAmount = toBaseCurrency(originalAmount, currency, exchangeRate);

    return {
      type: row.type,
      amount: baseAmount,
      category: row.category,
      date: row.transaction_date ?? new Date().toISOString().slice(0, 10),
      currency,
      exchange_rate: exchangeRate,
      base_currency: BASE_CURRENCY,
      original_amount: originalAmount,
    };
  });
}

export { summarizeLedger };

export function synthesizeLedger(seed: string, months = 6): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  const incomeCategories = Object.keys(INCOME_CATEGORIES) as string[];
  const expenseCategories = Object.keys(EXPENSE_CATEGORIES) as string[];
  const hash = deterministicHash(seed);
  const baseYear = 2022 + (parseInt(hash.slice(0, 2), 16) % 4);

  for (let i = 0; i < months; i++) {
    const month = ((parseInt(hash.slice(2 + i, 3 + i), 16) % 12) + 1);
    const incomeIndex = Math.max(0, Math.min(
      incomeCategories.length - 1,
      Math.floor(seededNumber(`${seed}:income:${i}`, 0, incomeCategories.length - 1.0001)),
    ));
    const expenseIndex = Math.max(0, Math.min(
      expenseCategories.length - 1,
      Math.floor(seededNumber(`${seed}:expense:${i}`, 0, expenseCategories.length - 1.0001)),
    ));
    const incomeCategory = incomeCategories[incomeIndex] ?? 'service_revenue';
    const expenseCategory = expenseCategories[expenseIndex] ?? 'other';

    const incomeAmount = Number(seededNumber(`${seed}:in:${i}`, 4200, 7800).toFixed(2));
    const expenseAmount = Number(seededNumber(`${seed}:out:${i}`, 1800, 3600).toFixed(2));
    const day = 10 + (i % 15);
    const date = `${baseYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    entries.push({
      type: 'income',
      amount: incomeAmount,
      category: incomeCategory,
      date,
      currency: BASE_CURRENCY,
      exchange_rate: 1,
      base_currency: BASE_CURRENCY,
      original_amount: incomeAmount,
    });

    entries.push({
      type: 'expense',
      amount: expenseAmount,
      category: expenseCategory,
      date,
      currency: BASE_CURRENCY,
      exchange_rate: 1,
      base_currency: BASE_CURRENCY,
      original_amount: expenseAmount,
    });
  }

  return entries;
}
