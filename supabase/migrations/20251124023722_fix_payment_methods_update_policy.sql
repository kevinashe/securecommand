/*
  # Fix Payment Methods Update Policy

  1. Changes
    - Drop existing policies that don't have WITH CHECK clauses
    - Recreate policies with proper USING and WITH CHECK clauses for all operations
    - Ensure company admins can properly update (soft delete) their payment methods
  
  2. Security
    - Maintains RLS protection
    - Super admins can manage all payment methods
    - Company admins can only manage their own company's payment methods
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Super admins can manage all payment methods" ON payment_methods;
DROP POLICY IF EXISTS "Company admins can manage their payment methods" ON payment_methods;

-- Super admin policies
CREATE POLICY "Super admins can view all payment methods"
  ON payment_methods
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can insert payment methods"
  ON payment_methods
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update payment methods"
  ON payment_methods
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

CREATE POLICY "Super admins can delete payment methods"
  ON payment_methods
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Company admin policies
CREATE POLICY "Company admins can view their payment methods"
  ON payment_methods
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.company_id = payment_methods.company_id
      AND profiles.role IN ('company_admin', 'super_admin')
    )
  );

CREATE POLICY "Company admins can insert their payment methods"
  ON payment_methods
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.company_id = payment_methods.company_id
      AND profiles.role IN ('company_admin', 'super_admin')
    )
  );

CREATE POLICY "Company admins can update their payment methods"
  ON payment_methods
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.company_id = payment_methods.company_id
      AND profiles.role IN ('company_admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.company_id = payment_methods.company_id
      AND profiles.role IN ('company_admin', 'super_admin')
    )
  );

CREATE POLICY "Company admins can delete their payment methods"
  ON payment_methods
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.company_id = payment_methods.company_id
      AND profiles.role IN ('company_admin', 'super_admin')
    )
  );
