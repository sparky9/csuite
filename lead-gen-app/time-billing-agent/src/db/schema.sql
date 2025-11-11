CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Time entries
CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  project_name TEXT NOT NULL,
  task_description TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  billable BOOLEAN DEFAULT true,
  invoiced BOOLEAN DEFAULT false,
  invoice_id UUID,
  hourly_rate NUMERIC(10,2),
  calculated_amount NUMERIC(10,2),
  notes TEXT,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_user ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_client ON time_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_time_entries_invoiced ON time_entries(invoiced);
CREATE INDEX IF NOT EXISTS idx_time_entries_invoice ON time_entries(invoice_id);

-- Rate cards
CREATE TABLE IF NOT EXISTS billing_rate_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  client_id TEXT,
  project_name TEXT,
  hourly_rate NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  effective_date DATE DEFAULT CURRENT_DATE,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_cards_user ON billing_rate_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_cards_client ON billing_rate_cards(client_id);
CREATE INDEX IF NOT EXISTS idx_rate_cards_project ON billing_rate_cards(project_name);

-- Invoices
CREATE TABLE IF NOT EXISTS billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  client_id TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  subtotal NUMERIC(10,2) NOT NULL,
  tax_rate NUMERIC(5,2) DEFAULT 0,
  tax_amount NUMERIC(10,2) DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL,
  amount_paid NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  delivery_method TEXT,
  recipient_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_user ON billing_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON billing_invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON billing_invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON billing_invoices(due_date);

-- Payments
CREATE TABLE IF NOT EXISTS billing_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES billing_invoices(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method TEXT NOT NULL,
  transaction_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON billing_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON billing_payments(user_id);

-- Payment reminders
CREATE TABLE IF NOT EXISTS billing_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES billing_invoices(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  tone TEXT NOT NULL,
  subject TEXT NOT NULL,
  message_body TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_invoice ON billing_reminders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_reminders_user ON billing_reminders(user_id);

-- Audit log
CREATE TABLE IF NOT EXISTS billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_user ON billing_events(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_type ON billing_events(event_type);

-- Trigger to maintain updated_at timestamps
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
    'time_entries',
    'billing_rate_cards',
    'billing_invoices',
    'billing_payments',
    'billing_reminders'
  ) LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I',
      rec.tablename,
      rec.tablename
    );
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      rec.tablename,
      rec.tablename
    );
  END LOOP;
END;
$$;
