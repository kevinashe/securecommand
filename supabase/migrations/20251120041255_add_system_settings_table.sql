/*
  # Add System Settings Table
  
  1. New Tables
    - `system_settings`
      - `id` (uuid, primary key)
      - `app_icon_url` (text, nullable) - Custom application icon/logo URL
      - `app_name` (text) - Application display name
      - `primary_color` (text) - Primary brand color
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `system_settings` table
    - Only super_admins can update system settings
    - All authenticated users can read system settings
  
  3. Initial Data
    - Insert default system settings row
*/

-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_icon_url text,
  app_name text NOT NULL DEFAULT 'SecureCommand',
  primary_color text NOT NULL DEFAULT '#2563eb',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Policies for system_settings
CREATE POLICY "Anyone can read system settings"
  ON system_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Super admins can update system settings"
  ON system_settings
  FOR UPDATE
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin')
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin');

CREATE POLICY "Super admins can insert system settings"
  ON system_settings
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin');

-- Insert default system settings (if none exist)
INSERT INTO system_settings (app_name, app_icon_url, primary_color)
SELECT 'SecureCommand', '/icon.svg', '#2563eb'
WHERE NOT EXISTS (SELECT 1 FROM system_settings LIMIT 1);