/*
  # Allow Company Self-Registration

  1. Changes
    - Add INSERT policy to allow new authenticated users to create companies during signup
    - This allows the company signup flow to work for new users who don't have a profile yet
  
  2. Security
    - Policy only allows INSERT (not UPDATE or DELETE)
    - User must be authenticated
    - This is safe because:
      * New companies start with default settings
      * Admin account is created immediately after
      * Standard RLS policies still apply for all other operations
*/

-- Drop the restrictive FOR ALL policy and replace with specific policies
DROP POLICY IF EXISTS "Super admins can manage all companies" ON companies;

-- Allow super admins to do everything
CREATE POLICY "Super admins can view all companies"
  ON companies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can insert companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update companies"
  ON companies FOR UPDATE
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

CREATE POLICY "Super admins can delete companies"
  ON companies FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Allow new authenticated users to create companies during signup
CREATE POLICY "Authenticated users can create companies during signup"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Company admins can update their own company
CREATE POLICY "Company admins can update their company"
  ON companies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.company_id = companies.id
      AND profiles.role IN ('company_admin', 'site_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.company_id = companies.id
      AND profiles.role IN ('company_admin', 'site_manager')
    )
  );
