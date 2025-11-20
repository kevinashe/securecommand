/*
  # Add Pricing Plans System

  1. New Tables
    - `pricing_plans`
      - `id` (uuid, primary key)
      - `name` (text) - plan name (e.g., Basic, Professional, Enterprise)
      - `description` (text) - plan description
      - `monthly_price` (decimal) - monthly price
      - `yearly_price` (decimal) - yearly price (discounted)
      - `currency` (text) - currency code (USD, EUR, etc.)
      - `features` (jsonb) - array of plan features
      - `max_users` (integer) - maximum users allowed (-1 for unlimited)
      - `max_sites` (integer) - maximum sites allowed (-1 for unlimited)
      - `max_guards` (integer) - maximum guards allowed (-1 for unlimited)
      - `is_active` (boolean) - whether plan is available for purchase
      - `is_featured` (boolean) - whether to highlight this plan
      - `display_order` (integer) - order to display plans
      - `stripe_monthly_price_id` (text) - Stripe price ID for monthly billing
      - `stripe_yearly_price_id` (text) - Stripe price ID for yearly billing
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on pricing_plans table
    - Super admins can manage all pricing plans
    - All authenticated users can view active pricing plans (for selection)
    - Public users can view active pricing plans (for marketing page)

  3. Default Plans
    - Insert 3 default pricing plans (Basic, Professional, Enterprise)

  4. Notes
    - Pricing plans are global and apply to all companies
    - Companies subscribe to a plan via the billing system
    - Plans can be updated without affecting existing subscriptions
*/

-- Create pricing_plans table
CREATE TABLE IF NOT EXISTS pricing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  monthly_price decimal(10, 2) NOT NULL DEFAULT 0,
  yearly_price decimal(10, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  features jsonb DEFAULT '[]'::jsonb,
  max_users integer DEFAULT -1,
  max_sites integer DEFAULT -1,
  max_guards integer DEFAULT -1,
  is_active boolean DEFAULT true,
  is_featured boolean DEFAULT false,
  display_order integer DEFAULT 0,
  stripe_monthly_price_id text,
  stripe_yearly_price_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_pricing_plans_active ON pricing_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_pricing_plans_display_order ON pricing_plans(display_order);

-- Enable RLS
ALTER TABLE pricing_plans ENABLE ROW LEVEL SECURITY;

-- Super admins can manage all pricing plans
CREATE POLICY "Super admins can manage pricing plans"
  ON pricing_plans FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- All authenticated users can view active pricing plans
CREATE POLICY "Authenticated users can view active pricing plans"
  ON pricing_plans FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Public users can view active pricing plans (for marketing)
CREATE POLICY "Public can view active pricing plans"
  ON pricing_plans FOR SELECT
  TO anon
  USING (is_active = true);

-- Insert default pricing plans
INSERT INTO pricing_plans (name, description, monthly_price, yearly_price, features, max_users, max_sites, max_guards, is_active, is_featured, display_order)
VALUES 
  (
    'Basic',
    'Perfect for small security teams just getting started',
    29.99,
    299.99,
    '["Up to 10 guards", "Up to 3 sites", "Basic incident reporting", "Shift scheduling", "Mobile check-ins", "Email support", "Basic analytics"]'::jsonb,
    5,
    3,
    10,
    true,
    false,
    1
  ),
  (
    'Professional',
    'Ideal for growing security companies with multiple sites',
    99.99,
    999.99,
    '["Up to 50 guards", "Up to 15 sites", "Advanced incident reporting", "Shift scheduling & management", "Mobile check-ins with photos", "GPS tracking", "Patrol route management", "Equipment tracking", "Priority email & phone support", "Advanced analytics & reports", "Audit logs", "Custom branding"]'::jsonb,
    25,
    15,
    50,
    true,
    true,
    2
  ),
  (
    'Enterprise',
    'Comprehensive solution for large security operations',
    299.99,
    2999.99,
    '["Unlimited guards", "Unlimited sites", "Advanced incident reporting with AI insights", "Shift scheduling & management", "Mobile check-ins with photos & video", "Real-time GPS tracking", "Advanced patrol route management", "Equipment & asset tracking", "SOS alerts & emergency response", "Dedicated account manager", "24/7 priority support", "Advanced analytics & custom reports", "Complete audit trail", "Custom branding & white-label options", "API access", "Custom integrations", "Training & onboarding"]'::jsonb,
    -1,
    -1,
    -1,
    true,
    false,
    3
  )
ON CONFLICT DO NOTHING;
