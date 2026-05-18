/*
  # Allow admins to update profiles in their company

  ## Problem
    - Only "Users can update own profile" policy exists (auth.uid() = id)
    - Company admins cannot toggle guard active status because they are
      updating another user's profile, which the policy blocks

  ## Changes
    - Add UPDATE policy for company_admin and site_manager to update profiles
      within their own company
    - Add UPDATE policy for super_admin to update any profile

  ## Security
    - Company admins can only update users in their same company
    - Super admins can update any profile
*/

CREATE POLICY "Company admins can update company member profiles"
  ON profiles FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS admin
      WHERE admin.id = auth.uid()
        AND admin.company_id = profiles.company_id
        AND admin.role IN ('company_admin', 'site_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles AS admin
      WHERE admin.id = auth.uid()
        AND admin.company_id = profiles.company_id
        AND admin.role IN ('company_admin', 'site_manager')
    )
  );

CREATE POLICY "Super admins can update any profile"
  ON profiles FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS admin
      WHERE admin.id = auth.uid()
        AND admin.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles AS admin
      WHERE admin.id = auth.uid()
        AND admin.role = 'super_admin'
    )
  );
