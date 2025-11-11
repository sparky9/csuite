import {
  handleAddTransaction,
  handleTrackExpense,
  handleGenerateInvoice,
  handleGenerateReport,
  handleCalculateTax,
  handleCategorizeTransactions,
  handleBudgetPlanning,
  handleCashFlowForecast,
  handleReconcileAccounts,
} from '../src/tools/index.js';

function divider(title: string): void {
  const line = '='.repeat(72);
  console.log(`\n${line}`);
  console.log(title.toUpperCase());
  console.log(line);
}

async function runAddTransactionTest(): Promise<void> {
  divider('Add transaction');
  const response = await handleAddTransaction({
    type: 'expense',
    amount: 150,
    description: 'Office supplies purchase',
    category: 'office_supplies',
    date: '2024-01-15',
    reference: 'INV-001',
  });
  console.log(response.content?.[0]?.text ?? response);
}

async function runTrackExpenseTest(): Promise<void> {
  divider('Track expense');
  const response = await handleTrackExpense({
    amount: 45.99,
    description: 'Software subscription',
    category: 'software',
    date: '2024-01-20',
    receipt_url: 'https://example.com/receipt.pdf',
    notes: 'Monthly Adobe subscription',
  });
  console.log(response.content?.[0]?.text ?? response);
}

async function runInvoiceTest(): Promise<void> {
  divider('Generate invoice');
  const response = await handleGenerateInvoice({
    client_name: 'Acme Corp',
    client_email: 'billing@acme.com',
    items: [
      { description: 'Web Development Services', quantity: 40, unit_price: 100, total: 4000 },
    ],
    due_date: '2024-02-15',
    tax_rate: 0.1,
    notes: 'Payment due within 30 days',
  });
  console.log(response.content?.[0]?.text ?? response);
}

async function runReportTest(): Promise<void> {
  divider('Generate report');
  const response = await handleGenerateReport({
    type: 'profit_loss',
    period: 'monthly',
    start_date: '2024-01-01',
    end_date: '2024-01-31',
    include_details: true,
  });
  console.log(response.content?.[0]?.text ?? response);
}

async function runTaxTest(): Promise<void> {
  divider('Calculate tax');
  const response = await handleCalculateTax({
    year: 2024,
    include_deductions: true,
  });
  console.log(response.content?.[0]?.text ?? response);
}

async function runCategorizationTest(): Promise<void> {
  divider('Categorize transactions');
  const response = await handleCategorizeTransactions({
    transactions: [
      'Office Depot purchase - $87.34',
      'Stripe payout - $1,250.00',
      'HubSpot subscription renewal - $99.00',
    ],
  });
  console.log(response.content?.[0]?.text ?? response);
}

async function runBudgetPlanningTest(): Promise<void> {
  divider('Budget planning');
  const response = await handleBudgetPlanning({
    budget_period: 'monthly',
    total_budget: 5000,
    categories: ['office_supplies', 'software', 'marketing'],
    goals: ['Save 20% of income', 'Reduce software costs'],
  });
  console.log(response.content?.[0]?.text ?? response);
}

async function runCashFlowForecastTest(): Promise<void> {
  divider('Cash flow forecast');
  const response = await handleCashFlowForecast({
    forecast_period: 6,
    period_type: 'monthly',
    historical_data: [
      { period: '2024-01', inflows: 15000, outflows: 8000, net: 7000 },
      { period: '2024-02', inflows: 12000, outflows: 9000, net: 3000 },
    ],
    assumptions: ['New client acquisition in Q2', 'Seasonal business slowdown in summer'],
  });
  console.log(response.content?.[0]?.text ?? response);
}

async function runReconciliationTest(): Promise<void> {
  divider('Reconcile accounts');
  const response = await handleReconcileAccounts({
    bank_statement: [
      { date: '2024-01-15', description: 'Office supplies', amount: -45.67 },
      { date: '2024-01-16', description: 'Client payment', amount: 1500 },
    ],
    recorded_transactions: [
      { date: '2024-01-15', description: 'Office supplies purchase', amount: 45.67, category: 'office_supplies' },
      { date: '2024-01-16', description: 'Invoice payment', amount: 1500, category: 'service_revenue' },
    ],
  });
  console.log(response.content?.[0]?.text ?? response);
}

async function main(): Promise<void> {
  divider('Bookkeeping assistant deterministic smoke test');

  await runAddTransactionTest();
  await runTrackExpenseTest();
  await runInvoiceTest();
  await runReportTest();
  await runTaxTest();
  await runCategorizationTest();
  await runBudgetPlanningTest();
  await runCashFlowForecastTest();
  await runReconciliationTest();

  console.log('\nSmoke test complete.');
}

main().catch((error) => {
  console.error('Smoke test failed:', error);
  process.exitCode = 1;
});
