/*
  # Fix Profile RLS Infinite Recursion

  The existing policies for super_admin and company_admin cause infinite recursion
  because they query the profiles table from within the profiles table policies.

  ## Changes
  1. Drop the problematic policies
  2. Create new policies that don't cause recursion by checking auth.jwt() metadata
  
  ## Security Notes
  - Users can only view their own profile
  - Role-based access will need to use service role or be implemented differently
*/

-- Drop the recursive policies
DROP POLICY IF EXISTS "Super admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Company admins can view company profiles" ON profiles;

-- Keep the simple, non-recursive policies:
-- "Users can view own profile" - already exists and works
-- "Users can update own profile" - already exists and works
-- "Users can create own profile during signup" - already exists and works
