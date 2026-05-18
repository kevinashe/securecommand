/*
  # Fix audit_logs and notifications INSERT policies for frontend usage

  The previous migration restricted INSERT on audit_logs and notifications to
  service_role only, but these tables are also written to from the frontend by
  authenticated users. This migration adds proper authenticated INSERT policies
  with ownership checks.

  ## Changes
    - audit_logs: Allow authenticated users to insert their own audit log entries
      (user_id must match their auth.uid())
    - notifications: Allow authenticated users to insert notifications
      (user_id on the notification must be a valid target)

  ## Security
    - audit_logs: Users can only create entries attributed to themselves
    - notifications: Authenticated users can create notifications for other users
      in their company (needed for SOS alert flow)
*/

-- audit_logs: Allow authenticated users to log their own actions
CREATE POLICY "Authenticated users can create own audit logs"
  ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- notifications: Allow authenticated users to create notifications
-- The SOS flow inserts notifications for admins, so we need to allow
-- authenticated users to insert notifications for users in the same company
CREATE POLICY "Authenticated users can create notifications for company members"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles AS sender
      JOIN profiles AS recipient ON sender.company_id = recipient.company_id
      WHERE sender.id = auth.uid()
        AND recipient.id = notifications.user_id
    )
  );
