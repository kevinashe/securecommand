/*
  # Fix audit_logs and add remaining tables

  1. Modified Tables
    - `audit_logs` - Add missing `company_id` column
  
  2. New Tables
    - `integration_webhooks` - Webhook configurations for external integrations
    - `webhook_delivery_logs` - Log of webhook delivery attempts
    - `client_report_schedules` - Automated client report configurations
    - `coverage_requests` - Client requests for extra security coverage
    - `push_subscriptions` - PWA push notification subscriptions
  
  3. Modified Tables
    - `sites` - Add `geofence_radius` column (default 200m)

  4. Security
    - RLS enabled on all tables with role-based policies
*/

-- Fix audit_logs: add company_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- RLS for audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'Company admins can view audit logs') THEN
    CREATE POLICY "Company admins can view audit logs"
      ON audit_logs FOR SELECT
      TO authenticated
      USING (
        company_id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid())
        AND (SELECT p.role FROM profiles p WHERE p.id = auth.uid()) IN ('company_admin', 'super_admin')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'Authenticated users can insert audit logs') THEN
    CREATE POLICY "Authenticated users can insert audit logs"
      ON audit_logs FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ========================
-- INTEGRATION WEBHOOKS
-- ========================
CREATE TABLE IF NOT EXISTS integration_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  secret text,
  events text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  last_triggered_at timestamptz,
  last_status_code integer,
  failure_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE integration_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhooks"
  ON integration_webhooks FOR SELECT
  TO authenticated
  USING (
    company_id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid())
    AND (SELECT p.role FROM profiles p WHERE p.id = auth.uid()) IN ('company_admin', 'super_admin')
  );

CREATE POLICY "Admins can insert webhooks"
  ON integration_webhooks FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid())
    AND (SELECT p.role FROM profiles p WHERE p.id = auth.uid()) IN ('company_admin', 'super_admin')
  );

CREATE POLICY "Admins can update webhooks"
  ON integration_webhooks FOR UPDATE
  TO authenticated
  USING (
    company_id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid())
    AND (SELECT p.role FROM profiles p WHERE p.id = auth.uid()) IN ('company_admin', 'super_admin')
  )
  WITH CHECK (
    company_id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "Admins can delete webhooks"
  ON integration_webhooks FOR DELETE
  TO authenticated
  USING (
    company_id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid())
    AND (SELECT p.role FROM profiles p WHERE p.id = auth.uid()) IN ('company_admin', 'super_admin')
  );

CREATE INDEX IF NOT EXISTS idx_integration_webhooks_company_id ON integration_webhooks(company_id);

-- ========================
-- WEBHOOK DELIVERY LOGS
-- ========================
CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES integration_webhooks(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  response_status integer,
  response_body text,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT false
);

ALTER TABLE webhook_delivery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Webhook owners can view delivery logs"
  ON webhook_delivery_logs FOR SELECT
  TO authenticated
  USING (
    webhook_id IN (
      SELECT wh.id FROM integration_webhooks wh
      WHERE wh.company_id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid())
    )
  );

CREATE POLICY "System can insert delivery logs"
  ON webhook_delivery_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    webhook_id IN (
      SELECT wh.id FROM integration_webhooks wh
      WHERE wh.company_id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid())
    )
  );

CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_webhook_id ON webhook_delivery_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_logs_delivered_at ON webhook_delivery_logs(delivered_at);

-- ========================
-- CLIENT REPORT SCHEDULES
-- ========================
CREATE TABLE IF NOT EXISTS client_report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES profiles(id),
  site_ids uuid[] NOT NULL DEFAULT '{}',
  frequency text NOT NULL DEFAULT 'weekly',
  day_of_week integer,
  include_incidents boolean NOT NULL DEFAULT true,
  include_patrols boolean NOT NULL DEFAULT true,
  include_attendance boolean NOT NULL DEFAULT true,
  include_logbook boolean NOT NULL DEFAULT true,
  email_recipients text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  last_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE client_report_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and clients can view report schedules"
  ON client_report_schedules FOR SELECT
  TO authenticated
  USING (
    client_id = auth.uid()
    OR (
      company_id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid())
      AND (SELECT p.role FROM profiles p WHERE p.id = auth.uid()) IN ('company_admin', 'site_manager', 'super_admin')
    )
  );

CREATE POLICY "Admins can insert report schedules"
  ON client_report_schedules FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid())
    AND (SELECT p.role FROM profiles p WHERE p.id = auth.uid()) IN ('company_admin', 'site_manager', 'super_admin')
  );

CREATE POLICY "Admins can update report schedules"
  ON client_report_schedules FOR UPDATE
  TO authenticated
  USING (
    company_id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid())
    AND (SELECT p.role FROM profiles p WHERE p.id = auth.uid()) IN ('company_admin', 'site_manager', 'super_admin')
  )
  WITH CHECK (
    company_id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "Admins can delete report schedules"
  ON client_report_schedules FOR DELETE
  TO authenticated
  USING (
    company_id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid())
    AND (SELECT p.role FROM profiles p WHERE p.id = auth.uid()) IN ('company_admin', 'super_admin')
  );

CREATE INDEX IF NOT EXISTS idx_client_report_schedules_company_id ON client_report_schedules(company_id);
CREATE INDEX IF NOT EXISTS idx_client_report_schedules_client_id ON client_report_schedules(client_id);

-- ========================
-- COVERAGE REQUESTS
-- ========================
CREATE TABLE IF NOT EXISTS coverage_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES profiles(id),
  site_id uuid NOT NULL REFERENCES sites(id),
  request_type text NOT NULL DEFAULT 'extra_coverage',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  requested_date date NOT NULL,
  requested_start_time time,
  requested_end_time time,
  guards_needed integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  responded_by uuid REFERENCES profiles(id),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coverage_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients and admins can view coverage requests"
  ON coverage_requests FOR SELECT
  TO authenticated
  USING (
    client_id = auth.uid()
    OR (
      company_id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid())
      AND (SELECT p.role FROM profiles p WHERE p.id = auth.uid()) IN ('company_admin', 'site_manager', 'super_admin')
    )
  );

CREATE POLICY "Clients can insert coverage requests"
  ON coverage_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id = auth.uid()
  );

CREATE POLICY "Admins can update coverage requests"
  ON coverage_requests FOR UPDATE
  TO authenticated
  USING (
    company_id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid())
    AND (SELECT p.role FROM profiles p WHERE p.id = auth.uid()) IN ('company_admin', 'site_manager', 'super_admin')
  )
  WITH CHECK (
    company_id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_coverage_requests_company_id ON coverage_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_coverage_requests_client_id ON coverage_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_coverage_requests_status ON coverage_requests(status);

-- ========================
-- PUSH SUBSCRIPTIONS
-- ========================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh_key text NOT NULL,
  auth_key text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own push subscriptions"
  ON push_subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own push subscriptions"
  ON push_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own push subscriptions"
  ON push_subscriptions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own push subscriptions"
  ON push_subscriptions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- ========================
-- ADD GEOFENCE RADIUS TO SITES
-- ========================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sites' AND column_name = 'geofence_radius'
  ) THEN
    ALTER TABLE sites ADD COLUMN geofence_radius integer NOT NULL DEFAULT 200;
  END IF;
END $$;
