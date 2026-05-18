/*
  # Add UPDATE policy for company admins on logbook entries

  1. Security Changes
    - Add UPDATE policy so company admins can edit any logbook entry within their company
    - Only company_admin role is permitted to update entries
    - Both USING and WITH CHECK verify company membership and admin role

  2. Important Notes
    - Guards and site managers cannot edit entries
    - Company admins can only edit entries belonging to their own company
*/

CREATE POLICY "Company admins can update company logbook entries"
  ON logbook_entries
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'company_admin'
        AND profiles.company_id = logbook_entries.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'company_admin'
        AND profiles.company_id = logbook_entries.company_id
    )
  );
