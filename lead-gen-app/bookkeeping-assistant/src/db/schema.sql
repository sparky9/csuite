-- Bookkeeping Assistant schema
-- Provides persistence for deterministic bookkeeping outputs.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS bk_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  reference TEXT,
  transaction_date DATE NOT NULL,
  currency TEXT DEFAULT 'USD',
  exchange_rate NUMERIC(10,4) DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_bk_transactions_user ON bk_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_bk_transactions_type ON bk_transactions(type);
CREATE INDEX IF NOT EXISTS idx_bk_transactions_date ON bk_transactions(transaction_date);

CREATE TABLE IF NOT EXISTS bk_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID REFERENCES bk_transactions(id) ON DELETE CASCADE,
  receipt_url TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bk_receipt_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID REFERENCES bk_transactions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER,
  mime_type TEXT,
  storage_url TEXT,
  image_data BYTEA,
  checksum TEXT NOT NULL,
  ocr_data JSONB,
  ocr_confidence NUMERIC(3,2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bk_receipts_transaction ON bk_receipt_attachments(transaction_id);

CREATE TABLE IF NOT EXISTS bk_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  invoice_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  issue_date DATE DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL,
  tax_rate NUMERIC(6,4) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'draft',
  notes TEXT,
  html_content TEXT,
  plain_text TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_bk_invoices_user ON bk_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_bk_invoices_client ON bk_invoices(client_name);

CREATE TABLE IF NOT EXISTS bk_invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES bk_invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS bk_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  report_type TEXT NOT NULL,
  period TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  summary JSONB NOT NULL,
  details JSONB,
  recommendations TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bk_reports_user ON bk_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_bk_reports_type ON bk_reports(report_type);

CREATE TABLE IF NOT EXISTS bk_report_exports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  report_type TEXT NOT NULL,
  format TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  file_path TEXT,
  download_url TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bk_report_exports_user ON bk_report_exports(user_id);

CREATE TABLE IF NOT EXISTS bk_tax_estimations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  tax_year INT NOT NULL,
  include_deductions BOOLEAN DEFAULT false,
  total_income NUMERIC(12,2) NOT NULL,
  total_expenses NUMERIC(12,2) NOT NULL,
  taxable_income NUMERIC(12,2) NOT NULL,
  estimated_tax NUMERIC(12,2) NOT NULL,
  deductions JSONB DEFAULT '{}'::jsonb,
  recommendations TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bk_tax_estimations_user ON bk_tax_estimations(user_id);
CREATE INDEX IF NOT EXISTS idx_bk_tax_estimations_year ON bk_tax_estimations(tax_year);

CREATE TABLE IF NOT EXISTS bk_budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  period TEXT NOT NULL,
  total_budget NUMERIC(12,2) NOT NULL,
  budget_breakdown JSONB NOT NULL,
  recommendations TEXT[] DEFAULT '{}',
  projected_savings TEXT[] DEFAULT '{}',
  warnings TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bk_budgets_user ON bk_budgets(user_id);

CREATE TABLE IF NOT EXISTS bk_cashflow_forecasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  period_type TEXT NOT NULL,
  forecast_period INT NOT NULL,
  forecast_periods JSONB NOT NULL,
  total_forecast NUMERIC(12,2) NOT NULL,
  key_insights TEXT[] DEFAULT '{}',
  recommendations TEXT[] DEFAULT '{}',
  risk_factors TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bk_cashflow_user ON bk_cashflow_forecasts(user_id);

CREATE TABLE IF NOT EXISTS bk_categorization_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  raw_transaction TEXT NOT NULL,
  suggested_category TEXT NOT NULL,
  confidence NUMERIC(4,3) NOT NULL,
  reasoning TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bk_categorization_user ON bk_categorization_suggestions(user_id);

CREATE TABLE IF NOT EXISTS bk_reconciliations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  reconciliation_status TEXT NOT NULL,
  totals JSONB NOT NULL,
  discrepancies TEXT[] DEFAULT '{}',
  matched JSONB,
  unmatched_bank JSONB,
  unmatched_records JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bk_reconciliations_user ON bk_reconciliations(user_id);

CREATE TABLE IF NOT EXISTS bk_transaction_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID REFERENCES bk_transactions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  changes JSONB NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bk_audit_log_transaction ON bk_transaction_audit_log(transaction_id);
