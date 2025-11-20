/*
  # Fix patrol_routes RLS for super admin inserts

  1. Changes
    - Allow super admins to insert patrol_routes for any company
    - Ensure company admins can only insert for their company

  2. Security
    - Super admins bypass company_id check
    - Company admins restricted to their company
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Super admins can manage all patrol routes" ON patrol_routes;
DROP POLICY IF EXISTS "Company admins can manage their patrol routes" ON patrol_routes;

-- Super admin policy - no company check needed
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

-- Company admin policy - must match company_id
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
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'company_admin'
      AND p.company_id = patrol_routes.company_id
    )
  );
