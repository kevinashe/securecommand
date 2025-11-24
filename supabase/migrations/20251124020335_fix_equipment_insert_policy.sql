/*
  # Fix Equipment RLS Policy for Inserts

  1. Changes
    - Add WITH CHECK clause to equipment management policy
    - This allows company admins to create new equipment

  2. Security
    - Company admins can manage equipment for their company
    - Super admins can manage all equipment
*/

-- Drop and recreate the ALL policy with proper with_check
DROP POLICY IF EXISTS "Company admins can manage equipment" ON equipment;

CREATE POLICY "Company admins can manage equipment"
  ON equipment
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('company_admin', 'super_admin')
        AND (profiles.company_id = equipment.company_id OR profiles.role = 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('company_admin', 'super_admin')
        AND (profiles.company_id = equipment.company_id OR profiles.role = 'super_admin')
    )
  );
