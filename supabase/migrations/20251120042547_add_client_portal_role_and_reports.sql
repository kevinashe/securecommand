/*
  # Add Client Portal Role and Automated Reports
  
  1. Changes to Existing Types
    - Add 'client' role to user_role enum for client portal access
  
  2. New Tables
    - `client_access`
      - Maps client users to specific sites they can view
      - Allows granular access control per site
    
    - `scheduled_reports`
      - Configuration for automated daily/weekly reports
      - Email recipients and report types
  
  3. Security
    - Enable RLS on new tables
    - Clients can only view their assigned sites' data
    - Company admins manage client access
  
  4. Notes
    - Clients have read-only access to incidents, shifts, and reports
    - Automated reports will be sent via edge function
*/

-- Add client role to user_role enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid 
    WHERE t.typname = 'user_role' AND e.enumlabel = 'client'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'client';
  END IF;
END $$;

-- Create client access mapping table
CREATE TABLE IF NOT EXISTS client_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  access_level text DEFAULT 'read_only',
  can_view_incidents boolean DEFAULT true,
  can_view_shifts boolean DEFAULT true,
  can_view_reports boolean DEFAULT true,
  can_view_guards boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id, site_id)
);

COMMENT ON TABLE client_access IS 'Manages which sites client users can access';

-- Create scheduled reports table
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  site_id uuid REFERENCES sites(id) ON DELETE CASCADE,
  report_type text NOT NULL,
  frequency text NOT NULL DEFAULT 'daily',
  recipients jsonb NOT NULL DEFAULT '[]',
  include_incidents boolean DEFAULT true,
  include_shifts boolean DEFAULT true,
  include_analytics boolean DEFAULT true,
  is_active boolean DEFAULT true,
  last_sent_at timestamptz,
  next_scheduled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE scheduled_reports IS 'Configuration for automated email reports';
COMMENT ON COLUMN scheduled_reports.frequency IS 'daily, weekly, or monthly';
COMMENT ON COLUMN scheduled_reports.recipients IS 'Array of email addresses to receive reports';

-- Enable RLS
ALTER TABLE client_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;

-- Policies for client_access
CREATE POLICY "Clients can view own access"
  ON client_access
  FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "Company admins can manage client access"
  ON client_access
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.company_id = client_access.company_id
      AND p.role IN ('company_admin', 'super_admin')
    )
  );

-- Policies for scheduled_reports
CREATE POLICY "Company admins can view own reports"
  ON scheduled_reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.company_id = scheduled_reports.company_id
      AND p.role IN ('company_admin', 'super_admin')
    )
  );

CREATE POLICY "Company admins can manage reports"
  ON scheduled_reports
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.company_id = scheduled_reports.company_id
      AND p.role IN ('company_admin', 'super_admin')
    )
  );

-- Update existing RLS policies to include client access
-- Clients can view incidents for their assigned sites
CREATE POLICY "Clients can view assigned site incidents"
  ON incidents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM client_access ca
      WHERE ca.client_id = auth.uid()
      AND ca.site_id = incidents.site_id
      AND ca.can_view_incidents = true
      AND ca.is_active = true
    )
  );

-- Clients can view shifts for their assigned sites
CREATE POLICY "Clients can view assigned site shifts"
  ON shifts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM client_access ca
      WHERE ca.client_id = auth.uid()
      AND ca.site_id = shifts.site_id
      AND ca.can_view_shifts = true
      AND ca.is_active = true
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_access_client_id ON client_access(client_id);
CREATE INDEX IF NOT EXISTS idx_client_access_site_id ON client_access(site_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_company_id ON scheduled_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_scheduled ON scheduled_reports(next_scheduled_at) WHERE is_active = true;