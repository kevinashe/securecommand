/*
  # Automated Invoicing and Payment System

  1. New Tables
    - `invoices`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references companies)
      - `invoice_number` (text, unique)
      - `billing_period_start` (date)
      - `billing_period_end` (date)
      - `subtotal` (numeric)
      - `tax_amount` (numeric)
      - `total_amount` (numeric)
      - `status` (text) - 'draft', 'sent', 'paid', 'overdue', 'cancelled'
      - `due_date` (date)
      - `paid_date` (date, nullable)
      - `notes` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `invoice_items`
      - `id` (uuid, primary key)
      - `invoice_id` (uuid, references invoices)
      - `description` (text)
      - `quantity` (numeric)
      - `unit_price` (numeric)
      - `amount` (numeric)
      - `shift_id` (uuid, references shifts, nullable)
      - `created_at` (timestamptz)
    
    - `payment_transactions`
      - `id` (uuid, primary key)
      - `invoice_id` (uuid, references invoices)
      - `payment_method_id` (uuid, references payment_methods, nullable)
      - `amount` (numeric)
      - `transaction_id` (text, nullable)
      - `status` (text) - 'pending', 'completed', 'failed', 'refunded'
      - `payment_date` (timestamptz)
      - `notes` (text, nullable)
      - `created_at` (timestamptz)
    
    - `billing_rates`
      - `id` (uuid, primary key)
      - `company_id` (uuid, references companies)
      - `rate_type` (text) - 'hourly', 'daily', 'fixed', 'per_guard'
      - `rate_amount` (numeric)
      - `description` (text, nullable)
      - `is_active` (boolean)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for company admins and super admins

  3. Indexes
    - Performance optimization
*/

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  invoice_number text UNIQUE NOT NULL DEFAULT '',
  billing_period_start date NOT NULL,
  billing_period_end date NOT NULL,
  subtotal numeric(10, 2) DEFAULT 0,
  tax_amount numeric(10, 2) DEFAULT 0,
  total_amount numeric(10, 2) DEFAULT 0,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  due_date date NOT NULL,
  paid_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company admins can view own invoices"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Company admins can manage invoices"
  ON invoices FOR ALL
  TO authenticated
  USING (
    (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'company_admin'))
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);

-- Invoice Items
CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  description text NOT NULL,
  quantity numeric(10, 2) DEFAULT 1,
  unit_price numeric(10, 2) NOT NULL,
  amount numeric(10, 2) NOT NULL,
  shift_id uuid REFERENCES shifts(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invoice items"
  ON invoice_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_items.invoice_id
      AND (
        invoices.company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
      )
    )
  );

CREATE POLICY "Company admins can manage invoice items"
  ON invoice_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      JOIN profiles ON profiles.id = auth.uid()
      WHERE invoices.id = invoice_items.invoice_id
      AND (
        (invoices.company_id = profiles.company_id AND profiles.role = 'company_admin')
        OR profiles.role = 'super_admin'
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_shift ON invoice_items(shift_id);

-- Payment Transactions
CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  payment_method_id uuid REFERENCES payment_methods(id) ON DELETE SET NULL,
  amount numeric(10, 2) NOT NULL,
  transaction_id text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_date timestamptz DEFAULT now(),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view payment transactions"
  ON payment_transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = payment_transactions.invoice_id
      AND (
        invoices.company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
      )
    )
  );

CREATE POLICY "Company admins can manage transactions"
  ON payment_transactions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      JOIN profiles ON profiles.id = auth.uid()
      WHERE invoices.id = payment_transactions.invoice_id
      AND (
        (invoices.company_id = profiles.company_id AND profiles.role = 'company_admin')
        OR profiles.role = 'super_admin'
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_payment_transactions_invoice ON payment_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);

-- Billing Rates
CREATE TABLE IF NOT EXISTS billing_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  rate_type text NOT NULL CHECK (rate_type IN ('hourly', 'daily', 'fixed', 'per_guard')),
  rate_amount numeric(10, 2) NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE billing_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view billing rates"
  ON billing_rates FOR SELECT
  TO authenticated
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Company admins can manage billing rates"
  ON billing_rates FOR ALL
  TO authenticated
  USING (
    (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role = 'company_admin'))
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE INDEX IF NOT EXISTS idx_billing_rates_company ON billing_rates(company_id);

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'INV-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(NEXTVAL('invoice_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'invoice_number_seq') THEN
    CREATE SEQUENCE invoice_number_seq START 1000;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trigger_generate_invoice_number ON invoices;
CREATE TRIGGER trigger_generate_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION generate_invoice_number();

-- Function to update invoice totals
CREATE OR REPLACE FUNCTION update_invoice_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE invoices
  SET 
    subtotal = (
      SELECT COALESCE(SUM(amount), 0)
      FROM invoice_items
      WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
    ),
    total_amount = (
      SELECT COALESCE(SUM(amount), 0) + COALESCE(tax_amount, 0)
      FROM invoice_items
      WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
    ),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_invoice_totals ON invoice_items;
CREATE TRIGGER trigger_update_invoice_totals
  AFTER INSERT OR UPDATE OR DELETE ON invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_totals();
