# Bookkeeping Assistant MCP

Deterministic bookkeeping tools for solopreneurs. Track expenses, generate invoices, create financial reports, and calculate taxes without relying on external AI APIs.

## Features

- **Transaction Management**: Categorize and store income/expense transactions using repeatable heuristics
- **Invoice Generation**: Build professional invoices with templated HTML, tax handling, and database persistence
- **Expense Tracking**: Record expenses with receipts/notes while keeping transaction history synced
- **Receipt OCR**: Upload receipts, extract vendors/amounts, and optionally auto-book expenses with attachment storage
- **Financial Reporting**: Produce profit & loss, cash flow, balance sheet, and tax summaries based on your ledger
- **Multi-Currency Support**: Track native currency amounts with automatic USD conversion for reporting
- **Tax Calculations**: Estimate liabilities using deterministic brackets and deduction rules
- **Account Reconciliation**: Compare bank statements with recorded transactions and flag mismatches
- **Budget Planning**: Allocate budgets using historical trends, goals, and deterministic ratio templates
- **Cash Flow Forecasting**: Project inflows/outflows with seeded scenario analysis and recommendation engine
- **Report Exports & Audit Trails**: Export reports to PDF/Excel/CSV and review transaction change history for compliance

## Installation

1. Navigate to the bookkeeping-assistant directory:

   ```bash
   cd bookkeeping-assistant
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:

   ```bash
   cp .env.example .env
   ```

   Update `.env` with a valid `DATABASE_URL` (Neon, Supabase, or local Postgres all work).

4. Apply the bookkeeping schema (optional but recommended):

   ```bash
   npm run db:setup
   ```

5. Build the project:

   ```bash
   npm run build
   ```

## Usage

### Development

Run in development mode with hot reload:

```bash
npm run dev
```

### Production

Build and run:

```bash
npm run build
npm start
```

### Testing

Run the smoke-test script to exercise the deterministic generators:

```bash
npm test
```

## Tools

### add_transaction

Add income or expense transactions to your bookkeeping records.

**Parameters:**

- `type`: Transaction type (income, expense, transfer)
- `amount`: Transaction amount
- `description`: Transaction description
- `category`: Transaction category
- `date`: Transaction date (YYYY-MM-DD)
- `reference`: Reference number (optional)
- `currency`: 3-letter currency code (optional, defaults to USD)
- `exchange_rate`: Exchange rate to USD (optional)

### generate_invoice

Generate professional invoices for clients.

**Parameters:**

- `client_name`: Client name
- `client_email`: Client email
- `items`: Array of invoice items
- `due_date`: Due date (YYYY-MM-DD)
- `notes`: Additional notes (optional)
- `tax_rate`: Tax rate (optional)

### track_expense

Track business expenses with categories and receipts.

**Parameters:**

- `amount`: Expense amount
- `description`: Expense description
- `category`: Expense category
- `date`: Expense date (YYYY-MM-DD)
- `receipt_url`: Receipt URL (optional)
- `notes`: Additional notes (optional)
- `currency`: 3-letter currency code (optional, defaults to USD)
- `exchange_rate`: Exchange rate to USD (optional)

### generate_report

Generate financial reports.

**Parameters:**

- `type`: Report type (profit_loss, cash_flow, balance_sheet, tax_summary)
- `period`: Report period (monthly, quarterly, yearly)
- `start_date`: Start date (YYYY-MM-DD)
- `end_date`: End date (YYYY-MM-DD)
- `include_details`: Include detailed breakdowns (optional)

### calculate_tax

Calculate estimated taxes.

**Parameters:**

- `year`: Tax year
- `include_deductions`: Include deductions (optional)

### categorize_transactions

AI-powered categorization of transactions for better organization.

**Parameters:**

- `transactions`: Array of transaction descriptions to categorize

### reconcile_accounts

Reconcile bank statements with recorded transactions.

**Parameters:**

- `bank_statement`: Array of bank statement entries
- `recorded_transactions`: Array of recorded transactions

### budget_planning

Create and manage budgets with AI recommendations.

**Parameters:**

- `budget_period`: Budget period (monthly, quarterly, yearly)
- `total_budget`: Total budget amount
- `categories`: Budget categories (optional)
- `historical_data`: Historical spending data (optional)
- `goals`: Financial goals (optional)

### cash_flow_forecast

Forecast future cash flow based on historical data and trends.

**Parameters:**

- `forecast_period`: Number of periods to forecast
- `period_type`: Type of period (monthly, quarterly, yearly)
- `historical_data`: Historical cash flow data (optional)
- `assumptions`: Business assumptions (optional)

### scan_receipt

Upload a receipt image, extract key transaction data, and optionally auto-create an expense.

**Parameters:**

- `userId`: User identifier for storage separation
- `imageBase64`: Base64 encoded receipt image (PNG/JPG/PDF)
- `autoCreateTransaction`: Automatically create an expense (default true)
- `fileName`: Optional filename for local storage
- `mimeType`: Image MIME type (default image/png)
- `storeImage`: Persist binary data in the database (default true)

### export_report

Generate a financial report and export it as PDF, Excel-compatible SpreadsheetML, or CSV.

**Parameters:**

- `userId`: User identifier for ledger scoping
- `reportType`: Report type (profit_loss, cash_flow, balance_sheet, tax_summary)
- `startDate`: Report start date (YYYY-MM-DD)
- `endDate`: Report end date (YYYY-MM-DD)
- `format`: Export format (pdf, excel, csv). Defaults to pdf.

### get_audit_trail

Retrieve the change history for a specific transaction with versioning metadata.

**Parameters:**

- `transactionId`: Transaction database identifier (UUID)

## Configuration

- `DATABASE_URL`: PostgreSQL connection string. Required if you want to persist outputs; otherwise the server runs in memory.
- `LOG_LEVEL`: Logging level (`info` by default).
- `NODE_ENV`: Standard Node environment flag (optional).

### Logging

Logs are written to:

- `bookkeeping-assistant.log` (all logs)
- `bookkeeping-assistant-error.log` (errors only)
- `bookkeeping-assistant-exceptions.log` (uncaught exceptions)
- Console output with colors

## Integration with Claude Desktop

This MCP server integrates with Claude Desktop to provide deterministic bookkeeping tools directly in your AI workflow. Once running, you can use the tools in your conversations with Claude without configuring any external AI providers.

## License

ISC
