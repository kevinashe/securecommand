/*
  # Add Geofencing and Shift Handover Features
  
  1. Changes to Existing Tables
    - `sites` table: Add geofence_radius for perimeter alerts
    - `shifts` table: Add handover_notes for shift transitions
  
  2. New Tables
    - `geofence_violations`
      - Tracks when guards leave assigned site perimeter
      - Includes location, distance from site, timestamp
  
  3. Security
    - Enable RLS on geofence_violations table
    - Add policies for company admins and site managers to view violations
    - Guards can view their own violations
  
  4. Notes
    - Geofence radius in meters (default 100m)
    - Violations logged automatically when GPS tracking detects out-of-bounds
*/

-- Add geofence radius to sites
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sites' AND column_name = 'geofence_radius'
  ) THEN
    ALTER TABLE sites ADD COLUMN geofence_radius numeric DEFAULT 100;
  END IF;
END $$;

COMMENT ON COLUMN sites.geofence_radius IS 'Perimeter radius in meters for geofence alerts';

-- Add handover notes to shifts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shifts' AND column_name = 'handover_notes'
  ) THEN
    ALTER TABLE shifts ADD COLUMN handover_notes text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shifts' AND column_name = 'handover_from'
  ) THEN
    ALTER TABLE shifts ADD COLUMN handover_from uuid REFERENCES profiles(id);
  END IF;
END $$;

COMMENT ON COLUMN shifts.handover_notes IS 'Notes from previous guard for incoming shift';
COMMENT ON COLUMN shifts.handover_from IS 'Previous guard who handed over the shift';

-- Create geofence violations table
CREATE TABLE IF NOT EXISTS geofence_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guard_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shift_id uuid REFERENCES shifts(id) ON DELETE SET NULL,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  distance_from_site numeric NOT NULL,
  violation_type text DEFAULT 'left_perimeter',
  severity text DEFAULT 'medium',
  acknowledged boolean DEFAULT false,
  acknowledged_by uuid REFERENCES profiles(id),
  acknowledged_at timestamptz,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE geofence_violations IS 'Logs when guards leave their assigned site perimeter';

-- Enable RLS
ALTER TABLE geofence_violations ENABLE ROW LEVEL SECURITY;

-- Policies for geofence_violations
CREATE POLICY "Guards can view own violations"
  ON geofence_violations
  FOR SELECT
  TO authenticated
  USING (guard_id = auth.uid());

CREATE POLICY "Company admins can view company violations"
  ON geofence_violations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sites s
      JOIN profiles p ON p.company_id = s.company_id
      WHERE s.id = geofence_violations.site_id
      AND p.id = auth.uid()
      AND p.role IN ('company_admin', 'site_manager')
    )
  );

CREATE POLICY "Super admins can view all violations"
  ON geofence_violations
  FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin');

CREATE POLICY "System can insert violations"
  ON geofence_violations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Managers can acknowledge violations"
  ON geofence_violations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sites s
      JOIN profiles p ON p.company_id = s.company_id
      WHERE s.id = geofence_violations.site_id
      AND p.id = auth.uid()
      AND p.role IN ('company_admin', 'site_manager', 'super_admin')
    )
  );

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_geofence_violations_guard_id ON geofence_violations(guard_id);
CREATE INDEX IF NOT EXISTS idx_geofence_violations_site_id ON geofence_violations(site_id);
CREATE INDEX IF NOT EXISTS idx_geofence_violations_created_at ON geofence_violations(created_at);
CREATE INDEX IF NOT EXISTS idx_geofence_violations_acknowledged ON geofence_violations(acknowledged) WHERE acknowledged = false;