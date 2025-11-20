/*
  # Add Payment Gateway System

  1. New Tables
    - `payment_gateways`
      - `id` (uuid, primary key)
      - `name` (text) - Gateway name (stripe, paypal, square, manual)
      - `display_name` (text) - User-friendly name
      - `is_enabled` (boolean) - Whether this gateway is active
      - `configuration` (jsonb) - Gateway-specific settings (encrypted keys, etc)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `payment_methods`
      - `id` (uuid, primary key)
      - `company_id` (uuid, foreign key)
      - `gateway_id` (uuid, foreign key)
      - `type` (text) - card, bank_account, wallet, manual
      - `details` (jsonb) - Encrypted payment method details
      - `is_default` (boolean)
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `payment_transactions`
      - `id` (uuid, primary key)
      - `invoice_id` (uuid, foreign key)
      - `company_id` (uuid, foreign key)
      - `payment_method_id` (uuid, foreign key, nullable)
      - `gateway_id` (uuid, foreign key)
      - `amount` (numeric)
      - `currency` (text)
      - `status` (text) - pending, processing, completed, failed, refunded
      - `gateway_transaction_id` (text) - External transaction ID
      - `gateway_response` (jsonb) - Full gateway response
      - `error_message` (text)
      - `processed_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all new tables
    - Super admins can manage all payment data
    - Company admins can view their own payment data
    - Companies can manage their own payment methods

  3. Initial Data
    - Insert default payment gateways (Stripe, PayPal, Square, Manual)
*/

-- Payment Gateways Table
CREATE TABLE IF NOT EXISTS payment_gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  is_enabled boolean DEFAULT false,
  configuration jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE payment_gateways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage payment gateways"
  ON payment_gateways
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "All authenticated users can view enabled gateways"
  ON payment_gateways
  FOR SELECT
  TO authenticated
  USING (is_enabled = true);

-- Payment Methods Table
CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  gateway_id uuid NOT NULL REFERENCES payment_gateways(id) ON DELETE CASCADE,
  type text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage all payment methods"
  ON payment_methods
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Company admins can manage their payment methods"
  ON payment_methods
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.company_id = payment_methods.company_id
      AND profiles.role IN ('company_admin', 'super_admin')
    )
  );

-- Payment Transactions Table
CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  payment_method_id uuid REFERENCES payment_methods(id) ON DELETE SET NULL,
  gateway_id uuid NOT NULL REFERENCES payment_gateways(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  currency text DEFAULT 'USD',
  status text DEFAULT 'pending',
  gateway_transaction_id text,
  gateway_response jsonb DEFAULT '{}'::jsonb,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage all transactions"
  ON payment_transactions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Company users can view their transactions"
  ON payment_transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.company_id = payment_transactions.company_id
    )
  );

CREATE POLICY "Company admins can create transactions"
  ON payment_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.company_id = payment_transactions.company_id
      AND profiles.role IN ('company_admin', 'super_admin')
    )
  );

-- Insert default payment gateways
INSERT INTO payment_gateways (name, display_name, is_enabled) VALUES
  ('stripe', 'Stripe', true),
  ('paypal', 'PayPal', true),
  ('square', 'Square', false),
  ('manual', 'Manual Payment', true)
ON CONFLICT (name) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payment_methods_company ON payment_methods(company_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_gateway ON payment_methods(gateway_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_invoice ON payment_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_company ON payment_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created ON payment_transactions(created_at DESC);
