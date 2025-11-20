/*
  # Add Notifications, Audit Logs, and Check-ins System

  1. New Tables
    - `notifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles) - recipient of the notification
      - `title` (text) - notification title
      - `message` (text) - notification content
      - `type` (text) - notification type (sos, incident, shift, system)
      - `priority` (text) - priority level (low, medium, high, critical)
      - `related_type` (text) - type of related entity (sos, incident, shift, etc.)
      - `related_id` (uuid) - id of related entity
      - `is_read` (boolean) - whether notification has been read
      - `read_at` (timestamptz) - when notification was read
      - `created_at` (timestamptz)
    
    - `audit_logs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles) - user who performed the action
      - `action` (text) - action performed (create, update, delete, login, etc.)
      - `entity_type` (text) - type of entity affected (profile, incident, shift, etc.)
      - `entity_id` (uuid) - id of affected entity
      - `changes` (jsonb) - details of what changed
      - `ip_address` (text) - IP address of user
      - `user_agent` (text) - browser/device info
      - `created_at` (timestamptz)
    
    - `shift_check_ins`
      - `id` (uuid, primary key)
      - `shift_id` (uuid, references shifts)
      - `guard_id` (uuid, references profiles)
      - `check_in_time` (timestamptz) - when guard checked in
      - `check_in_latitude` (decimal) - check-in location
      - `check_in_longitude` (decimal)
      - `check_in_photo_url` (text) - optional photo at check-in
      - `check_out_time` (timestamptz) - when guard checked out
      - `check_out_latitude` (decimal) - check-out location
      - `check_out_longitude` (decimal)
      - `check_out_photo_url` (text) - optional photo at check-out
      - `notes` (text) - any notes from the guard
      - `status` (text) - checked_in, checked_out, missed
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users
    - Audit logs are read-only for non-admins
    - Notifications can be read/updated by recipient
    - Check-ins managed by guards and admins

  3. Indexes
    - Add indexes for common queries
*/

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'system',
  priority text NOT NULL DEFAULT 'medium',
  related_type text,
  related_id uuid,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  changes jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Create shift_check_ins table
CREATE TABLE IF NOT EXISTS shift_check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid REFERENCES shifts(id) ON DELETE CASCADE NOT NULL,
  guard_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  check_in_time timestamptz,
  check_in_latitude decimal(10, 8),
  check_in_longitude decimal(11, 8),
  check_in_photo_url text,
  check_out_time timestamptz,
  check_out_latitude decimal(10, 8),
  check_out_longitude decimal(11, 8),
  check_out_photo_url text,
  notes text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_shift_check_ins_shift_id ON shift_check_ins(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_check_ins_guard_id ON shift_check_ins(guard_id);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_check_ins ENABLE ROW LEVEL SECURITY;

-- Notifications policies
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Audit logs policies (read-only for regular users, full access for admins)
CREATE POLICY "Admins can view all audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'company_admin')
    )
  );

CREATE POLICY "Users can view their own audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can create audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Shift check-ins policies
CREATE POLICY "Guards can view their own check-ins"
  ON shift_check_ins FOR SELECT
  TO authenticated
  USING (auth.uid() = guard_id);

CREATE POLICY "Admins can view company check-ins"
  ON shift_check_ins FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'company_admin', 'site_manager')
      AND (
        profiles.role = 'super_admin'
        OR EXISTS (
          SELECT 1 FROM shifts
          JOIN sites ON shifts.site_id = sites.id
          WHERE shifts.id = shift_check_ins.shift_id
          AND sites.company_id = profiles.company_id
        )
      )
    )
  );

CREATE POLICY "Guards can create check-ins for their shifts"
  ON shift_check_ins FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = guard_id);

CREATE POLICY "Guards can update their own check-ins"
  ON shift_check_ins FOR UPDATE
  TO authenticated
  USING (auth.uid() = guard_id)
  WITH CHECK (auth.uid() = guard_id);

CREATE POLICY "Admins can manage company check-ins"
  ON shift_check_ins FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'company_admin', 'site_manager')
      AND (
        profiles.role = 'super_admin'
        OR EXISTS (
          SELECT 1 FROM shifts
          JOIN sites ON shifts.site_id = sites.id
          WHERE shifts.id = shift_check_ins.shift_id
          AND sites.company_id = profiles.company_id
        )
      )
    )
  );
