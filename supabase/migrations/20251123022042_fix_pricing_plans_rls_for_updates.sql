/*
  # Fix Pricing Plans RLS for Updates

  1. Changes
    - Drop the existing "Super admins can manage pricing plans" policy
    - Create separate policies for SELECT, INSERT, UPDATE, and DELETE
    - Ensure UPDATE policy has proper WITH CHECK clause
  
  2. Security
    - Maintains super admin-only access
    - Fixes the missing WITH CHECK clause for updates
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Super admins can manage pricing plans" ON pricing_plans;

-- Create separate policies for each operation
CREATE POLICY "Super admins can view all pricing plans"
  ON pricing_plans
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can insert pricing plans"
  ON pricing_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update pricing plans"
  ON pricing_plans
  FOR UPDATE
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

CREATE POLICY "Super admins can delete pricing plans"
  ON pricing_plans
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );
