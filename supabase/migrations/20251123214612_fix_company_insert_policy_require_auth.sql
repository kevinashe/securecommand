/*
  # Fix Company Insert Policy to Properly Check Authentication

  1. Changes
    - Drop the existing insert policy
    - Recreate it with proper authentication check
    - Use TO authenticated to ensure only authenticated users can insert
  
  2. Security
    - Only authenticated users can create companies
    - Proper role-based access control
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Authenticated users can create companies during signup" ON companies;

-- Recreate with proper authentication check
CREATE POLICY "Authenticated users can create companies during signup"
  ON companies
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
