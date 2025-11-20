/*
  # Add Profile Viewing Policies for Admins and Managers

  1. Problem
    - Company admins and site managers cannot view guard profiles
    - Current RLS only allows users to view their own profile
    - This prevents viewing guards when creating shifts

  2. Solution
    - Add policy for super admins to view all profiles
    - Add policy for company admins to view profiles in their company
    - Add policy for site managers to view all profiles
    - Keep existing policy for users to view their own profile

  3. Security
    - Super admins can view all profiles (they manage the system)
    - Company admins can only view profiles within their company
    - Site managers can view all profiles (they manage sites across companies)
    - Regular users can only view their own profile
*/

-- Allow super admins to view all profiles
CREATE POLICY "Super admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'super_admin'
    )
  );

-- Allow company admins to view profiles in their company
CREATE POLICY "Company admins can view profiles in their company"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'company_admin'
      AND p.company_id = profiles.company_id
    )
  );

-- Allow site managers to view all profiles
CREATE POLICY "Site managers can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'site_manager'
    )
  );
