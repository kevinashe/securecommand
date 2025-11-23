/*
  # Update Pricing Plans RLS to Use App Metadata

  1. Changes
    - Update all super admin policies to check app_metadata instead of user_metadata
    - Role is now synced to app_metadata via trigger
  
  2. Security
    - Uses app_metadata which cannot be modified by users
    - More secure than user_metadata
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Super admins can view all pricing plans" ON pricing_plans;
DROP POLICY IF EXISTS "Super admins can insert pricing plans" ON pricing_plans;
DROP POLICY IF EXISTS "Super admins can update pricing plans" ON pricing_plans;
DROP POLICY IF EXISTS "Super admins can delete pricing plans" ON pricing_plans;

-- Recreate policies using app_metadata
CREATE POLICY "Super admins can view all pricing plans"
  ON pricing_plans
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

CREATE POLICY "Super admins can insert pricing plans"
  ON pricing_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

CREATE POLICY "Super admins can update pricing plans"
  ON pricing_plans
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

CREATE POLICY "Super admins can delete pricing plans"
  ON pricing_plans
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );
