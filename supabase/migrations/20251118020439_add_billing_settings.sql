/*
  # Add Billing Settings

  1. New Tables
    - `billing_settings`
      - `id` (uuid, primary key)
      - `license_fee` (numeric) - Monthly license fee per company
      - `per_guard_fee` (numeric) - Monthly fee per guard
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `billing_settings` table
    - Add policy for super_admin to read settings
    - Add policy for super_admin to update settings
  
  3. Initial Data
    - Insert default billing settings ($500 license fee, $25 per guard)
*/

CREATE TABLE IF NOT EXISTS billing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_fee numeric NOT NULL DEFAULT 500,
  per_guard_fee numeric NOT NULL DEFAULT 25,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE billing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read billing settings"
  ON billing_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can update billing settings"
  ON billing_settings
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

CREATE POLICY "Super admins can insert billing settings"
  ON billing_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

INSERT INTO billing_settings (license_fee, per_guard_fee)
VALUES (500, 25)
ON CONFLICT DO NOTHING;
