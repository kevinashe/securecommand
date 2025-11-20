/*
  # Fix User Signup Trigger

  This migration fixes the handle_new_user trigger to properly handle user signups
  by making it more robust with better error handling and type casting.

  ## Changes
  1. Updates the handle_new_user function to safely handle role casting
  2. Ensures company_id can be null for users without a company
  3. Adds better error handling
*/

-- Drop and recreate the trigger function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_role_value user_role;
  company_id_value uuid;
BEGIN
  -- Safely cast the role, defaulting to 'security_officer' if invalid
  BEGIN
    user_role_value := COALESCE((new.raw_user_meta_data->>'role')::user_role, 'security_officer');
  EXCEPTION WHEN OTHERS THEN
    user_role_value := 'security_officer';
  END;

  -- Safely get company_id if it exists
  BEGIN
    company_id_value := (new.raw_user_meta_data->>'company_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    company_id_value := NULL;
  END;

  -- Insert the profile
  INSERT INTO public.profiles (id, full_name, role, company_id)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'New User'),
    user_role_value,
    company_id_value
  );
  
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't fail the user creation
  RAISE WARNING 'Error creating profile for user %: %', new.id, SQLERRM;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
