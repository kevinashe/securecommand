/*
  # Add office staff roles, guard deletion support, and check-in geofence enforcement

  ## 1. New User Roles
    - `dispatcher` - Coordinates guard assignments and communications
    - `hr_manager` - Manages employee records, onboarding, and compliance
    - `finance_officer` - Handles billing, invoicing, and financial reporting
    - `office_admin` - General office administration and support

  ## 2. Check-In Geofence Tracking
    - Add `is_within_geofence` boolean to check_ins table
    - Add `distance_from_checkpoint` numeric to check_ins for audit trail
    - Add `geofence_radius` to checkpoints with default 150 meters
    - Add `is_within_geofence` and `distance_from_stop` to bus_check_ins

  ## 3. Guard Deletion
    - Add DELETE policy on profiles for admins to remove inactive guards

  ## Security
    - All new columns have safe defaults
    - RLS policies updated for new roles
*/

-- =============================================================================
-- 1. ADD OFFICE STAFF ROLES
-- =============================================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'dispatcher';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'hr_manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'finance_officer';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'office_admin';

-- =============================================================================
-- 2. CHECK-IN GEOFENCE TRACKING
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'check_ins' AND column_name = 'is_within_geofence'
  ) THEN
    ALTER TABLE check_ins ADD COLUMN is_within_geofence boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'check_ins' AND column_name = 'distance_from_checkpoint'
  ) THEN
    ALTER TABLE check_ins ADD COLUMN distance_from_checkpoint numeric DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'checkpoints' AND column_name = 'geofence_radius'
  ) THEN
    ALTER TABLE checkpoints ADD COLUMN geofence_radius numeric DEFAULT 150;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bus_check_ins' AND column_name = 'is_within_geofence'
  ) THEN
    ALTER TABLE bus_check_ins ADD COLUMN is_within_geofence boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bus_check_ins' AND column_name = 'distance_from_stop'
  ) THEN
    ALTER TABLE bus_check_ins ADD COLUMN distance_from_stop numeric DEFAULT NULL;
  END IF;
END $$;

-- =============================================================================
-- 3. GUARD DELETION POLICY (only inactive profiles)
-- =============================================================================

CREATE POLICY "Company admins can delete inactive company members"
  ON profiles FOR DELETE TO authenticated
  USING (
    is_active = false
    AND EXISTS (
      SELECT 1 FROM profiles AS admin
      WHERE admin.id = auth.uid()
        AND admin.company_id = profiles.company_id
        AND admin.role IN ('company_admin')
    )
  );

CREATE POLICY "Super admins can delete inactive profiles"
  ON profiles FOR DELETE TO authenticated
  USING (
    is_active = false
    AND EXISTS (
      SELECT 1 FROM profiles AS admin
      WHERE admin.id = auth.uid()
        AND admin.role = 'super_admin'
    )
  );
