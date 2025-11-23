/*
  # Fix Pricing Plans RLS Using JWT

  1. Changes
    - Replace profile table lookups with JWT-based role checks
    - This avoids potential infinite recursion issues
    - Uses auth.jwt() -> 'user_metadata' -> 'role' for direct role access
  
  2. Security
    - Maintains super admin-only access
    - More efficient as it doesn't query profiles table
*/

-- Drop existing super admin policies
DROP POLICY IF EXISTS "Super admins can view all pricing plans" ON pricing_plans;
DROP POLICY IF EXISTS "Super admins can insert pricing plans" ON pricing_plans;
DROP POLICY IF EXISTS "Super admins can update pricing plans" ON pricing_plans;
DROP POLICY IF EXISTS "Super admins can delete pricing plans" ON pricing_plans;

-- Create new policies using JWT
CREATE POLICY "Super admins can view all pricing plans"
  ON pricing_plans
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
  );

CREATE POLICY "Super admins can insert pricing plans"
  ON pricing_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
  );

CREATE POLICY "Super admins can update pricing plans"
  ON pricing_plans
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
  );

CREATE POLICY "Super admins can delete pricing plans"
  ON pricing_plans
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
  );
