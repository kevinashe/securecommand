/*
  # Sync User Role to JWT Metadata

  1. Changes
    - Create function to sync profile role to auth.users app_metadata
    - Create trigger to automatically update app_metadata when profile role changes
    - Manually sync existing users' roles to app_metadata
  
  2. Security
    - Allows RLS policies to use JWT-based role checks
    - More efficient than querying profiles table
    - Prevents infinite recursion in RLS policies
*/

-- Function to sync role from profiles to auth.users app_metadata
CREATE OR REPLACE FUNCTION sync_role_to_jwt()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update the user's app_metadata with their role
  UPDATE auth.users
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', NEW.role)
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Create trigger to sync role on INSERT and UPDATE
DROP TRIGGER IF EXISTS sync_role_to_jwt_on_change ON profiles;
CREATE TRIGGER sync_role_to_jwt_on_change
  AFTER INSERT OR UPDATE OF role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_role_to_jwt();

-- Sync existing users' roles to their JWT metadata
DO $$
DECLARE
  profile_record RECORD;
BEGIN
  FOR profile_record IN 
    SELECT id, role FROM profiles
  LOOP
    UPDATE auth.users
    SET raw_app_meta_data = 
      COALESCE(raw_app_meta_data, '{}'::jsonb) || 
      jsonb_build_object('role', profile_record.role)
    WHERE id = profile_record.id;
  END LOOP;
END $$;
