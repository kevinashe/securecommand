/*
  # Add Security Logbook System

  1. New Tables
    - `logbook_entries`
      - `id` (uuid, primary key)
      - `company_id` (uuid, FK to companies) - tenant isolation
      - `site_id` (uuid, FK to sites, nullable) - which site the entry is for
      - `guard_id` (uuid, FK to profiles) - who wrote the entry
      - `shift_id` (uuid, FK to shifts, nullable) - optional link to active shift
      - `entry_type` (text) - category: activity, observation, visitor, handover, maintenance, other
      - `title` (text) - short summary
      - `description` (text) - detailed log content
      - `priority` (text) - normal, important, urgent
      - `created_at` (timestamptz) - when the entry was recorded

  2. Security
    - Enable RLS on `logbook_entries` table
    - Guards can create entries for their own company
    - Guards can view their own entries
    - Company admins and site managers can view all entries for their company
    - Clients can view entries for sites they are associated with
    - Super admins can view all entries

  3. Indexes
    - Index on company_id for tenant filtering
    - Index on guard_id for personal lookups
    - Index on site_id for site-based filtering
    - Index on created_at for chronological sorting
*/

CREATE TABLE IF NOT EXISTS logbook_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  site_id uuid REFERENCES sites(id),
  guard_id uuid NOT NULL REFERENCES profiles(id),
  shift_id uuid REFERENCES shifts(id),
  entry_type text NOT NULL DEFAULT 'activity',
  title text NOT NULL,
  description text NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE logbook_entries ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_logbook_entries_company_id ON logbook_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_logbook_entries_guard_id ON logbook_entries(guard_id);
CREATE INDEX IF NOT EXISTS idx_logbook_entries_site_id ON logbook_entries(site_id);
CREATE INDEX IF NOT EXISTS idx_logbook_entries_created_at ON logbook_entries(created_at DESC);

-- Guards can insert entries for their own company
CREATE POLICY "Guards can create logbook entries"
  ON logbook_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = guard_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.company_id = logbook_entries.company_id
    )
  );

-- Guards can view their own entries
CREATE POLICY "Guards can view own logbook entries"
  ON logbook_entries
  FOR SELECT
  TO authenticated
  USING (
    guard_id = auth.uid()
  );

-- Company admins and site managers can view all company entries
CREATE POLICY "Admins can view company logbook entries"
  ON logbook_entries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.company_id = logbook_entries.company_id
      AND profiles.role IN ('company_admin', 'site_manager')
    )
  );

-- Clients can view entries for sites linked to their company
CREATE POLICY "Clients can view logbook entries for their sites"
  ON logbook_entries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'client'
      AND profiles.company_id = logbook_entries.company_id
    )
  );

-- Super admins can view all entries
CREATE POLICY "Super admins can view all logbook entries"
  ON logbook_entries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );
