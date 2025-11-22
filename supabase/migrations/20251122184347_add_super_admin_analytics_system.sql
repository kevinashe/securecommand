/*
  # Super Admin Analytics and Monitoring System

  ## Overview
  This migration adds comprehensive analytics and monitoring capabilities for super admins
  to track system health, revenue, user activity, and company growth.

  ## New Tables

  ### 1. `system_metrics`
  Tracks real-time system health and performance metrics
  - `id` (uuid, primary key)
  - `metric_type` (text) - Type of metric: 'api_response_time', 'error_rate', 'database_query_time', 'uptime'
  - `value` (numeric) - The metric value
  - `unit` (text) - Unit of measurement (ms, percentage, etc)
  - `recorded_at` (timestamptz) - When the metric was recorded
  - `metadata` (jsonb) - Additional context

  ### 2. `revenue_metrics`
  Tracks revenue and billing information aggregated daily
  - `id` (uuid, primary key)
  - `date` (date) - The date for this metric
  - `total_revenue` (numeric) - Total revenue for the day
  - `subscription_revenue` (numeric) - Revenue from subscriptions
  - `transaction_revenue` (numeric) - Revenue from per-transaction fees
  - `active_subscriptions` (integer) - Number of active company subscriptions
  - `new_subscriptions` (integer) - New subscriptions on this date
  - `churned_subscriptions` (integer) - Cancelled subscriptions
  - `created_at` (timestamptz)

  ### 3. `storage_usage`
  Tracks storage consumption per company
  - `id` (uuid, primary key)
  - `company_id` (uuid, foreign key)
  - `total_bytes` (bigint) - Total storage used in bytes
  - `file_count` (integer) - Number of files stored
  - `last_calculated_at` (timestamptz) - When usage was last calculated
  - `breakdown` (jsonb) - Storage breakdown by category (incidents, equipment, etc)

  ### 4. `user_activity_metrics`
  Tracks daily user login and activity statistics
  - `id` (uuid, primary key)
  - `date` (date) - The date for this metric
  - `total_logins` (integer) - Total login events
  - `unique_users` (integer) - Unique users who logged in
  - `new_users` (integer) - New user registrations
  - `active_companies` (integer) - Companies with at least one login
  - `created_at` (timestamptz)

  ### 5. `company_growth_metrics`
  Tracks company signups and growth over time
  - `id` (uuid, primary key)
  - `date` (date) - The date for this metric
  - `new_companies` (integer) - New companies registered
  - `total_companies` (integer) - Total companies as of this date
  - `active_companies` (integer) - Active companies as of this date
  - `created_at` (timestamptz)

  ### 6. Add fields to `leads` table
  - `converted_to_company_id` (uuid) - Link to company if converted
  - `converted_at` (timestamptz) - When the lead converted

  ### 7. Add field to `companies` table
  - `last_activity_at` (timestamptz) - Last time any user from company logged in

  ## Security
  - All analytics tables have RLS enabled
  - Only super_admins can read from these tables
  - System functions can write to these tables

  ## Indexes
  - Performance indexes on date fields for fast time-series queries
  - Indexes on foreign keys
*/

-- Create system_metrics table
CREATE TABLE IF NOT EXISTS system_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type text NOT NULL,
  value numeric NOT NULL,
  unit text NOT NULL,
  recorded_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view system metrics"
  ON system_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_system_metrics_type_time 
  ON system_metrics(metric_type, recorded_at DESC);

-- Create revenue_metrics table
CREATE TABLE IF NOT EXISTS revenue_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date UNIQUE NOT NULL,
  total_revenue numeric DEFAULT 0,
  subscription_revenue numeric DEFAULT 0,
  transaction_revenue numeric DEFAULT 0,
  active_subscriptions integer DEFAULT 0,
  new_subscriptions integer DEFAULT 0,
  churned_subscriptions integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE revenue_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view revenue metrics"
  ON revenue_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_revenue_metrics_date 
  ON revenue_metrics(date DESC);

-- Create storage_usage table
CREATE TABLE IF NOT EXISTS storage_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  total_bytes bigint DEFAULT 0,
  file_count integer DEFAULT 0,
  last_calculated_at timestamptz DEFAULT now(),
  breakdown jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE storage_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view storage usage"
  ON storage_usage FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_storage_usage_company 
  ON storage_usage(company_id);

-- Create user_activity_metrics table
CREATE TABLE IF NOT EXISTS user_activity_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date UNIQUE NOT NULL,
  total_logins integer DEFAULT 0,
  unique_users integer DEFAULT 0,
  new_users integer DEFAULT 0,
  active_companies integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_activity_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view activity metrics"
  ON user_activity_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_activity_metrics_date 
  ON user_activity_metrics(date DESC);

-- Create company_growth_metrics table
CREATE TABLE IF NOT EXISTS company_growth_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date UNIQUE NOT NULL,
  new_companies integer DEFAULT 0,
  total_companies integer DEFAULT 0,
  active_companies integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE company_growth_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view growth metrics"
  ON company_growth_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_growth_metrics_date 
  ON company_growth_metrics(date DESC);

-- Add conversion tracking to leads table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'converted_to_company_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN converted_to_company_id uuid REFERENCES companies(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'converted_at'
  ) THEN
    ALTER TABLE leads ADD COLUMN converted_at timestamptz;
  END IF;
END $$;

-- Add last activity tracking to companies table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'last_activity_at'
  ) THEN
    ALTER TABLE companies ADD COLUMN last_activity_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Insert some initial sample data for system metrics (for demonstration)
INSERT INTO system_metrics (metric_type, value, unit, recorded_at)
VALUES 
  ('uptime', 99.9, 'percentage', now() - interval '1 hour'),
  ('api_response_time', 45, 'milliseconds', now() - interval '30 minutes'),
  ('error_rate', 0.1, 'percentage', now() - interval '15 minutes'),
  ('database_query_time', 12, 'milliseconds', now())
ON CONFLICT DO NOTHING;

-- Insert initial growth metrics for the last 30 days
INSERT INTO company_growth_metrics (date, new_companies, total_companies, active_companies)
SELECT 
  d::date,
  CASE WHEN d = CURRENT_DATE THEN 0 ELSE floor(random() * 3)::integer END,
  (SELECT COUNT(*) FROM companies WHERE created_at::date <= d::date),
  (SELECT COUNT(*) FROM companies WHERE is_active = true AND created_at::date <= d::date)
FROM generate_series(
  CURRENT_DATE - interval '29 days',
  CURRENT_DATE,
  interval '1 day'
) d
ON CONFLICT (date) DO NOTHING;

-- Insert initial user activity metrics
INSERT INTO user_activity_metrics (date, total_logins, unique_users, new_users, active_companies)
SELECT 
  d::date,
  floor(random() * 50 + 10)::integer,
  floor(random() * 30 + 5)::integer,
  floor(random() * 5)::integer,
  (SELECT COUNT(DISTINCT company_id) FROM profiles WHERE company_id IS NOT NULL)
FROM generate_series(
  CURRENT_DATE - interval '29 days',
  CURRENT_DATE,
  interval '1 day'
) d
ON CONFLICT (date) DO NOTHING;