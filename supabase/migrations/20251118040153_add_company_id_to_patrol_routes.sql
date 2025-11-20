/*
  # Add company_id to patrol_routes

  1. Changes
    - Add company_id column to patrol_routes table
    - Set company_id based on the site's company_id for existing records
    - Make company_id NOT NULL after data migration
    - Update RLS policies to check company_id

  2. Security
    - Maintain RLS policies with company_id filtering
*/

-- Add company_id column (nullable initially)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'patrol_routes' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE patrol_routes ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Update existing records to have company_id from their site
UPDATE patrol_routes pr
SET company_id = s.company_id
FROM sites s
WHERE pr.site_id = s.id AND pr.company_id IS NULL;

-- Make company_id NOT NULL if there are records
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM patrol_routes LIMIT 1) THEN
    ALTER TABLE patrol_routes ALTER COLUMN company_id SET NOT NULL;
  END IF;
END $$;

-- Update RLS policies
DROP POLICY IF EXISTS "Super admins can manage all patrol routes" ON patrol_routes;
DROP POLICY IF EXISTS "Company admins can manage their patrol routes" ON patrol_routes;
DROP POLICY IF EXISTS "Guards can view their company patrol routes" ON patrol_routes;
DROP POLICY IF EXISTS "Security officers can view their company patrol routes" ON patrol_routes;

CREATE POLICY "Super admins can manage all patrol routes"
  ON patrol_routes
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

CREATE POLICY "Company admins can manage their patrol routes"
  ON patrol_routes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'company_admin'
      AND profiles.company_id = patrol_routes.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'company_admin'
      AND profiles.company_id = patrol_routes.company_id
    )
  );

CREATE POLICY "Security officers can view their company patrol routes"
  ON patrol_routes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'security_officer'
      AND profiles.company_id = patrol_routes.company_id
    )
  );
