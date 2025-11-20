/*
  # Add Employment History and Status Tracking

  1. New Tables
    - `employment_history`
      - `id` (uuid, primary key)
      - `officer_id` (uuid, references profiles)
      - `company_id` (uuid, references companies)
      - `start_date` (timestamptz)
      - `end_date` (timestamptz, nullable - null means currently employed)
      - `status` (text - active, resigned, terminated, transferred)
      - `notes` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes to profiles table
    - Add `is_active` boolean field (default true)
    - Add `employment_status` text field

  3. Security
    - Enable RLS on employment_history table
    - Super admins can view all employment history
    - Company admins can view their company's employment history
    - Officers can view their own employment history
*/

-- Add new fields to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_active boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'employment_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN employment_status text DEFAULT 'active';
  END IF;
END $$;

-- Create employment_history table
CREATE TABLE IF NOT EXISTS employment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_employment_history_officer ON employment_history(officer_id);
CREATE INDEX IF NOT EXISTS idx_employment_history_company ON employment_history(company_id);
CREATE INDEX IF NOT EXISTS idx_employment_history_status ON employment_history(status);

-- Enable RLS
ALTER TABLE employment_history ENABLE ROW LEVEL SECURITY;

-- Super admins can view all employment history
CREATE POLICY "Super admins can view all employment history"
  ON employment_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Super admins can manage all employment history
CREATE POLICY "Super admins can manage employment history"
  ON employment_history
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Company admins can view their company's employment history
CREATE POLICY "Company admins can view their employment history"
  ON employment_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'company_admin'
      AND profiles.company_id = employment_history.company_id
    )
  );

-- Company admins can manage their company's employment history
CREATE POLICY "Company admins can manage their employment history"
  ON employment_history
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'company_admin'
      AND p.company_id = employment_history.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'company_admin'
      AND p.company_id = employment_history.company_id
    )
  );

-- Officers can view their own employment history
CREATE POLICY "Officers can view own employment history"
  ON employment_history
  FOR SELECT
  TO authenticated
  USING (officer_id = auth.uid());

-- Create function to automatically create employment history record when company_id changes
CREATE OR REPLACE FUNCTION create_employment_history_on_company_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If company_id changed and there's an old company
  IF OLD.company_id IS DISTINCT FROM NEW.company_id AND OLD.company_id IS NOT NULL THEN
    -- End the previous employment
    UPDATE employment_history
    SET end_date = now(),
        status = 'transferred',
        updated_at = now()
    WHERE officer_id = NEW.id
      AND company_id = OLD.company_id
      AND end_date IS NULL;
  END IF;

  -- If there's a new company_id, create new employment record
  IF NEW.company_id IS NOT NULL AND (OLD.company_id IS NULL OR OLD.company_id != NEW.company_id) THEN
    INSERT INTO employment_history (officer_id, company_id, start_date, status)
    VALUES (NEW.id, NEW.company_id, now(), 'active');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic employment history tracking
DROP TRIGGER IF EXISTS track_employment_changes ON profiles;
CREATE TRIGGER track_employment_changes
  AFTER UPDATE OF company_id ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_employment_history_on_company_change();

-- Create initial employment history records for existing officers
INSERT INTO employment_history (officer_id, company_id, start_date, status)
SELECT id, company_id, created_at, 'active'
FROM profiles
WHERE company_id IS NOT NULL
  AND role IN ('security_officer', 'company_admin')
  AND NOT EXISTS (
    SELECT 1 FROM employment_history
    WHERE employment_history.officer_id = profiles.id
  );
