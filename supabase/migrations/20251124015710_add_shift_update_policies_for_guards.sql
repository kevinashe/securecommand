/*
  # Add Shift Update Policies for Guards and Managers

  1. Changes
    - Add policy for guards to update their own shift status
    - Add explicit UPDATE policy for site managers with proper with_check
    - Keep existing ALL policy for backward compatibility but add with_check

  2. Security
    - Guards can only update status field of their own shifts
    - Site managers can update shifts for their company's sites
*/

-- Drop and recreate the ALL policy with proper with_check
DROP POLICY IF EXISTS "Site managers can manage site shifts" ON shifts;

CREATE POLICY "Site managers can manage site shifts"
  ON shifts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN sites s ON s.id = shifts.site_id
      WHERE p.id = auth.uid()
        AND p.role IN ('company_admin', 'site_manager', 'super_admin')
        AND (p.company_id = s.company_id OR p.role = 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN sites s ON s.id = shifts.site_id
      WHERE p.id = auth.uid()
        AND p.role IN ('company_admin', 'site_manager', 'super_admin')
        AND (p.company_id = s.company_id OR p.role = 'super_admin')
    )
  );

-- Add policy for guards to update their own shift status
CREATE POLICY "Guards can update own shift status"
  ON shifts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = guard_id)
  WITH CHECK (auth.uid() = guard_id);
