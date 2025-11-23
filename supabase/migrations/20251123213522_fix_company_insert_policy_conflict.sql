/*
  # Fix Company Insert Policy Conflict

  1. Changes
    - Drop the super admin INSERT policy that conflicts with signup
    - Keep the authenticated user INSERT policy that allows company self-registration
    - Super admins can still insert via the authenticated policy since they are authenticated
  
  2. Security
    - Allows any authenticated user to create a company (for self-registration)
    - Still maintains proper access control for other operations
*/

-- Drop the conflicting super admin insert policy
DROP POLICY IF EXISTS "Super admins can insert companies" ON companies;

-- The "Authenticated users can create companies during signup" policy remains
-- and will handle all inserts, including from super admins
